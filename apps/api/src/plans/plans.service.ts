import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertPlanTransition, type PlanStatus } from '../state-machines/plan.sm.js';
import { assertIntentTransition } from '../state-machines/intent.sm.js';
import { evaluate, type PolicyRules, type PolicyEvaluationResult } from '../policy/policy.engine.js';
import { assess, applyRiskGate, type RiskAssessmentResult } from '../policy/risk.gate.js';
import { ReplanService } from '../replan/replan.service.js';
import { PolicyService } from '../policy/policy.service.js';

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly replanService: ReplanService,
    @Optional() private readonly policyService?: PolicyService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.purchasePlan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        riskAssessments: { orderBy: { createdAt: 'desc' }, take: 1 },
        approvals: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const plan = await this.prisma.purchasePlan.findFirst({
      where: { id, userId },
      include: {
        items: {
          include: { product: true },
        },
        riskAssessments: { orderBy: { createdAt: 'desc' } },
        approvals: { orderBy: { createdAt: 'desc' } },
        payments: { orderBy: { createdAt: 'desc' } },
        activities: { orderBy: { createdAt: 'asc' } },
        intent: {
          include: {
            activities: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Purchase plan '${id}' not found`);
    }

    return plan;
  }

  async getHistoricalMetrics(userId: string) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const [dailyTx, monthlyTx, allTx, recentTx] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId, type: 'PAYMENT_CAPTURED', createdAt: { gte: startOfDay } },
        select: { amount: true },
      }),
      this.prisma.transaction.findMany({
        where: { userId, type: 'PAYMENT_CAPTURED', createdAt: { gte: startOfMonth } },
        select: { amount: true },
      }),
      this.prisma.transaction.findMany({
        where: { userId, type: 'PAYMENT_CAPTURED' },
        select: { amount: true, payment: { select: { plan: { select: { items: { select: { product: { select: { category: true } } } } } } } } },
      }),
      this.prisma.transaction.findMany({
        where: { userId, createdAt: { gte: tenMinutesAgo } },
        select: { id: true },
      }),
    ]);

    const dailySpent = dailyTx.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const monthlySpent = monthlyTx.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const pastPaymentsCount = allTx.length;
    const totalSpentAllTime = allTx.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const typicalSpendAverage = pastPaymentsCount > 0 ? totalSpentAllTime / pastPaymentsCount : 0;

    const purchasedCategories: string[] = [];
    for (const tx of allTx) {
      const items = tx.payment?.plan?.items || [];
      for (const item of items) {
        if (item.product?.category && !purchasedCategories.includes(item.product.category)) {
          purchasedCategories.push(item.product.category);
        }
      }
    }

    return {
      dailySpent,
      monthlySpent,
      pastPaymentsCount,
      typicalSpendAverage,
      purchasedCategories,
      recentPaymentsIn10Min: recentTx.length,
    };
  }

  async evaluatePlan(
    userId: string,
    planId: string,
  ): Promise<{
    decision: 'ALLOW_AUTO' | 'REQUIRE_APPROVAL' | 'BLOCK';
    violations: string[];
    reasons: string[];
    risk: RiskAssessmentResult;
  }> {
    const plan = await this.prisma.purchasePlan.findFirst({
      where: { id: planId, userId },
      include: {
        items: { include: { product: true } },
        intent: true,
      },
    });

    if (!plan) {
      throw new NotFoundException(`Purchase plan '${planId}' not found`);
    }
    await this.policyService?.assertAgentActive(userId, {
      planId: plan.id,
      intentId: plan.intentId,
    });

    const policy = await this.prisma.userPolicy.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    const metrics = await this.getHistoricalMetrics(userId);
    const now = new Date();

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

    const firstItem = plan.items[0];
    const category = firstItem?.product?.category ?? plan.intent?.category ?? null;

    // Check catalog price at creation vs current
    const catalogPriceAtCreation = firstItem ? Number(firstItem.unitPrice) : null;
    const currentCatalogPrice = firstItem?.product ? Number(firstItem.product.price) : catalogPriceAtCreation;

    // 1. Policy Evaluation
    const policyResult: PolicyEvaluationResult = evaluate(
      {
        total: Number(plan.total),
        currency: plan.currency,
        category,
        expiresAt: plan.expiresAt,
        items: plan.items.map((i) => ({
          quantity: i.quantity,
          product: i.product
            ? {
                stock: i.product.stock,
                status: i.product.status,
                price: Number(i.product.price),
              }
            : null,
        })),
      },
      policyRules,
      { today: metrics.dailySpent, month: metrics.monthlySpent },
      now,
    );

    // 2. Risk Evaluation
    const riskResult: RiskAssessmentResult = assess(
      {
        total: Number(plan.total),
        category,
        quantity: firstItem?.quantity || 1,
        catalogPriceAtCreation,
        currentCatalogPrice,
        minItemStock: firstItem?.product?.stock,
        version: plan.version,
      },
      {
        typicalSpendAverage: metrics.typicalSpendAverage,
        pastPaymentsCount: metrics.pastPaymentsCount,
        dailySpentSoFar: metrics.dailySpent,
        dailySpendingLimit: policy.dailySpendingLimit ? Number(policy.dailySpendingLimit) : null,
        purchasedCategories: metrics.purchasedCategories,
        recentPaymentsIn10Min: metrics.recentPaymentsIn10Min,
      },
    );

    // 3. Apply Risk Gate
    const gated = applyRiskGate(policyResult.decision, riskResult);

    // If gated, add risk explanation note
    const finalReasons = [...policyResult.reasons];
    if (gated.riskGated && gated.note) {
      finalReasons.push(gated.note);
    }

    return {
      decision: gated.decision,
      violations: policyResult.violations,
      reasons: finalReasons,
      risk: riskResult,
    };
  }

  async approvePlan(userId: string, planId: string, note?: string) {
    const plan = await this.prisma.purchasePlan.findFirst({
      where: { id: planId, userId },
      include: {
        items: { include: { product: true } },
        intent: true,
      },
    });

    if (!plan) {
      throw new NotFoundException(`Purchase plan '${planId}' not found`);
    }

    // 1. Expiration check
    if (plan.expiresAt && new Date() > new Date(plan.expiresAt)) {
      await this.prisma.agentActivity.create({
        data: {
          userId,
          planId: plan.id,
          intentId: plan.intentId,
          type: 'FORBIDDEN_ACTION_BLOCKED',
          actor: 'AGENT',
          title: 'Approval rejected: plan expired',
          description: `Attempted to approve expired plan (expired at ${plan.expiresAt.toISOString()}).`,
        },
      });
      throw new ForbiddenException('Cannot approve an expired purchase plan.');
    }

    // 2. State machine assert: must be legal transition to APPROVED
    try {
      assertPlanTransition(plan.status as PlanStatus, 'APPROVED');
    } catch (err: any) {
      await this.prisma.agentActivity.create({
        data: {
          userId,
          planId: plan.id,
          intentId: plan.intentId,
          type: 'FORBIDDEN_ACTION_BLOCKED',
          actor: 'AGENT',
          title: 'Illegal state transition blocked',
          description: err.message,
        },
      });
      throw new ForbiddenException(err.message);
    }

    // 3. Re-run evaluate + risk at approval time (detect stale prices / inventory changes)
    const evalResult = await this.evaluatePlan(userId, planId);
    if (evalResult.decision === 'BLOCK') {
      await this.prisma.agentActivity.create({
        data: {
          userId,
          planId: plan.id,
          intentId: plan.intentId,
          type: 'POLICY_BLOCKED',
          actor: 'AGENT',
          title: 'Approval blocked by policy gate',
          description: evalResult.violations.join('; ') || 'Conditions changed; approval blocked.',
        },
      });
      throw new ForbiddenException(
        `Approval rejected by policy: ${evalResult.violations.join('; ')}`,
      );
    }

    const approvalExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10-minute expiry

    return this.prisma.$transaction(async (tx) => {
      // Create Approval row
      const approval = await tx.approval.create({
        data: {
          userId,
          planId: plan.id,
          status: 'APPROVED',
          decisionNote: note || 'Explicit approval granted by user.',
          approvedAt: new Date(),
          expiresAt: approvalExpiry,
        },
      });

      // Update plan to APPROVED
      const updatedPlan = await tx.purchasePlan.update({
        where: { id: plan.id },
        data: {
          status: 'APPROVED',
          expiresAt: approvalExpiry,
        },
        include: { items: true, approvals: true },
      });

      // Synchronize intent if present
      if (plan.intent) {
        assertIntentTransition(plan.intent.status as any, 'APPROVED');
        await tx.purchaseIntent.update({
          where: { id: plan.intentId },
          data: { status: 'APPROVED' },
        });
      }

      // Record activity
      await tx.agentActivity.create({
        data: {
          userId,
          planId: plan.id,
          intentId: plan.intentId,
          type: 'APPROVAL_GRANTED',
          actor: 'USER',
          title: 'Purchase plan authorized',
          description: note || 'User approved the purchase plan. 10-minute payment authorization window active.',
          metadata: {
            approvalId: approval.id,
            expiresAt: approvalExpiry.toISOString(),
          },
        },
      });

      return updatedPlan;
    });
  }

  async rejectPlan(userId: string, planId: string, note?: string) {
    const plan = await this.prisma.purchasePlan.findFirst({
      where: { id: planId, userId },
      include: { intent: true },
    });

    if (!plan) {
      throw new NotFoundException(`Purchase plan '${planId}' not found`);
    }

    try {
      assertPlanTransition(plan.status as PlanStatus, 'REJECTED');
    } catch (err: any) {
      await this.prisma.agentActivity.create({
        data: {
          userId,
          planId: plan.id,
          intentId: plan.intentId,
          type: 'FORBIDDEN_ACTION_BLOCKED',
          actor: 'AGENT',
          title: 'Illegal rejection transition blocked',
          description: err.message,
        },
      });
      throw new ForbiddenException(err.message);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.approval.create({
        data: {
          userId,
          planId: plan.id,
          status: 'REJECTED',
          decisionNote: note || 'Plan rejected by user.',
          rejectedAt: new Date(),
        },
      });

      const updatedPlan = await tx.purchasePlan.update({
        where: { id: plan.id },
        data: { status: 'REJECTED' },
      });

      await tx.agentActivity.create({
        data: {
          userId,
          planId: plan.id,
          intentId: plan.intentId,
          type: 'APPROVAL_REJECTED',
          actor: 'USER',
          title: 'Purchase plan rejected',
          description: note || 'User rejected the purchase plan.',
        },
      });

      return updatedPlan;
    });
  }

  async selectAlternative(userId: string, planId: string, productId: string) {
    const plan = await this.prisma.purchasePlan.findFirst({
      where: { id: planId, userId },
      include: { items: true, intent: true },
    });

    if (!plan) {
      throw new NotFoundException('Purchase plan not found');
    }

    if (plan.status !== 'READY' && plan.status !== 'AWAITING_APPROVAL') {
      throw new BadRequestException(
        `Cannot modify plan in '${plan.status}' state. Only READY or AWAITING_APPROVAL plans may be revised.`,
      );
    }

    const newProduct = await this.prisma.product.findFirst({
      where: { id: productId, status: 'ACTIVE' },
    });

    if (!newProduct) {
      throw new NotFoundException('Selected alternative product not found or inactive');
    }

    const unitPrice = Number(newProduct.price);
    const quantity = plan.items[0]?.quantity || 1;
    const subtotal = Math.round(unitPrice * quantity * 100) / 100;
    const total = subtotal;

    return this.prisma.$transaction(async (tx) => {
      await tx.planItem.deleteMany({ where: { planId } });
      await tx.planItem.create({
        data: {
          planId,
          productId: newProduct.id,
          productName: newProduct.name,
          productSku: newProduct.sku,
          unitPrice: unitPrice.toFixed(2),
          quantity,
          lineTotal: total.toFixed(2),
          currency: 'USD',
        },
      });

      const updatedPlan = await tx.purchasePlan.update({
        where: { id: planId },
        data: {
          subtotal: subtotal.toFixed(2),
          total: total.toFixed(2),
          explanation: `Revised selection: ${newProduct.name} swapped by user.`,
        },
        include: { items: true },
      });

      await tx.agentActivity.create({
        data: {
          userId,
          intentId: plan.intentId,
          planId,
          type: 'PLAN_REVISED',
          actor: 'AGENT',
          title: 'Plan alternative selected',
          description: `User selected alternative product: ${newProduct.name} ($${unitPrice.toFixed(2)}).`,
        },
      });

      return updatedPlan;
    });
  }

  async whatIf(
    userId: string,
    planId: string,
    params: { maxBudget?: number; quantity?: number },
    commit = false,
  ) {
    const plan = await this.prisma.purchasePlan.findFirst({
      where: { id: planId, userId },
      include: {
        items: true,
        intent: true,
      },
    });

    if (!plan) {
      throw new NotFoundException('Purchase plan not found');
    }

    const currentItem = plan.items[0];
    if (!currentItem) {
      throw new BadRequestException('Plan has no existing items to re-simulate');
    }

    const simulatedQuantity = params.quantity ?? currentItem.quantity;
    let selectedProduct = await this.prisma.product.findFirst({
      where: { id: currentItem.productId || undefined, status: 'ACTIVE' },
    });

    if (params.maxBudget != null) {
      const budgetMatched = await this.prisma.product.findFirst({
        where: {
          status: 'ACTIVE',
          category: selectedProduct?.category ?? plan.intent?.category ?? undefined,
          price: { lte: params.maxBudget },
        },
        orderBy: { price: 'desc' },
      });
      if (budgetMatched) {
        selectedProduct = budgetMatched;
      }
    }

    if (!selectedProduct) {
      throw new NotFoundException('No active product found for simulation');
    }

    const unitPrice = Number(selectedProduct.price);
    const subtotal = Math.round(unitPrice * simulatedQuantity * 100) / 100;
    const total = subtotal;

    if (!commit) {
      return {
        committed: false,
        simulatedPlan: {
          currentPlanId: plan.id,
          currentVersion: plan.version,
          proposedVersion: plan.version + 1,
          product: {
            id: selectedProduct.id,
            sku: selectedProduct.sku,
            name: selectedProduct.name,
            price: unitPrice,
          },
          quantity: simulatedQuantity,
          subtotal,
          total,
          currency: 'USD',
        },
        diff: {
          costDifference: Math.round((total - Number(plan.total)) * 100) / 100,
          quantityDifference: simulatedQuantity - currentItem.quantity,
          simulatedBudgetCeiling: params.maxBudget ?? null,
        },
      };
    }

    return this.prisma.$transaction(async (tx) => {
      const nextVersion = plan.version + 1;

      const newPlan = await tx.purchasePlan.create({
        data: {
          userId,
          intentId: plan.intentId,
          version: nextVersion,
          status: 'AWAITING_APPROVAL',
          subtotal: subtotal.toFixed(2),
          total: total.toFixed(2),
          currency: 'USD',
          explanation: `Re-planned (v${nextVersion}): simulated budget ${params.maxBudget != null ? `$${params.maxBudget}` : 'N/A'}, quantity ${simulatedQuantity}.`,
          items: {
            create: {
              productId: selectedProduct.id,
              productName: selectedProduct.name,
              productSku: selectedProduct.sku,
              unitPrice: unitPrice.toFixed(2),
              quantity: simulatedQuantity,
              lineTotal: total.toFixed(2),
              currency: 'USD',
            },
          },
        },
        include: { items: true },
      });

      await tx.agentActivity.create({
        data: {
          userId,
          intentId: plan.intentId,
          planId: newPlan.id,
          type: 'BUDGET_REPLANNED',
          actor: 'AGENT',
          title: `Purchase plan re-planned to v${nextVersion}`,
          description: `Committed what-if scenario: total $${total.toFixed(2)}, quantity ${simulatedQuantity}.`,
          metadata: {
            previousVersion: plan.version,
            nextVersion,
            simulatedBudget: params.maxBudget,
            quantity: simulatedQuantity,
          },
        },
      });

      return {
        committed: true,
        plan: newPlan,
      };
    });
  }

  async cancelPlan(userId: string, planId: string) {
    const plan = await this.prisma.purchasePlan.findFirst({
      where: { id: planId, userId },
      include: { intent: true },
    });

    if (!plan) {
      throw new NotFoundException('Purchase plan not found');
    }

    assertPlanTransition(plan.status as PlanStatus, 'CANCELLED');

    return this.prisma.$transaction(async (tx) => {
      const updatedPlan = await tx.purchasePlan.update({
        where: { id: planId },
        data: { status: 'CANCELLED' },
      });

      if (plan.intent) {
        assertIntentTransition(plan.intent.status as any, 'CANCELLED');
        await tx.purchaseIntent.update({
          where: { id: plan.intentId },
          data: { status: 'CANCELLED' },
        });
      }

      await tx.agentActivity.create({
        data: {
          userId,
          intentId: plan.intentId,
          planId,
          type: 'SYSTEM_EVENT',
          actor: 'AGENT',
          title: 'Purchase plan cancelled',
          description: 'User dismissed or cancelled this purchase plan.',
        },
      });

      return updatedPlan;
    });
  }
}
