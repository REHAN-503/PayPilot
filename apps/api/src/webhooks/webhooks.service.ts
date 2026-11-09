import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { PayPalService } from '../payments/paypal.service.js';
import {
  transitionIntentStatus,
  transitionPaymentStatus,
  transitionPlanStatus,
} from '../common/state/state-machine.js';

export interface WebhookHeaders {
  authAlgo?: string;
  certUrl?: string;
  transmissionId?: string;
  transmissionSig?: string;
  transmissionTime?: string;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly webhookId?: string;
  private readonly demoMode: boolean;
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly paypalService: PayPalService,
  ) {
    this.webhookId = this.config.get<string>('PAYPAL_WEBHOOK_ID');
    this.demoMode = this.config.get<string>('DEMO_MODE') !== 'false';
    this.baseUrl =
      this.config.get<string>('PAYPAL_API_BASE_URL') ||
      'https://api-m.sandbox.paypal.com';
  }

  async verifySignature(
    headers: WebhookHeaders,
    rawBody: unknown,
  ): Promise<boolean> {
    if (this.demoMode || !this.webhookId || this.webhookId.includes('your_paypal')) {
      return true;
    }

    try {
      const token = await this.paypalService.getAccessToken();

      const verificationPayload = {
        auth_algo: headers.authAlgo,
        cert_url: headers.certUrl,
        transmission_id: headers.transmissionId,
        transmission_sig: headers.transmissionSig,
        transmission_time: headers.transmissionTime,
        webhook_id: this.webhookId,
        webhook_event: rawBody,
      };

      const res = await fetch(
        `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(verificationPayload),
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!res.ok) {
        return false;
      }

      const data = (await res.json()) as { verification_status?: string };
      return data.verification_status === 'SUCCESS';
    } catch (err) {
      this.logger.error('PayPal webhook verification failed with error', err);
      return false;
    }
  }

  async handleWebhook(headers: WebhookHeaders, payload: any) {
    const isVerified = await this.verifySignature(headers, payload);
    if (!isVerified) {
      this.logger.warn('Rejected unverified PayPal webhook signature');
      throw new UnauthorizedException('Invalid PayPal webhook signature');
    }

    const eventId = payload.id ?? `evt-${Date.now()}`;
    const eventType = payload.event_type ?? 'UNKNOWN';
    const resource = payload.resource ?? {};

    // Rule 9: Unique WebhookEvent.eventId deduplication
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { eventId },
    });

    if (existing) {
      this.logger.log(`Duplicate webhook event ignored: ${eventId}`);
      return { status: 'ignored', reason: 'duplicate event' };
    }

    // Record webhook event in DB
    const webhookRecord = await this.prisma.webhookEvent.create({
      data: {
        eventId,
        eventType,
        resourceId: resource.id ?? null,
        status: 'PROCESSING',
        payload: payload as any,
      },
    });

    try {
      if (eventType === 'CHECKOUT.ORDER.APPROVED') {
        const orderId = resource.id;
        const payment = await this.prisma.payment.findFirst({
          where: { paypalOrderId: orderId },
        });

        if (payment && payment.status === 'ORDER_CREATED') {
          const nextStatus = transitionPaymentStatus(payment.status as any, 'APPROVED');
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: { status: nextStatus, approvedAt: new Date() },
          });

          await this.prisma.agentActivity.create({
            data: {
              userId: payment.userId,
              planId: payment.planId,
              paymentId: payment.id,
              type: 'WEBHOOK_RECEIVED',
              title: 'PayPal order approved by buyer',
              description: `Authoritative webhook confirmed order approval for ${orderId}.`,
              metadata: { eventId, eventType, orderId },
            },
          });
        }
      } else if (
        eventType === 'PAYMENT.CAPTURE.COMPLETED' ||
        eventType === 'CHECKOUT.PAYMENT-APPROVAL.REVERSED'
      ) {
        // Authoritative capture settlement
        const captureId = resource.id;
        const orderId =
          resource.supplementary_data?.related_ids?.order_id ??
          resource.custom_id;

        const payment = await this.prisma.payment.findFirst({
          where: {
            OR: [
              ...(orderId ? [{ paypalOrderId: orderId }] : []),
              { paypalCaptureId: captureId },
            ],
          },
          include: { plan: { include: { intent: true } } },
        });

        if (payment && payment.status !== 'CAPTURED') {
          const now = new Date();
          const targetPaymentStatus = transitionPaymentStatus(payment.status as any, 'CAPTURED');
          const targetPlanStatus = transitionPlanStatus(payment.plan.status as any, 'COMPLETED');
          const targetIntentStatus = transitionIntentStatus(payment.plan.intent.status as any, 'COMPLETED');
          const captureIdempotencyKey = randomUUID();

          await this.prisma.$transaction(async (tx) => {
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: targetPaymentStatus,
                paypalCaptureId: captureId,
                capturedAt: now,
              },
            });

            // Rule 8: Append-only immutable transaction ledger
            await tx.transaction.create({
              data: {
                userId: payment.userId,
                paymentId: payment.id,
                type: 'PAYMENT_CAPTURED',
                amount: payment.amount,
                currency: 'USD',
                externalReference: captureId,
                idempotencyKey: captureIdempotencyKey,
                description: `Authoritative PayPal webhook settlement verified: Capture ${captureId}`,
                metadata: { eventId, eventType, captureId },
              },
            });

            await tx.purchasePlan.update({
              where: { id: payment.planId },
              data: { status: targetPlanStatus },
            });

            await tx.purchaseIntent.update({
              where: { id: payment.plan.intentId },
              data: { status: targetIntentStatus },
            });

            await tx.agentActivity.create({
              data: {
                userId: payment.userId,
                intentId: payment.plan.intentId,
                planId: payment.planId,
                paymentId: payment.id,
                type: 'WEBHOOK_RECEIVED',
                title: 'Payment settled via PayPal webhook',
                description: `Authoritative capture verified: ${captureId}. Transaction recorded in immutable ledger.`,
                metadata: { eventId, eventType, captureId },
              },
            });
          });
        }
      } else if (
        eventType === 'PAYMENT.CAPTURE.DENIED' ||
        eventType === 'PAYMENT.CAPTURE.DECLINED'
      ) {
        const captureId = resource.id;
        const payment = await this.prisma.payment.findFirst({
          where: { paypalCaptureId: captureId },
        });

        if (payment) {
          const targetStatus = transitionPaymentStatus(payment.status as any, 'FAILED');
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: targetStatus,
              failureCode: 'CAPTURE_DENIED',
              failureMessage: resource.status_details?.reason ?? 'Payment capture was denied by PayPal.',
            },
          });

          await this.prisma.agentActivity.create({
            data: {
              userId: payment.userId,
              planId: payment.planId,
              paymentId: payment.id,
              type: 'PAYMENT_FAILED',
              title: 'PayPal payment denied',
              description: `Authoritative webhook signaled payment denial for ${captureId}.`,
              metadata: { eventId, eventType },
            },
          });
        }
      }

      await this.prisma.webhookEvent.update({
        where: { id: webhookRecord.id },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });

      return { status: 'processed', eventId };
    } catch (err: any) {
      this.logger.error(`Failed processing webhook event ${eventId}`, err);
      await this.prisma.webhookEvent.update({
        where: { id: webhookRecord.id },
        data: { status: 'FAILED', failureReason: err?.message ?? 'Unknown processing error' },
      });
      throw err;
    }
  }
}

