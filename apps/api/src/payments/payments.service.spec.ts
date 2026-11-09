import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PayPalClient } from '../paypal/paypal.client.js';
import type { LedgerService } from '../ledger/ledger.service.js';

describe('PaymentsService Gating & Security', () => {
  let service: PaymentsService;
  let prisma: any;
  let paypalClient: any;
  let ledgerService: any;

  beforeEach(() => {
    prisma = {
      purchasePlan: { findFirst: vi.fn(), update: vi.fn() },
      purchaseIntent: { update: vi.fn() },
      payment: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      userPolicy: {
        upsert: vi.fn().mockResolvedValue({
          currency: 'USD',
          autonomyMode: 'AUTO_WITHIN_LIMITS',
          maxTransactionAmount: 500,
          dailySpendingLimit: 1000,
          monthlySpendingLimit: 5000,
          allowAutoExecute: true,
        }),
      },
      transaction: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
      agentActivity: { create: vi.fn() },
      $transaction: vi.fn((fn) => (typeof fn === 'function' ? fn(prisma) : Promise.all(fn))),
    };

    paypalClient = {
      createOrder: vi.fn(),
      captureOrder: vi.fn(),
      getOrder: vi.fn(),
    };

    ledgerService = {
      record: vi.fn(),
    };

    service = new PaymentsService(
      prisma as unknown as PrismaService,
      paypalClient as unknown as PayPalClient,
      ledgerService as unknown as LedgerService,
    );
  });

  it('rejects order creation if plan is not in APPROVED state', async () => {
    prisma.purchasePlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      userId: 'user-1',
      status: 'AWAITING_APPROVAL',
      total: '189.99',
      subtotal: '189.99',
      items: [],
      riskAssessments: [{ policyPassed: true }],
      approvals: [{ id: 'appr-1', status: 'PENDING' }],
      intent: { id: 'intent-1' },
    });

    await expect(service.createPaymentOrder('user-1', 'plan-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(paypalClient.createOrder).not.toHaveBeenCalled();
    expect(prisma.agentActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'FORBIDDEN_ACTION_BLOCKED',
        }),
      }),
    );
  });

  it('rejects order creation if plan is expired', async () => {
    prisma.purchasePlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      userId: 'user-1',
      status: 'APPROVED',
      expiresAt: new Date(Date.now() - 60000), // expired 1m ago
      total: '189.99',
      subtotal: '189.99',
      items: [],
      riskAssessments: [{ policyPassed: true }],
      approvals: [{ id: 'appr-1', status: 'APPROVED' }],
      intent: { id: 'intent-1' },
    });

    await expect(service.createPaymentOrder('user-1', 'plan-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(paypalClient.createOrder).not.toHaveBeenCalled();
  });

  it('strictly recomputes amounts from DB catalog items (ignoring client or stale values)', async () => {
    prisma.purchasePlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      userId: 'user-1',
      status: 'APPROVED',
      total: '10.00', // Stale or tampered header total!
      subtotal: '10.00',
      items: [
        {
          productName: 'Developer Monitor',
          productSku: 'ELEC-006',
          unitPrice: '229.99',
          quantity: 2,
          product: { category: 'Electronics', stock: 10, status: 'ACTIVE' },
        },
      ],
      riskAssessments: [{ policyPassed: true }],
      approvals: [{ id: 'appr-1', status: 'APPROVED' }],
      intent: { id: 'intent-1', status: 'APPROVED' },
    });

    prisma.payment.findUnique.mockResolvedValue(null);
    prisma.payment.upsert.mockResolvedValue({
      id: 'pay-1',
      amount: '459.98',
    });

    paypalClient.createOrder.mockResolvedValue({
      id: 'ORDER-12345',
      status: 'CREATED',
      links: [{ rel: 'approve', href: 'https://sandbox.paypal.com/checkout' }],
    });

    prisma.payment.update.mockResolvedValue({ id: 'pay-1', status: 'PAYER_ACTION_REQUIRED' });
    prisma.purchasePlan.update.mockResolvedValue({});
    prisma.purchaseIntent.update.mockResolvedValue({});

    await service.createPaymentOrder('user-1', 'plan-1');

    // 229.99 * 2 = 459.98 recomputed from DB items!
    expect(paypalClient.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 459.98,
        subtotal: 459.98,
        items: expect.arrayContaining([
          expect.objectContaining({ unitPrice: 229.99, quantity: 2 }),
        ]),
      }),
    );
  });

  it('rejects capture when provided orderId does not match payment', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-1',
      userId: 'user-1',
      status: 'PAYER_ACTION_REQUIRED',
      paypalOrderId: 'CORRECT-ORDER-ID',
      plan: { items: [], intent: {} },
    });

    await expect(
      service.capturePayment('user-1', 'pay-1', 'FOREIGN-ORDER-ID'),
    ).rejects.toThrow(BadRequestException);
  });

  it('exposes recommendedNextAction on findOne', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-failed',
      userId: 'user-1',
      status: 'FAILED',
      updatedAt: new Date(),
      transactions: [],
      activities: [],
      plan: { items: [] },
    });

    const result = await service.findOne('user-1', 'pay-failed');
    expect(result.recommendedNextAction).toBe('RETRY_PAYMENT');
  });

  it('throws NotFoundException when capturing non-existent payment', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);

    await expect(service.capturePayment('user-1', 'nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });
});

