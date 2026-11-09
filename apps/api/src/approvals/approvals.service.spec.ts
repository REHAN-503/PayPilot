import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApprovalsService } from './approvals.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('ApprovalsService Pure Workflow', () => {
  let service: ApprovalsService;
  let prisma: {
    approval: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    purchasePlan: { update: ReturnType<typeof vi.fn> };
    purchaseIntent: { update: ReturnType<typeof vi.fn> };
    agentActivity: { create: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    prisma = {
      approval: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
      purchasePlan: { update: vi.fn() },
      purchaseIntent: { update: vi.fn() },
      agentActivity: { create: vi.fn() },
      $transaction: vi.fn((fn) => (typeof fn === 'function' ? fn(prisma) : Promise.all(fn))),
    };

    service = new ApprovalsService(prisma as unknown as PrismaService);
  });

  it('rejects decisions on already approved requests', async () => {
    prisma.approval.findFirst.mockResolvedValue({
      id: 'appr-1',
      userId: 'user-1',
      status: 'APPROVED',
      plan: { status: 'APPROVED', intent: { status: 'APPROVED' } },
    });

    await expect(
      service.submitDecision('user-1', 'appr-1', { decision: 'APPROVED' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('transitions PENDING approval and plan to APPROVED', async () => {
    prisma.approval.findFirst.mockResolvedValue({
      id: 'appr-1',
      userId: 'user-1',
      planId: 'plan-1',
      status: 'PENDING',
      plan: {
        id: 'plan-1',
        intentId: 'intent-1',
        status: 'AWAITING_APPROVAL',
        intent: { id: 'intent-1', status: 'AWAITING_APPROVAL' },
      },
    });
    prisma.approval.update.mockResolvedValue({
      id: 'appr-1',
      status: 'APPROVED',
    });

    const result = await service.submitDecision('user-1', 'appr-1', {
      decision: 'APPROVED',
      note: 'Looks great, proceed with purchase.',
    });

    expect(prisma.approval.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED' }),
      }),
    );
    expect(prisma.purchasePlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED' }),
      }),
    );
    expect(prisma.agentActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'APPROVAL_GRANTED' }),
      }),
    );
    expect(result.status).toBe('APPROVED');
  });

  it('throws NotFoundException if approval does not exist', async () => {
    prisma.approval.findFirst.mockResolvedValue(null);

    await expect(
      service.submitDecision('user-1', 'invalid', { decision: 'REJECTED' }),
    ).rejects.toThrow(NotFoundException);
  });
});

