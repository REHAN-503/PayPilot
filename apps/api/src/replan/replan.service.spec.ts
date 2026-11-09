import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ReplanService } from './replan.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('ReplanService autoReplan()', () => {
  let service: ReplanService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      purchasePlan: {
        findFirst: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      userPolicy: {
        upsert: vi.fn(),
      },
      transaction: {
        findMany: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
      },
      purchaseIntent: {
        update: vi.fn(),
      },
      agentActivity: {
        create: vi.fn(),
      },
      riskAssessment: {
        create: vi.fn(),
      },
      approval: {
        create: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(mockPrisma)),
    };

    service = new ReplanService(mockPrisma as unknown as PrismaService);
  });

  it('returns failure when purchase plan is not found', async () => {
    mockPrisma.purchasePlan.findFirst.mockResolvedValue(null);

    const result = await service.autoReplan('user-1', 'plan-999', ['Budget exceeded']);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('Purchase plan not found');
  });

  it('enforces max 2 auto-replans (versions count >= 3) and returns honest failure', async () => {
    mockPrisma.purchasePlan.findFirst.mockResolvedValue({
      id: 'plan-3',
      intentId: 'intent-1',
      version: 3,
      status: 'AWAITING_APPROVAL',
      items: [{ product: { category: 'Electronics' } }],
    });
    mockPrisma.purchasePlan.count.mockResolvedValue(3); // already 3 versions exist

    const result = await service.autoReplan('user-1', 'plan-3', ['Daily limit exceeded']);

    expect(result.success).toBe(false);
    expect(result.maxAttemptsReached).toBe(true);
    expect(result.reason).toContain('Maximum auto-replan attempts reached');
  });

  it('returns failure when no cheaper active product fits within effective budget', async () => {
    mockPrisma.purchasePlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      intentId: 'intent-1',
      version: 1,
      status: 'AWAITING_APPROVAL',
      total: '250.00',
      items: [
        {
          productId: 'prod-expensive',
          productName: 'Ultra 4K Monitor',
          quantity: 1,
          product: { category: 'Electronics' },
        },
      ],
    });
    mockPrisma.purchasePlan.count.mockResolvedValue(1);

    mockPrisma.userPolicy.upsert.mockResolvedValue({
      currency: 'USD',
      autonomyMode: 'AUTO_WITHIN_LIMITS',
      maxTransactionAmount: 200,
      dailySpendingLimit: 500,
      monthlySpendingLimit: 2000,
      requireApprovalAbove: 150,
      allowAutoExecute: true,
      allowedCategories: [],
      blockedCategories: [],
      autoApproveCategories: [],
    });

    mockPrisma.transaction.findMany.mockResolvedValue([]); // 0 spent
    mockPrisma.product.findMany.mockResolvedValue([]); // no products <= 200

    const result = await service.autoReplan('user-1', 'plan-1', ['Exceeds maxTransactionAmount $200']);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('No alternative products in category');
  });

  it('successfully auto-replans with cheaper substitution and creates version+1 plan', async () => {
    const currentPlan = {
      id: 'plan-1',
      intentId: 'intent-1',
      version: 1,
      status: 'AWAITING_APPROVAL',
      total: '250.00',
      items: [
        {
          productId: 'prod-1',
          productName: 'Ultra 4K Monitor 27"',
          productSku: 'ELEC-001',
          quantity: 1,
          product: { category: 'Electronics' },
        },
      ],
      intent: { category: 'Electronics' },
    };

    mockPrisma.purchasePlan.findFirst.mockResolvedValue(currentPlan);
    mockPrisma.purchasePlan.count.mockResolvedValue(1);

    mockPrisma.userPolicy.upsert.mockResolvedValue({
      currency: 'USD',
      autonomyMode: 'AUTO_WITHIN_LIMITS',
      maxTransactionAmount: 200,
      dailySpendingLimit: 500,
      monthlySpendingLimit: 2000,
      requireApprovalAbove: 150,
      allowAutoExecute: true,
      allowedCategories: [],
      blockedCategories: [],
      autoApproveCategories: [],
    });

    mockPrisma.transaction.findMany.mockResolvedValue([]);

    const cheaperProduct = {
      id: 'prod-cheaper',
      name: 'ClearView HD Monitor 24"',
      sku: 'ELEC-009',
      price: '179.99',
      category: 'Electronics',
      status: 'ACTIVE',
      stock: 15,
    };
    mockPrisma.product.findMany.mockResolvedValue([cheaperProduct]);

    const createdPlan = {
      id: 'plan-2',
      version: 2,
      status: 'AWAITING_APPROVAL',
      total: '179.99',
      subtotal: '179.99',
      currency: 'USD',
      items: [
        {
          productId: cheaperProduct.id,
          productName: cheaperProduct.name,
          quantity: 1,
          unitPrice: '179.99',
        },
      ],
    };
    mockPrisma.purchasePlan.create.mockResolvedValue(createdPlan);
    mockPrisma.riskAssessment.create.mockResolvedValue({ id: 'risk-2', score: 10, level: 'LOW' });
    mockPrisma.approval.create.mockResolvedValue({ id: 'appr-2', status: 'PENDING' });
    mockPrisma.agentActivity.create.mockResolvedValue({ id: 'act-1' });

    const emittedActivities: any[] = [];
    const result = await service.autoReplan(
      'user-1',
      'plan-1',
      ['Plan total of $250.00 exceeds limit of $200.00'],
      (act) => emittedActivities.push(act),
    );

    expect(result.success).toBe(true);
    expect(result.tradeoffs).toBeDefined();
    expect(result.tradeoffs![0]).toContain('savings');

    // 1. Old plan updated to REJECTED
    expect(mockPrisma.purchasePlan.update).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      data: { status: 'REJECTED' },
    });

    // 2. New plan created with version 2
    expect(mockPrisma.purchasePlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: 2,
          total: '179.99',
          intentId: 'intent-1',
        }),
      }),
    );

    // 3. Emitted activities
    expect(mockPrisma.agentActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'BUDGET_REPLANNED',
        }),
      }),
    );

    expect(mockPrisma.agentActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'REPLAN_PROPOSED',
        }),
      }),
    );

    expect(emittedActivities.length).toBeGreaterThanOrEqual(2);
  });
});

