import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertPlanTransition } from '../state-machines/plan.sm.js';
import { evaluate, type PolicyRules } from '../policy/policy.engine.js';
import { assess } from '../policy/risk.gate.js';

export interface ReplanResult {
  success: boolean;
  replannedPlan?: any;
  reason?: string;
  tradeoffs?: string[];
  maxAttemptsReached?: boolean;
}

@Injectable()
export class ReplanService {
  private readonly logger = new Logger(ReplanService.name);

  constructor(private readonly prisma: PrismaService) {}

  async autoReplan(
    userId: string,
    currentPlanId: string,
    blockReasons: string[],
    onActivity?: (act: any) => void,
  ): Promise<ReplanResult> {
    const currentPlan = await this.prisma.purchasePlan.findFirst({
      where: { id: currentPlanId, userId },
      include: {
        items: { include: { product: true } },
        intent: true,
      },
    });

    if (!currentPlan) {
      return { success: false, reason: 'Purchase plan not found' };
    }

    // Constraint 3: Max 2 auto-replans per intent (version <= 3)
    const existingVersions = await this.prisma.purchasePlan.count({
      where: { intentId: currentPlan.intentId },
    });

    if (existingVersions >= 3) {
      this.logger.warn(
        `[ReplanService] Max auto-replan attempts reached for intent '${currentPlan.intentId}' (count: ${existingVersions})`,
      );
      return {
        success: false,
        maxAttemptsReached: true,
        reason: 'Maximum auto-replan attempts reached (max 2 per intent). No further safe automated re-planning possible.',
      };
    }

    // Load policy & spend metrics
    const policy = await this.prisma.userPolicy.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [dailyTx, monthlyTx] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId, type: 'PAYMENT_CAPTURED', createdAt: { gte: startOfDay } },
        select: { amount: true },
      }),
      this.prisma.transaction.findMany({
        where: { userId, type: 'PAYMENT_CAPTURED', createdAt: { gte: startOfMonth } },
        select: { amount: true },
      }),
    ]);

    const dailySpent = dailyTx.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const monthlySpent = monthlyTx.reduce((sum, tx) => sum + Number(tx.amount), 0);

    // Determine target budget constraint
    const maxTxLimit = policy.maxTransactionAmount ? Number(policy.maxTransactionAmount) : 500;
    const dailyRemaining = policy.dailySpendingLimit
      ? Math.max(0, Number(policy.dailySpendingLimit) - dailySpent)
      : maxTxLimit;
    const effectiveBudget = Math.min(maxTxLimit, dailyRemaining);

    const category =
      currentPlan.items[0]?.product?.category ??
      currentPlan.intent?.category ??
      'Electronics';

    // Query cheaper substitutions in the same category that fit within effectiveBudget
    const substitutions = await this.prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        category: { equals: category, mode: 'insensitive' },
        price: { lte: effectiveBudget },
        id: { not: currentPlan.items[0]?.productId || undefined },
      },
      orderBy: { price: 'desc' }, // Top candidate closest to budget
      take: 5,
    });

    if (substitutions.length === 0) {
      return {
        success: false,
        reason: `No alternative products in category '${category}' could be found under your budget limit ($${effectiveBudget.toFixed(2)}).`,
      };
    }

    const replacement = substitutions[0];
    const unitPrice = Number(replacement.price);
    const quantity = currentPlan.items[0]?.quantity || 1;
    const subtotal = Math.round(unitPrice * quantity * 100) / 100;
    const total = subtotal;

    const priceDiff = Math.round((Number(currentPlan.total) - total) * 100) / 100;
    const tradeoff = `-$${priceDiff.toFixed(2)} savings: replaced ${currentPlan.items[0]?.productName} ($${Number(currentPlan.total).toFixed(2)}) with ${replacement.name} ($${total.toFixed(2)}) to satisfy policy limits.`;

    // Re-evaluate policy for the new candidate
    const policyRules: PolicyRules = {
      currency: policy.currency,
      autonomyMode: policy.autonomyMode as any,
      maxTransactionAmount: policy.maxTransactionAmount ? Number(policy.maxTransactionAmount) : null,
      dailySpendingLimit: policy.dailySpendingLimit ? Number(policy.dailySpendingLimit) : null,
      monthlySpendingLimit: policy.monthlySpendingLimit ? Number(policy.monthlySpendingLimit) : null,
      requireApprovalAbove: policy.requireApprovalAbove ? Number(policy.requireApprovalAbove) : null,
      allowAutoExecute: policy.allowAutoExecute,
      allowedCategories: policy.allowedCategories,
      blockedCategories: policy.blockedCategories,
      autoApproveCategories: policy.autoApproveCategories,
    };

    const policyEval = evaluate(
      { total, currency: 'USD', category: replacement.category },
      policyRules,
      { today: dailySpent, month: monthlySpent },
      now,
    );

    const riskEval = assess(
      { total, category: replacement.category, quantity, version: currentPlan.version + 1 },
      {
        dailySpentSoFar: dailySpent,
        dailySpendingLimit: policy.dailySpendingLimit ? Number(policy.dailySpendingLimit) : null,
      },
    );

    const isAuto =
      policyEval.decision === 'ALLOW_AUTO' &&
      riskEval.level !== 'CRITICAL' &&
      riskEval.level !== 'HIGH';

    const newStatus = isAuto ? 'APPROVED' : 'AWAITING_APPROVAL';
    const nextVersion = currentPlan.version + 1;

    return this.prisma.$transaction(async (tx) => {
      // 1. Mark old plan as REJECTED via state machine
      assertPlanTransition(currentPlan.status as any, 'REJECTED');
      await tx.purchasePlan.update({
        where: { id: currentPlan.id },
        data: { status: 'REJECTED' },
      });

      // 2. Emit BUDGET_REPLANNED activity
      const replannedAct = await tx.agentActivity.create({
        data: {
          userId,
          intentId: currentPlan.intentId,
          planId: currentPlan.id,
          type: 'BUDGET_REPLANNED',
          actor: 'AGENT',
          title: `Automatic replan triggered (v${currentPlan.version} -> v${nextVersion})`,
          description: `Plan v${currentPlan.version} blocked by limits (${blockReasons[0] || 'Budget exceeded'}). Searching viable replacements.`,
          metadata: {
            oldPlanId: currentPlan.id,
            blockReasons,
            attemptNumber: existingVersions,
          },
        },
      });
      if (onActivity) onActivity(replannedAct);

      // 3. Create new plan version
      const newPlan = await tx.purchasePlan.create({
        data: {
          userId,
          intentId: currentPlan.intentId,
          version: nextVersion,
          status: newStatus,
          subtotal: subtotal.toFixed(2),
          total: total.toFixed(2),
          currency: 'USD',
          explanation: `Automated replan v${nextVersion}: selected ${replacement.name} to comply with deterministic spending ceiling ($${effectiveBudget.toFixed(2)}).`,
          tradeoffs: [tradeoff],
          items: {
            create: {
              productId: replacement.id,
              productName: replacement.name,
              productSku: replacement.sku,
              unitPrice: unitPrice.toFixed(2),
              quantity,
              lineTotal: total.toFixed(2),
              currency: 'USD',
            },
          },
        },
        include: { items: true },
      });

      // 4. Create risk assessment & approval if needed
      const riskRecord = await tx.riskAssessment.create({
        data: {
          planId: newPlan.id,
          level: riskEval.level,
          score: riskEval.score,
          reasons: riskEval.reasons,
          policyPassed: policyEval.decision !== 'BLOCK',
          explanation: `Re-planned Risk Score: ${riskEval.score}/100. Policy Decision: ${policyEval.decision}.`,
        },
      });

      let approvalRecord: any = null;
      if (!isAuto) {
        approvalRecord = await tx.approval.create({
          data: {
            userId,
            planId: newPlan.id,
            status: 'PENDING',
            decisionNote: `Auto-replanned version v${nextVersion}. ${policyEval.reasons.join(' ')}`,
          },
        });
      } else {
        await tx.purchaseIntent.update({
          where: { id: currentPlan.intentId },
          data: { status: 'APPROVED' },
        });

        const autoAct = await tx.agentActivity.create({
          data: {
            userId,
            intentId: currentPlan.intentId,
            planId: newPlan.id,
            type: 'APPROVAL_GRANTED',
            actor: 'AGENT',
            title: 'Auto-approved within policy',
            description: 'Replanned purchase plan satisfies all deterministic policy limits and was automatically approved.',
            metadata: { autoApproved: true },
          },
        });
        if (onActivity) onActivity(autoAct);
      }

      // 5. Emit REPLAN_PROPOSED activity
      const proposedAct = await tx.agentActivity.create({
        data: {
          userId,
          intentId: currentPlan.intentId,
          planId: newPlan.id,
          type: 'REPLAN_PROPOSED',
          actor: 'AGENT',
          title: `Re-plan proposed: ${replacement.name}`,
          description: tradeoff,
          metadata: {
            newPlanId: newPlan.id,
            total,
            tradeoff,
            decision: policyEval.decision,
          },
        },
      });
      if (onActivity) onActivity(proposedAct);

      return {
        success: true,
        replannedPlan: {
          ...newPlan,
          riskAssessments: [riskRecord],
          approvals: approvalRecord ? [approvalRecord] : [],
        },
        tradeoffs: [tradeoff],
      };
    });
  }
}

