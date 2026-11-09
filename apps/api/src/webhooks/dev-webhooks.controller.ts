import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../prisma/prisma.service.js';
import { WebhooksService } from './webhooks.service.js';

export interface SimulateWebhookDto {
  eventType:
    | 'PAYMENT.CAPTURE.COMPLETED'
    | 'PAYMENT.CAPTURE.DENIED'
    | 'PAYMENT.CAPTURE.REVERSED'
    | 'PAYMENT.CAPTURE.REFUNDED'
    | 'CHECKOUT.ORDER.APPROVED'
    | 'duplicate';
  paymentId?: string;
  orderId?: string;
  captureId?: string;
  amount?: string;
  duplicateEventId?: string;
}

@Controller('dev/webhooks')
@AllowAnonymous()
export class DevWebhooksController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly webhooksService: WebhooksService,
  ) {}

  @Post('simulate')
  async simulate(@Body() body: SimulateWebhookDto) {
    const nodeEnv = this.config.get<string>('NODE_ENV');
    const demoMode = this.config.get<string>('DEMO_MODE') === 'true';

    if (nodeEnv === 'production' || !demoMode) {
      throw new ForbiddenException(
        'Webhook simulation endpoint is disabled in production and non-demo environments.',
      );
    }

    if (!body || !body.eventType) {
      throw new BadRequestException('eventType is required for simulation');
    }

    // 1. Duplicate replay test
    if (body.eventType === 'duplicate') {
      const targetEventId = body.duplicateEventId || 'SIM-DUP-EVENT-001';
      // Ensure the event already exists in DB
      await this.prisma.webhookEvent.upsert({
        where: { eventId: targetEventId },
        create: {
          eventId: targetEventId,
          eventType: 'PAYMENT.CAPTURE.COMPLETED',
          status: 'PROCESSED',
          payload: { simulated: true },
        },
        update: {},
      });

      const result = await this.webhooksService.handleWebhook(
        { transmissionId: `SIM-DUP-${Date.now()}`, transmissionTime: new Date().toISOString() },
        {
          id: targetEventId,
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: { id: body.captureId || 'SIM-CAP-DUP' },
        },
        { skipVerification: true },
      );

      return {
        simulator: true,
        flag: 'Sandbox simulator',
        replayedDuplicate: true,
        eventId: targetEventId,
        result,
      };
    }

    // 2. Locate target payment
    const payment = body.paymentId
      ? await this.prisma.payment.findUnique({ where: { id: body.paymentId } })
      : await this.prisma.payment.findFirst({
          orderBy: { createdAt: 'desc' },
        });

    if (!payment) {
      throw new BadRequestException(
        'No payment found in database to simulate webhook against. Create a plan and initiate payment first.',
      );
    }

    const eventId = `SIM-EVT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const captureId = body.captureId || `SIM-CAP-${Date.now()}`;
    const orderId = body.orderId || payment.paypalOrderId || `SIM-ORD-${Date.now()}`;
    const amount = body.amount || payment.amount.toString();

    let resource: Record<string, any> = {};

    switch (body.eventType) {
      case 'CHECKOUT.ORDER.APPROVED':
        resource = {
          id: orderId,
          custom_id: payment.id,
          status: 'APPROVED',
        };
        break;

      case 'PAYMENT.CAPTURE.COMPLETED':
        resource = {
          id: captureId,
          custom_id: payment.id,
          status: 'COMPLETED',
          amount: { currency_code: 'USD', value: amount },
          supplementary_data: { related_ids: { order_id: orderId } },
        };
        break;

      case 'PAYMENT.CAPTURE.DENIED':
        resource = {
          id: captureId,
          custom_id: payment.id,
          status: 'DENIED',
          status_details: { reason: 'INSTRUMENT_DECLINED' },
          supplementary_data: { related_ids: { order_id: orderId } },
        };
        break;

      case 'PAYMENT.CAPTURE.REVERSED':
        resource = {
          id: captureId,
          custom_id: payment.id,
          status: 'REVERSED',
          supplementary_data: { related_ids: { order_id: orderId } },
        };
        break;

      case 'PAYMENT.CAPTURE.REFUNDED':
        resource = {
          id: `SIM-REF-${Date.now()}`,
          custom_id: payment.id,
          status: 'COMPLETED',
          amount: { currency_code: 'USD', value: amount },
          supplementary_data: { related_ids: { order_id: orderId } },
        };
        break;
    }

    const payload = {
      id: eventId,
      event_type: body.eventType,
      create_time: new Date().toISOString(),
      resource,
    };

    const result = await this.webhooksService.handleWebhook(
      {
        transmissionId: `SIM-${Date.now()}`,
        transmissionTime: new Date().toISOString(),
      },
      payload,
      { skipVerification: true },
    );

    return {
      simulator: true,
      flag: 'Sandbox simulator',
      eventId,
      eventType: body.eventType,
      paymentId: payment.id,
      orderId,
      captureId,
      result,
    };
  }
}

