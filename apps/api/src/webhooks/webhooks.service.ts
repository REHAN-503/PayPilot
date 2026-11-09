import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PayPalClient } from '../paypal/paypal.client.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { canProgressPaymentStatus, type PaymentStatus } from '../payments/payment.sm.js';
import { assertPlanTransition, type PlanStatus } from '../state-machines/plan.sm.js';
import { assertIntentTransition, type IntentStatus } from '../state-machines/intent.sm.js';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly paypalClient: PayPalClient,
    private readonly ledgerService: LedgerService,
  ) {}

  async handleWebhook(
    headers: WebhookHeaders,
    payload: any,
    options?: { skipVerification?: boolean; rawBody?: string },
  ) {
    // 1. Verify signature using PayPalClient
    const isValid = await this.paypalClient.verifyWebhookSignature({
      authAlgo: headers.authAlgo || '',
      certUrl: headers.certUrl || '',
      transmissionId: headers.transmissionId || '',
      transmissionSig: headers.transmissionSig || '',
      transmissionTime: headers.transmissionTime || '',
      webhookEvent: payload,
      rawBody: options?.rawBody,
      skipVerification: options?.skipVerification,
    });

    if (!isValid) {
      this.logger.warn(
        `[WebhooksService] Rejected unverified PayPal webhook signature (TransmissionId: ${headers.transmissionId})`,
      );
      throw new UnauthorizedException('Invalid PayPal webhook signature');
    }

    const eventId = payload.id ?? `evt-${Date.now()}`;
    const eventType = payload.event_type ?? 'UNKNOWN';
    const resource = payload.resource ?? {};

    // 2. Webhook idempotency: Deduplication on unique WebhookEvent.eventId
    const existingEvent = await this.prisma.webhookEvent.findUnique({
      where: { eventId },
    });

    if (existingEvent) {
      this.logger.warn(`[WebhooksService] WEBHOOK_DUPLICATE_IGNORED: Event ${eventId} already processed.`);
      // Emit duplicate activity if payment/plan can be linked
      const relatedPayment = await this.findRelatedPayment(resource);
      if (relatedPayment) {
        await this.prisma.agentActivity.create({
          data: {
            userId: relatedPayment.userId,
            paymentId: relatedPayment.id,
            planId: relatedPayment.planId,
            type: 'SYSTEM_EVENT',
            actor: 'AGENT',
            title: 'WEBHOOK_DUPLICATE_IGNORED',
            description: `Duplicate webhook event '${eventId}' (${eventType}) acknowledged and ignored. Ledger remains idempotent.`,
            metadata: { eventId, eventType },
          },
        });
      }

      return { status: 'ignored', reason: 'WEBHOOK_DUPLICATE_IGNORED', eventId };
    }

    // 3. Record WebhookEvent in DB with status PROCESSING
    const webhookRecord = await this.prisma.webhookEvent.create({
      data: {
        eventId,
        eventType,
        resourceId: resource.id ?? null,
        status: 'PROCESSING',
        payload: payload as any,
      },
    });

    // 4. Process event in a transaction
    try {
      await this.prisma.$transaction(async (tx) => {
        const payment = await this.findRelatedPayment(resource, tx);

        if (!payment) {
          this.logger.warn(
            `[WebhooksService] No matching payment record found for event ${eventId} (${eventType}) with resource id ${resource.id}`,
          );
          return;
        }

        const now = new Date();

        switch (eventType) {
          case 'CHECKOUT.ORDER.APPROVED': {
            if (canProgressPaymentStatus(payment.status as PaymentStatus, 'APPROVED')) {
              await tx.payment.update({
                where: { id: payment.id },
                data: {
                  status: 'APPROVED',
                  approvedAt: now,
                },
              });

              await tx.agentActivity.create({
                data: {
                  userId: payment.userId,
                  planId: payment.planId,
                  paymentId: payment.id,
                  type: 'WEBHOOK_RECEIVED',
                  actor: 'AGENT',
                  title: 'PayPal order approved by buyer',
                  description: `Authoritative webhook confirmed order approval for ${payment.paypalOrderId}.`,
                  metadata: { eventId, eventType, orderId: payment.paypalOrderId },
                },
              });
            } else {
              this.logger.warn(
                `[WebhooksService] Ignored out-of-order CHECKOUT.ORDER.APPROVED for payment ${payment.id} in status ${payment.status}`,
              );
            }
            break;
          }

          case 'PAYMENT.CAPTURE.PENDING': {
            if (canProgressPaymentStatus(payment.status as PaymentStatus, 'CAPTURE_PENDING')) {
              await tx.payment.update({
                where: { id: payment.id },
                data: { status: 'CAPTURE_PENDING' },
              });

              await tx.agentActivity.create({
                data: {
                  userId: payment.userId,
                  planId: payment.planId,
                  paymentId: payment.id,
                  type: 'WEBHOOK_RECEIVED',
                  actor: 'AGENT',
                  title: 'Payment capture pending',
                  description: `PayPal capture is pending authorization (Capture ID: ${resource.id}).`,
                  metadata: { eventId, eventType, captureId: resource.id },
                },
              });
            }
            break;
          }

          case 'PAYMENT.CAPTURE.COMPLETED': {
            const captureId = resource.id;

            // Out-of-order protection: only progress if legal
            if (canProgressPaymentStatus(payment.status as PaymentStatus, 'CAPTURED')) {
              await tx.payment.update({
                where: { id: payment.id },
                data: {
                  status: 'CAPTURED',
                  paypalCaptureId: captureId,
                  capturedAt: now,
                  webhookConfirmedAt: now, // The authoritative webhook badge!
                },
              });

              // Append-only ledger recording
              await this.ledgerService.record(
                {
                  type: 'PAYMENT_CAPTURED',
                  userId: payment.userId,
                  paymentId: payment.id,
                  amount: payment.amount,
                  currency: 'USD',
                  externalReference: captureId,
                  idempotencyKey: `${captureId}:PAYMENT_CAPTURED`,
                  description: `Authoritative PayPal webhook capture confirmed: ${captureId}`,
                  metadata: { eventId, eventType, captureId },
                },
                tx,
              );

              // Transition Plan & Intent to COMPLETED
              if (payment.plan) {
                if (payment.plan.status !== 'COMPLETED') {
                  assertPlanTransition(payment.plan.status as PlanStatus, 'COMPLETED');
                  await tx.purchasePlan.update({
                    where: { id: payment.planId },
                    data: { status: 'COMPLETED' },
                  });
                }

                if (payment.plan.intent && payment.plan.intent.status !== 'COMPLETED') {
                  assertIntentTransition(payment.plan.intent.status as IntentStatus, 'COMPLETED');
                  await tx.purchaseIntent.update({
                    where: { id: payment.plan.intentId },
                    data: { status: 'COMPLETED' },
                  });
                }
              }

              await tx.agentActivity.create({
                data: {
                  userId: payment.userId,
                  intentId: payment.plan?.intentId,
                  planId: payment.planId,
                  paymentId: payment.id,
                  type: 'WEBHOOK_RECEIVED',
                  actor: 'AGENT',
                  title: 'Payment confirmed via PayPal webhook',
                  description: `Authoritative capture verified: ${captureId}. Transaction recorded in immutable ledger.`,
                  metadata: { eventId, eventType, captureId },
                },
              });
            } else if (payment.status === 'CAPTURED' && !payment.webhookConfirmedAt) {
              // If captured via API earlier, stamp the authoritative webhook confirmation timestamp
              await tx.payment.update({
                where: { id: payment.id },
                data: { webhookConfirmedAt: now },
              });
            }
            break;
          }

          case 'PAYMENT.CAPTURE.DENIED':
          case 'PAYMENT.CAPTURE.DECLINED': {
            const captureId = resource.id;

            if (canProgressPaymentStatus(payment.status as PaymentStatus, 'FAILED')) {
              await tx.payment.update({
                where: { id: payment.id },
                data: {
                  status: 'FAILED',
                  failureCode: 'CAPTURE_DENIED',
                  failureMessage: resource.status_details?.reason || 'Payment capture denied by PayPal.',
                },
              });

              await this.ledgerService.record(
                {
                  type: 'PAYMENT_FAILED',
                  userId: payment.userId,
                  paymentId: payment.id,
                  amount: payment.amount,
                  currency: 'USD',
                  externalReference: captureId,
                  idempotencyKey: `${captureId}:PAYMENT_FAILED`,
                  description: `PayPal payment capture denied: ${captureId}`,
                  metadata: { eventId, eventType, reason: resource.status_details?.reason },
                },
                tx,
              );

              if (payment.plan && payment.plan.status !== 'FAILED') {
                assertPlanTransition(payment.plan.status as PlanStatus, 'FAILED');
                await tx.purchasePlan.update({
                  where: { id: payment.planId },
                  data: { status: 'FAILED' },
                });
              }

              await tx.agentActivity.create({
                data: {
                  userId: payment.userId,
                  intentId: payment.plan?.intentId,
                  planId: payment.planId,
                  paymentId: payment.id,
                  type: 'PAYMENT_FAILED',
                  actor: 'AGENT',
                  title: 'PayPal payment denied',
                  description: `Authoritative webhook signaled payment denial for ${captureId}.`,
                  metadata: { eventId, eventType, reason: resource.status_details?.reason },
                },
              });
            }
            break;
          }

          case 'PAYMENT.CAPTURE.REVERSED': {
            const captureId = resource.id;

            if (canProgressPaymentStatus(payment.status as PaymentStatus, 'REVERSED')) {
              await tx.payment.update({
                where: { id: payment.id },
                data: { status: 'REVERSED' },
              });

              await this.ledgerService.record(
                {
                  type: 'REVERSAL',
                  userId: payment.userId,
                  paymentId: payment.id,
                  amount: payment.amount,
                  currency: 'USD',
                  externalReference: captureId,
                  idempotencyKey: `${captureId}:REVERSAL`,
                  description: `PayPal capture reversed: ${captureId}`,
                  metadata: { eventId, eventType },
                },
                tx,
              );

              await tx.agentActivity.create({
                data: {
                  userId: payment.userId,
                  intentId: payment.plan?.intentId,
                  planId: payment.planId,
                  paymentId: payment.id,
                  type: 'SYSTEM_EVENT',
                  actor: 'AGENT',
                  title: 'Payment reversed by PayPal',
                  description: `PayPal reversed payment capture ${captureId}. Recorded to ledger.`,
                  metadata: { eventId, eventType },
                },
              });
            }
            break;
          }

          case 'PAYMENT.CAPTURE.REFUNDED': {
            const refundId = resource.id;
            const refundAmount = resource.amount?.value || payment.amount;

            if (canProgressPaymentStatus(payment.status as PaymentStatus, 'REFUNDED')) {
              await tx.payment.update({
                where: { id: payment.id },
                data: { status: 'REFUNDED', refundedAt: now },
              });

              await this.ledgerService.record(
                {
                  type: 'REFUND',
                  userId: payment.userId,
                  paymentId: payment.id,
                  amount: refundAmount,
                  currency: 'USD',
                  externalReference: refundId,
                  idempotencyKey: `${refundId}:REFUND`,
                  description: `PayPal capture refunded: ${refundId}`,
                  metadata: { eventId, eventType, refundAmount },
                },
                tx,
              );

              await tx.agentActivity.create({
                data: {
                  userId: payment.userId,
                  intentId: payment.plan?.intentId,
                  planId: payment.planId,
                  paymentId: payment.id,
                  type: 'SYSTEM_EVENT',
                  actor: 'AGENT',
                  title: 'Payment refunded by PayPal',
                  description: `Refund ${refundId} issued for $${refundAmount}. Recorded to ledger.`,
                  metadata: { eventId, eventType },
                },
              });
            }
            break;
          }

          default:
            this.logger.log(`[WebhooksService] Unhandled PayPal webhook event type: ${eventType}`);
        }
      });

      // Mark webhook record PROCESSED
      await this.prisma.webhookEvent.update({
        where: { id: webhookRecord.id },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });

      return { status: 'processed', eventId, eventType };
    } catch (err: any) {
      this.logger.error(`[WebhooksService] Error processing webhook event ${eventId}: ${err.message}`, err);
      await this.prisma.webhookEvent.update({
        where: { id: webhookRecord.id },
        data: { status: 'FAILED', failureReason: err.message },
      });
      throw err;
    }
  }

  private async findRelatedPayment(resource: any, txClient?: any) {
    const client = txClient || this.prisma;
    const customId = resource.custom_id || resource.invoice_id;
    const relatedOrderId = resource.supplementary_data?.related_ids?.order_id;
    const resourceId = resource.id;

    // Search by custom_id (payment ID), paypalOrderId, or paypalCaptureId
    return client.payment.findFirst({
      where: {
        OR: [
          ...(customId ? [{ id: customId }] : []),
          ...(relatedOrderId ? [{ paypalOrderId: relatedOrderId }] : []),
          ...(resourceId
            ? [{ paypalOrderId: resourceId }, { paypalCaptureId: resourceId }]
            : []),
        ],
      },
      include: {
        plan: {
          include: { intent: true },
        },
      },
    });
  }
}

