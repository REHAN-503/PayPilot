import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { z } from 'zod';
import type { updatePolicySchema } from './policy.schema.js';

@Injectable()
export class PolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getSpendMetrics(userId: string) {
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

    const spentToday = dailyTx.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const spentMonth = monthlyTx.reduce((sum, tx) => sum + Number(tx.amount), 0);

    return { spentToday, spentMonth };
  }

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
        allowedCategories: [],
        blockedCategories: [],
        autoApproveCategories: [],
      },
      update: {},
    });

    const spend = await this.getSpendMetrics(userId);
    const dailyLimit = policy.dailySpendingLimit ? Number(policy.dailySpendingLimit) : null;
    const monthlyLimit = policy.monthlySpendingLimit ? Number(policy.monthlySpendingLimit) : null;

    return {
      policy,
      spendMetrics: {
        dailySpent: spend.spentToday,
        dailyLimit,
        dailyRemaining: dailyLimit != null ? Math.max(0, dailyLimit - spend.spentToday) : null,
        monthlySpent: spend.spentMonth,
        monthlyLimit,
        monthlyRemaining: monthlyLimit != null ? Math.max(0, monthlyLimit - spend.spentMonth) : null,
      },
    };
  }

  async updatePolicy(userId: string, data: z.infer<typeof updatePolicySchema>) {
    return this.prisma.userPolicy.upsert({
      where: { userId },
      create: {
        userId,
        currency: data.currency ?? 'USD',
        autonomyMode: data.autonomyMode ?? 'ASK_EVERY_TIME',
        maxTransactionAmount: data.maxTransactionAmount ?? null,
        dailySpendingLimit: data.dailySpendingLimit ?? null,
        monthlySpendingLimit: data.monthlySpendingLimit ?? null,
        requireApprovalAbove: data.requireApprovalAbove ?? null,
        allowAutoExecute: data.allowAutoExecute ?? false,
        allowNegotiation: data.allowNegotiation ?? false,
        allowedCategories: data.allowedCategories ?? [],
        blockedCategories: data.blockedCategories ?? [],
        autoApproveCategories: data.autoApproveCategories ?? [],
      },
      update: {
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.autonomyMode !== undefined ? { autonomyMode: data.autonomyMode } : {}),
        ...(data.maxTransactionAmount !== undefined
          ? { maxTransactionAmount: data.maxTransactionAmount }
          : {}),
        ...(data.dailySpendingLimit !== undefined
          ? { dailySpendingLimit: data.dailySpendingLimit }
          : {}),
        ...(data.monthlySpendingLimit !== undefined
          ? { monthlySpendingLimit: data.monthlySpendingLimit }
          : {}),
        ...(data.requireApprovalAbove !== undefined
          ? { requireApprovalAbove: data.requireApprovalAbove }
          : {}),
        ...(data.allowAutoExecute !== undefined
          ? { allowAutoExecute: data.allowAutoExecute }
          : {}),
        ...(data.allowNegotiation !== undefined
          ? { allowNegotiation: data.allowNegotiation }
          : {}),
        ...(data.allowedCategories !== undefined
          ? { allowedCategories: data.allowedCategories }
          : {}),
        ...(data.blockedCategories !== undefined
          ? { blockedCategories: data.blockedCategories }
          : {}),
        ...(data.autoApproveCategories !== undefined
          ? { autoApproveCategories: data.autoApproveCategories }
          : {}),
      },
    });
  }

  async getBudgetSummary(userId: string) {
    const { policy, spendMetrics } = await this.getPolicy(userId);
    return {
      spentToday: spendMetrics.dailySpent,
      spentMonth: spendMetrics.monthlySpent,
      remainingDaily: spendMetrics.dailyRemaining,
      remainingMonthly: spendMetrics.monthlyRemaining,
      limits: {
        currency: policy.currency,
        maxTransactionAmount: policy.maxTransactionAmount ? Number(policy.maxTransactionAmount) : null,
        dailySpendingLimit: policy.dailySpendingLimit ? Number(policy.dailySpendingLimit) : null,
        monthlySpendingLimit: policy.monthlySpendingLimit ? Number(policy.monthlySpendingLimit) : null,
        requireApprovalAbove: policy.requireApprovalAbove ? Number(policy.requireApprovalAbove) : null,
        autonomyMode: policy.autonomyMode,
        allowAutoExecute: policy.allowAutoExecute,
        allowedCategories: policy.allowedCategories,
        blockedCategories: policy.blockedCategories,
        autoApproveCategories: policy.autoApproveCategories,
      },
    };
  }
}

