import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PlansService } from './plans.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ReplanService } from '../replan/replan.service.js';

describe('PlansService Governance & Approval Gates', () => {
  let service: PlansService;
  let mockPrisma: any;
  let mockReplan: any;

  beforeEach(() => {
    mockPrisma = {
      purchasePlan: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      userPolicy: {
        upsert: vi.fn(),
      },
      transaction: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      approval: {
        create: vi.fn(),
      },
      purchaseIntent: {
        update: vi.fn(),
      },
      agentActivity: {
        create: vi.fn(),
      },
      planItem: {
        deleteMany: vi.fn(),
        create: vi.fn(),
      },
      product: {
        findFirst: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(mockPrisma)),
    };

    mockReplan = {
      autoReplan: vi.fn(),
    };

    service = new PlansService(
      mockPrisma as unknown as PrismaService,
      mockReplan as unknown as ReplanService,
    );
  });

  it('returns historical spend and average in dollars, not cents', async () => {
    mockPrisma.transaction.findMany
      .mockResolvedValueOnce([{ amount: '12.34' }])
      .mockResolvedValueOnce([{ amount: '12.34' }, { amount: '0.66' }])
      .mockResolvedValueOnce([{ amount: '12.34' }, { amount: '0.66' }])
      .mockResolvedValueOnce([]);

    await expect(service.getHistoricalMetrics('user-1')).resolves.toMatchObject({
      dailySpent: 12.34,
      monthlySpent: 13,
      typicalSpendAverage: 6.5,
    });
  });

  describe('approvePlan()', () => {
    it('throws NotFoundException if plan does not exist', async () => {
      mockPrisma.purchasePlan.findFirst.mockResolvedValue(null);

      await expect(service.approvePlan('user-1', 'plan-999')).rejects.toThrow(NotFoundException);
    });

    it('rejects approval if plan is already expired', async () => {
      const expiredDate = new Date(Date.now() - 60 * 1000); // 1 minute in the past
      mockPrisma.purchasePlan.findFirst.mockResolvedValue({
        id: 'plan-1',
        userId: 'user-1',
        status: 'AWAITING_APPROVAL',
        expiresAt: expiredDate,
        items: [],
      });

      await expect(service.approvePlan('user-1', 'plan-1')).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.agentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'FORBIDDEN_ACTION_BLOCKED',
            title: expect.stringContaining('plan expired'),
          }),
        }),
      );
    });

    it('rejects approval if illegal transition (e.g. plan already COMPLETED)', async () => {
      mockPrisma.purchasePlan.findFirst.mockResolvedValue({
        id: 'plan-1',
        userId: 'user-1',
        status: 'COMPLETED', // Terminal state!
        items: [],
      });

      await expect(service.approvePlan('user-1', 'plan-1')).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.agentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'FORBIDDEN_ACTION_BLOCKED',
          }),
        }),
      );
    });

    it('re-evaluates at approval time and blocks if policy limits are now breached', async () => {
      mockPrisma.purchasePlan.findFirst.mockResolvedValue({
        id: 'plan-1',
        userId: 'user-1',
        status: 'AWAITING_APPROVAL',
        total: '350.00',
        currency: 'USD',
        items: [
          {
            quantity: 1,
            unitPrice: '350.00',
            product: { status: 'ACTIVE', stock: 10, price: '350.00', category: 'Electronics' },
          },
        ],
      });

      // User policy has maxTransactionAmount = 300 (stricter than total $350)
      mockPrisma.userPolicy.upsert.mockResolvedValue({
        currency: 'USD',
        autonomyMode: 'MANUAL_APPROVAL',
        maxTransactionAmount: 300,
        dailySpendingLimit: 1000,
        monthlySpendingLimit: 5000,
        allowAutoExecute: false,
      });

      await expect(service.approvePlan('user-1', 'plan-1')).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.agentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'POLICY_BLOCKED',
          }),
        }),
      );
    });

    it('successfully approves valid plan, sets 10-minute expiry, and updates status to APPROVED', async () => {
      const plan = {
        id: 'plan-1',
        userId: 'user-1',
        intentId: 'intent-1',
        status: 'AWAITING_APPROVAL',
        total: '100.00',
        currency: 'USD',
        items: [
          {
            quantity: 1,
            unitPrice: '100.00',
            product: { status: 'ACTIVE', stock: 10, price: '100.00', category: 'Electronics' },
          },
        ],
        intent: { id: 'intent-1', status: 'AWAITING_APPROVAL' },
      };

      mockPrisma.purchasePlan.findFirst.mockResolvedValue(plan);

      mockPrisma.userPolicy.upsert.mockResolvedValue({
        currency: 'USD',
        autonomyMode: 'MANUAL_APPROVAL',
        maxTransactionAmount: 500,
        dailySpendingLimit: 1000,
        monthlySpendingLimit: 5000,
        allowAutoExecute: false,
      });

      mockPrisma.approval.create.mockResolvedValue({ id: 'appr-1', status: 'APPROVED' });
      mockPrisma.purchasePlan.update.mockResolvedValue({ ...plan, status: 'APPROVED' });
      mockPrisma.purchaseIntent.update.mockResolvedValue({ id: 'intent-1', status: 'APPROVED' });

      const approvedPlan = await service.approvePlan('user-1', 'plan-1', 'User confirmed purchase');

      expect(approvedPlan.status).toBe('APPROVED');

      // 1. Approval row created with 10-minute expiry
      expect(mockPrisma.approval.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'APPROVED',
            decisionNote: 'User confirmed purchase',
          }),
        }),
      );

      // 2. Plan updated to APPROVED with expiry
      expect(mockPrisma.purchasePlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'plan-1' },
          data: expect.objectContaining({
            status: 'APPROVED',
          }),
        }),
      );

      // 3. Activity recorded with actor: 'USER'
      expect(mockPrisma.agentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'APPROVAL_GRANTED',
            actor: 'USER',
          }),
        }),
      );
    });
  });

  describe('rejectPlan()', () => {
    it('successfully rejects plan and records rejection activity', async () => {
      const plan = {
        id: 'plan-1',
        userId: 'user-1',
        intentId: 'intent-1',
        status: 'AWAITING_APPROVAL',
      };
      mockPrisma.purchasePlan.findFirst.mockResolvedValue(plan);
      mockPrisma.purchasePlan.update.mockResolvedValue({ ...plan, status: 'REJECTED' });

      const rejected = await service.rejectPlan('user-1', 'plan-1', 'Too expensive');

      expect(rejected.status).toBe('REJECTED');
      expect(mockPrisma.approval.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REJECTED',
            decisionNote: 'Too expensive',
          }),
        }),
      );
      expect(mockPrisma.agentActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'APPROVAL_REJECTED',
            actor: 'USER',
          }),
        }),
      );
    });
  });
});

