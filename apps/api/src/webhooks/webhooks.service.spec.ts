import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PayPalClient } from '../paypal/paypal.client.js';
import type { LedgerService } from '../ledger/ledger.service.js';

describe('WebhooksService Idempotency & Out-of-Order Security', () => {
  let service: WebhooksService;
  let mockPrisma: any;
  let mockPayPalClient: any;
  let mockLedgerService: any;

  beforeEach(() => {
    mockPrisma = {
      webhookEvent: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      payment: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      purchasePlan: {
        update: vi.fn(),
      },
      purchaseIntent: {
        update: vi.fn(),
      },
      agentActivity: {
        create: vi.fn(),
      },
      $transaction: vi.fn((fn) => (typeof fn === 'function' ? fn(mockPrisma) : Promise.all(fn))),
    };

    mockPayPalClient = {
      verifyWebhookSignature: vi.fn().mockResolvedValue(true),
    };

    mockLedgerService = {
      record: vi.fn().mockResolvedValue({ id: 'tx-1' }),
    };

    service = new WebhooksService(
      mockPrisma as unknown as PrismaService,
      mockPayPalClient as unknown as PayPalClient,
      mockLedgerService as unknown as LedgerService,
    );
  });

  it('rejects webhook with UnauthorizedException if signature verification fails', async () => {
    mockPayPalClient.verifyWebhookSignature.mockResolvedValue(false);

    await expect(
      service.handleWebhook(
        { transmissionSig: 'INVALID_SIGNATURE' },
        { id: 'EVT-123', event_type: 'PAYMENT.CAPTURE.COMPLETED' },
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('enforces webhook idempotency: duplicate eventId is acknowledged and ignored without duplicate ledger recording', async () => {
    mockPrisma.webhookEvent.findUnique.mockResolvedValue({
      id: 'existing-event-row',
      eventId: 'EVT-DUPLICATE-999',
      status: 'PROCESSED',
    });

    const result = await service.handleWebhook(
      { transmissionSig: 'VALID_SIG' },
      {
        id: 'EVT-DUPLICATE-999',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: { id: 'CAP-123', custom_id: 'pay-1' },
      },
    );

    expect(result.status).toBe('ignored');
    expect(result.reason).toBe('WEBHOOK_DUPLICATE_IGNORED');
    // Ensure no new webhookEvent row or ledger entry is written
    expect(mockPrisma.webhookEvent.create).not.toHaveBeenCalled();
    expect(mockLedgerService.record).not.toHaveBeenCalled();
  });

  it('settles PAYMENT.CAPTURE.COMPLETED: marks CAPTURED, stamps webhookConfirmedAt, appends to immutable ledger, completes plan & intent', async () => {
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null); // Fresh event
    mockPrisma.webhookEvent.create.mockResolvedValue({ id: 'wh-row-1' });

    const payment = {
      id: 'pay-1',
      userId: 'user-1',
      planId: 'plan-1',
      status: 'CAPTURE_PENDING',
      amount: '189.99',
      paypalOrderId: 'ORD-123',
      plan: {
        id: 'plan-1',
        status: 'EXECUTING',
        intentId: 'intent-1',
        intent: { id: 'intent-1', status: 'EXECUTING' },
      },
    };
    mockPrisma.payment.findFirst.mockResolvedValue(payment);

    const result = await service.handleWebhook(
      { transmissionSig: 'VALID_SIG' },
      {
        id: 'EVT-FRESH-001',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'CAP-999',
          custom_id: 'pay-1',
          status: 'COMPLETED',
          amount: { value: '189.99', currency_code: 'USD' },
        },
      },
    );

    expect(result.status).toBe('processed');

    // 1. Payment status set to CAPTURED with webhookConfirmedAt timestamp
    expect(mockPrisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({
          status: 'CAPTURED',
          paypalCaptureId: 'CAP-999',
          webhookConfirmedAt: expect.any(Date),
        }),
      }),
    );

    // 2. Immutable ledger row recorded with captureId idempotencyKey
    expect(mockLedgerService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PAYMENT_CAPTURED',
        paymentId: 'pay-1',
        idempotencyKey: 'CAP-999:PAYMENT_CAPTURED',
      }),
      mockPrisma,
    );

    // 3. Plan & Intent marked COMPLETED
    expect(mockPrisma.purchasePlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'plan-1' },
        data: { status: 'COMPLETED' },
      }),
    );
    expect(mockPrisma.purchaseIntent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'intent-1' },
        data: { status: 'COMPLETED' },
      }),
    );
  });

  it('prevents out-of-order webhook regression: CHECKOUT.ORDER.APPROVED arriving after payment is already CAPTURED does not regress state', async () => {
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.create.mockResolvedValue({ id: 'wh-row-2' });

    const alreadyCapturedPayment = {
      id: 'pay-captured',
      userId: 'user-1',
      status: 'CAPTURED', // Higher lifecycle rank!
      paypalOrderId: 'ORD-LATE',
      plan: { id: 'plan-1', status: 'COMPLETED' },
    };
    mockPrisma.payment.findFirst.mockResolvedValue(alreadyCapturedPayment);

    await service.handleWebhook(
      { transmissionSig: 'VALID_SIG' },
      {
        id: 'EVT-OUT-OF-ORDER',
        event_type: 'CHECKOUT.ORDER.APPROVED',
        resource: { id: 'ORD-LATE' },
      },
    );

    // Must NOT regress payment back to APPROVED
    expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    expect(mockLedgerService.record).not.toHaveBeenCalled();
  });

  it('handles PAYMENT.CAPTURE.DENIED: moves payment & plan to FAILED and records PAYMENT_FAILED ledger row', async () => {
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.create.mockResolvedValue({ id: 'wh-row-3' });

    const pendingPayment = {
      id: 'pay-denied',
      userId: 'user-1',
      planId: 'plan-1',
      status: 'CAPTURE_PENDING',
      amount: '189.99',
      plan: { id: 'plan-1', status: 'EXECUTING' },
    };
    mockPrisma.payment.findFirst.mockResolvedValue(pendingPayment);

    await service.handleWebhook(
      { transmissionSig: 'VALID_SIG' },
      {
        id: 'EVT-DENIED-001',
        event_type: 'PAYMENT.CAPTURE.DENIED',
        resource: {
          id: 'CAP-DENIED',
          custom_id: 'pay-denied',
          status_details: { reason: 'CARD_DECLINED' },
        },
      },
    );

    expect(mockPrisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-denied' },
        data: expect.objectContaining({
          status: 'FAILED',
          failureCode: 'CAPTURE_DENIED',
        }),
      }),
    );

    expect(mockLedgerService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PAYMENT_FAILED',
        paymentId: 'pay-denied',
        idempotencyKey: 'CAP-DENIED:PAYMENT_FAILED',
      }),
      mockPrisma,
    );

    expect(mockPrisma.purchasePlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'plan-1' },
        data: { status: 'FAILED' },
      }),
    );
  });
});

