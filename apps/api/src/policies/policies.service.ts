import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AutonomyMode } from './policy-engine.js';

export interface UpdatePolicyDto {
  autonomyMode?: AutonomyMode;
  maxTransactionAmount?: number | null;
  dailySpendingLimit?: number | null;
  monthlySpendingLimit?: number | null;
  requireApprovalAbove?: number | null;
  allowAutoExecute?: boolean;
  allowNegotiation?: boolean;
}

@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async getPolicy(userId: string) {
    const policy = await this.prisma.userPolicy.upsert({
      where: { userId },
      create: {
        userId,
        currency: 'USD',
        autonomyMode: 'ASK_EVERY_TIME',
        maxTransactionAmount: 250,
        dailySpendingLimit: 500,
        monthlySpendingLimit: 2000,
        requireApprovalAbove: 100,
        allowAutoExecute: false,
        allowNegotiation: false,
      },
      update: {},
    });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [dailyTx, monthlyTx] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          userId,
          type: 'PAYMENT_CAPTURED',
          createdAt: { gte: startOfDay },
        },
        select: { amount: true },
      }),
      this.prisma.transaction.findMany({
        where: {
          userId,
          type: 'PAYMENT_CAPTURED',
          createdAt: { gte: startOfMonth },
        },
        select: { amount: true },
      }),
    ]);

    const dailySpent = dailyTx.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const monthlySpent = monthlyTx.reduce((sum, tx) => sum + Number(tx.amount), 0);

    const dailyLimit = policy.dailySpendingLimit ? Number(policy.dailySpendingLimit) : null;
    const monthlyLimit = policy.monthlySpendingLimit ? Number(policy.monthlySpendingLimit) : null;

    return {
      policy,
      spendMetrics: {
        dailySpent,
        dailyLimit,
        dailyRemaining: dailyLimit !== null ? Math.max(0, dailyLimit - dailySpent) : null,
        monthlySpent,
        monthlyLimit,
        monthlyRemaining: monthlyLimit !== null ? Math.max(0, monthlyLimit - monthlySpent) : null,
      },
    };
  }

  async updatePolicy(userId: string, data: UpdatePolicyDto) {
    return this.prisma.userPolicy.upsert({
      where: { userId },
      create: {
        userId,
        currency: 'USD',
        autonomyMode: data.autonomyMode ?? 'ASK_EVERY_TIME',
        maxTransactionAmount: data.maxTransactionAmount ?? null,
        dailySpendingLimit: data.dailySpendingLimit ?? null,
        monthlySpendingLimit: data.monthlySpendingLimit ?? null,
        requireApprovalAbove: data.requireApprovalAbove ?? null,
        allowAutoExecute: data.allowAutoExecute ?? false,
        allowNegotiation: data.allowNegotiation ?? false,
      },
      update: {
        ...(data.autonomyMode !== undefined ? { autonomyMode: data.autonomyMode } : {}),
        ...(data.maxTransactionAmount !== undefined ? { maxTransactionAmount: data.maxTransactionAmount } : {}),
        ...(data.dailySpendingLimit !== undefined ? { dailySpendingLimit: data.dailySpendingLimit } : {}),
        ...(data.monthlySpendingLimit !== undefined ? { monthlySpendingLimit: data.monthlySpendingLimit } : {}),
        ...(data.requireApprovalAbove !== undefined ? { requireApprovalAbove: data.requireApprovalAbove } : {}),
        ...(data.allowAutoExecute !== undefined ? { allowAutoExecute: data.allowAutoExecute } : {}),
        ...(data.allowNegotiation !== undefined ? { allowNegotiation: data.allowNegotiation } : {}),
      },
    });
  }
}

