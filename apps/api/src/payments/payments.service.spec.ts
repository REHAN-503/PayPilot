import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PayPalService } from './paypal.service.js';

describe('PaymentsService Gating & Security', () => {
  let service: PaymentsService;
  let prisma: {
    purchasePlan: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    purchaseIntent: { update: ReturnType<typeof vi.fn> };
    payment: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    transaction: { create: ReturnType<typeof vi.fn> };
    agentActivity: { create: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let paypal: {
    createOrder: ReturnType<typeof vi.fn>;
    captureOrder: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    prisma = {
      purchasePlan: { findFirst: vi.fn(), update: vi.fn() },
      purchaseIntent: { update: vi.fn() },
      payment: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
      transaction: { create: vi.fn() },
      agentActivity: { create: vi.fn() },
      $transaction: vi.fn((fn) => (typeof fn === 'function' ? fn(prisma) : Promise.all(fn))),
    };

    paypal = {
      createOrder: vi.fn(),
      captureOrder: vi.fn(),
    };

    service = new PaymentsService(
      prisma as unknown as PrismaService,
      paypal as unknown as PayPalService,
    );
  });

  it('rejects order creation if plan is not in APPROVED state', async () => {
    prisma.purchasePlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      userId: 'user-1',
      status: 'AWAITING_APPROVAL', // Not approved!
      total: '189.99',
      subtotal: '189.99',
      items: [],
      riskAssessments: [{ policyPassed: true }],
      intent: { id: 'intent-1' },
    });

    await expect(service.createPaymentOrder('user-1', 'plan-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(paypal.createOrder).not.toHaveBeenCalled();
  });

  it('rejects order creation if plan failed policy check', async () => {
    prisma.purchasePlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      userId: 'user-1',
      status: 'APPROVED',
      total: '189.99',
      subtotal: '189.99',
      items: [],
      riskAssessments: [{ policyPassed: false }], // Policy check failed!
      intent: { id: 'intent-1' },
    });

    await expect(service.createPaymentOrder('user-1', 'plan-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(paypal.createOrder).not.toHaveBeenCalled();
  });

  it('allows order creation when plan is APPROVED and policy passed', async () => {
    prisma.purchasePlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      userId: 'user-1',
      status: 'APPROVED',
      total: '189.99',
      subtotal: '189.99',
      items: [{ productName: 'SonicBuds Pro 2', productSku: 'ELEC-002', unitPrice: '189.99', quantity: 1 }],
      riskAssessments: [{ policyPassed: true }],
      intent: { id: 'intent-1', status: 'APPROVED' },
    });
    prisma.payment.findFirst.mockResolvedValue(null);
    paypal.createOrder.mockResolvedValue({
      id: 'MOCK-ORDER-123',
      status: 'CREATED',
      approveUrl: 'https://sandbox.paypal.com/approve',
    });
    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      paypalOrderId: 'MOCK-ORDER-123',
    });

    const result = await service.createPaymentOrder('user-1', 'plan-1');

    expect(paypal.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: 'plan-1',
        total: 189.99,
        subtotal: 189.99,
      }),
    );
    expect(result.orderId).toBe('MOCK-ORDER-123');
  });

  it('throws NotFoundException when capturing non-existent payment', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);

    await expect(service.capturePayment('user-1', 'nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });
});

