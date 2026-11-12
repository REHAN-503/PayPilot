import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { z } from 'zod';
import type { updatePolicySchema } from './policy.schema.js';
import { evaluate } from './policy.engine.js';
import { fromCents, sumCents } from '../common/money.js';

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

    const spentToday = fromCents(sumCents(...dailyTx.map((tx) => tx.amount)));
    const spentMonth = fromCents(sumCents(...monthlyTx.map((tx) => tx.amount)));

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
        negotiationMaxRounds: 3,
        allowedCategories: [],
        blockedCategories: [],
        autoApproveCategories: [],
        agentPaused: false,
      },
      update: {},
    });

    const spend = await this.getSpendMetrics(userId);
    const dailyLimit = policy.dailySpendingLimit == null ? null : Number(policy.dailySpendingLimit);
    const monthlyLimit = policy.monthlySpendingLimit == null ? null : Number(policy.monthlySpendingLimit);

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
        negotiationMaxRounds: data.negotiationMaxRounds ?? 3,
        allowedCategories: data.allowedCategories ?? [],
        blockedCategories: data.blockedCategories ?? [],
        autoApproveCategories: data.autoApproveCategories ?? [],
        agentPaused: data.agentPaused ?? false,
        maxDiscountSeekPercent: data.maxDiscountSeekPercent ?? null,
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
        ...(data.negotiationMaxRounds !== undefined
          ? { negotiationMaxRounds: data.negotiationMaxRounds }
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
        ...(data.agentPaused !== undefined ? { agentPaused: data.agentPaused } : {}),
        ...(data.maxDiscountSeekPercent !== undefined
          ? { maxDiscountSeekPercent: data.maxDiscountSeekPercent }
          : {}),
      },
    });
  }

  async simulate(userId: string, input: { category: string; amount: number; merchant: string }) {
    const { policy, spendMetrics } = await this.getPolicy(userId);
    const result = evaluate(
      { total: input.amount, currency: policy.currency, category: input.category, items: [] },
      {
        currency: policy.currency,
        autonomyMode: policy.autonomyMode,
        maxTransactionAmount: policy.maxTransactionAmount == null ? null : Number(policy.maxTransactionAmount),
        dailySpendingLimit: policy.dailySpendingLimit == null ? null : Number(policy.dailySpendingLimit),
        monthlySpendingLimit: policy.monthlySpendingLimit == null ? null : Number(policy.monthlySpendingLimit),
        requireApprovalAbove: policy.requireApprovalAbove == null ? null : Number(policy.requireApprovalAbove),
        allowAutoExecute: policy.allowAutoExecute,
        allowedCategories: policy.allowedCategories,
        blockedCategories: policy.blockedCategories,
        autoApproveCategories: policy.autoApproveCategories,
      },
      { today: spendMetrics.dailySpent, month: spendMetrics.monthlySpent },
    );
    return { ...result, merchant: input.merchant, amount: input.amount, category: input.category };
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
        maxTransactionAmount: policy.maxTransactionAmount == null ? null : Number(policy.maxTransactionAmount),
        dailySpendingLimit: policy.dailySpendingLimit == null ? null : Number(policy.dailySpendingLimit),
        monthlySpendingLimit: policy.monthlySpendingLimit == null ? null : Number(policy.monthlySpendingLimit),
        requireApprovalAbove: policy.requireApprovalAbove == null ? null : Number(policy.requireApprovalAbove),
        autonomyMode: policy.autonomyMode,
        allowAutoExecute: policy.allowAutoExecute,
        allowedCategories: policy.allowedCategories,
        blockedCategories: policy.blockedCategories,
        autoApproveCategories: policy.autoApproveCategories,
      },
    };
  }

  async assertAgentActive(
    userId: string,
    context: { planId?: string; intentId?: string; paymentId?: string },
  ) {
    const policy = await this.prisma.userPolicy.findUnique({ where: { userId } });
    if (!policy?.agentPaused) return;
    await this.prisma.agentActivity.create({
      data: {
        userId,
        planId: context.planId,
        intentId: context.intentId,
        paymentId: context.paymentId,
        type: 'FORBIDDEN_ACTION_BLOCKED',
        actor: 'SYSTEM',
        title: 'Agent kill-switch blocked action',
        description: 'The agent is paused by the user. Approval and payment actions are disabled.',
      },
    });
    throw new ForbiddenException({
      code: 'AGENT_PAUSED',
      message: 'Agent is paused. Resume it in Policy settings before approving or paying.',
    });
  }
}
