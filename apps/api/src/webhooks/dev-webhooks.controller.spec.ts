import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevWebhooksController } from './dev-webhooks.controller.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { WebhooksService } from './webhooks.service.js';

describe('DevWebhooksController Security and Behavior', () => {
  let mockPrisma: any;
  let mockWebhooksService: any;

  beforeEach(() => {
    mockPrisma = {
      payment: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      webhookEvent: {
        upsert: vi.fn(),
      },
    };

    mockWebhooksService = {
      handleWebhook: vi.fn(),
    };
  });

  it('rejects simulation in production environment even if DEMO_MODE=true', async () => {
    const config = new ConfigService({
      NODE_ENV: 'production',
      DEMO_MODE: 'true',
    });
    const controller = new DevWebhooksController(
      config,
      mockPrisma as unknown as PrismaService,
      mockWebhooksService as unknown as WebhooksService,
    );

    await expect(
      controller.simulate({ eventType: 'PAYMENT.CAPTURE.COMPLETED' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects simulation when DEMO_MODE is not "true" in non-production environment', async () => {
    const config = new ConfigService({
      NODE_ENV: 'development',
      DEMO_MODE: 'false',
    });
    const controller = new DevWebhooksController(
      config,
      mockPrisma as unknown as PrismaService,
      mockWebhooksService as unknown as WebhooksService,
    );

    await expect(
      controller.simulate({ eventType: 'PAYMENT.CAPTURE.COMPLETED' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects simulation when eventType is missing', async () => {
    const config = new ConfigService({
      NODE_ENV: 'development',
      DEMO_MODE: 'true',
    });
    const controller = new DevWebhooksController(
      config,
      mockPrisma as unknown as PrismaService,
      mockWebhooksService as unknown as WebhooksService,
    );

    await expect(
      controller.simulate({} as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows simulation in dev environment when DEMO_MODE=true and passes skipVerification: true', async () => {
    const config = new ConfigService({
      NODE_ENV: 'development',
      DEMO_MODE: 'true',
    });
    const controller = new DevWebhooksController(
      config,
      mockPrisma as unknown as PrismaService,
      mockWebhooksService as unknown as WebhooksService,
    );

    mockPrisma.payment.findFirst.mockResolvedValue({
      id: 'pay-test-1',
      amount: '99.00',
      paypalOrderId: 'ORD-TEST-1',
    });

    mockWebhooksService.handleWebhook.mockResolvedValue({
      status: 'processed',
      eventId: 'SIM-EVT-123',
    });

    const res = await controller.simulate({ eventType: 'CHECKOUT.ORDER.APPROVED' });

    expect(res.simulator).toBe(true);
    expect(res.paymentId).toBe('pay-test-1');
    expect(mockWebhooksService.handleWebhook).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        event_type: 'CHECKOUT.ORDER.APPROVED',
      }),
      { skipVerification: true },
    );
  });

  it('handles duplicate replay simulation in dev environment and passes skipVerification: true', async () => {
    const config = new ConfigService({
      NODE_ENV: 'development',
      DEMO_MODE: 'true',
    });
    const controller = new DevWebhooksController(
      config,
      mockPrisma as unknown as PrismaService,
      mockWebhooksService as unknown as WebhooksService,
    );

    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockWebhooksService.handleWebhook.mockResolvedValue({
      status: 'ignored',
      reason: 'WEBHOOK_DUPLICATE_IGNORED',
    });

    const res = await controller.simulate({
      eventType: 'duplicate',
      duplicateEventId: 'DUP-123',
      captureId: 'CAP-DUP',
    });

    expect(res.replayedDuplicate).toBe(true);
    expect(mockWebhooksService.handleWebhook).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        id: 'DUP-123',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
      }),
      { skipVerification: true },
    );
  });
});

