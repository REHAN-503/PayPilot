import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { transitionIntentStatus, transitionPlanStatus } from '../common/state/state-machine.js';
import { evaluatePolicy } from '../policies/policy-engine.js';
import { evaluateRisk } from '../risk/risk-engine.js';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(userId: string, id: string) {
    const plan = await this.prisma.purchasePlan.findFirst({
      where: { id, userId },
      include: {
        items: true,
        riskAssessments: { orderBy: { createdAt: 'desc' }, take: 1 },
        approvals: { orderBy: { createdAt: 'desc' }, take: 1 },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        intent: {
          include: {
            activities: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Purchase plan not found');
    }

    return plan;
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

    // Rule 2: Recompute total server-side
    const unitPrice = Number(newProduct.price);
    const quantity = plan.items[0]?.quantity || 1;
    const subtotal = unitPrice * quantity;
    const tax = 0;
    const shipping = 0;
    const discount = 0;
    const total = subtotal + tax + shipping - discount;

    const policyEvaluation = evaluatePolicy({
      planAmount: total,
      currency: 'USD',
      policy,
      dailySpentSoFar: dailySpent,
      monthlySpentSoFar: monthlySpent,
    });

    const dailyCap = policy.dailySpendingLimit ? Number(policy.dailySpendingLimit) : 500;
    const riskEvaluation = evaluateRisk({
      planAmount: total,
      policyPassed: policyEvaluation.passed,
      violationsCount: policyEvaluation.violations.length,
      dailySpentRatio: (dailySpent + total) / dailyCap,
      itemCount: 1,
    });

    const isAutoApproved =
      policyEvaluation.canAutoExecute &&
      riskEvaluation.level !== 'CRITICAL' &&
      riskEvaluation.level !== 'HIGH';

    const newPlanStatus = isAutoApproved ? 'APPROVED' : 'AWAITING_APPROVAL';

    return this.prisma.$transaction(async (tx) => {
      // Delete old items and add new item
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
          status: newPlanStatus,
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          shipping: shipping.toFixed(2),
          discount: discount.toFixed(2),
          total: total.toFixed(2),
          explanation: `Revised selection: ${newProduct.name} swapped by user.`,
        },
        include: { items: true },
      });

      await tx.riskAssessment.create({
        data: {
          planId,
          level: riskEvaluation.level,
          score: riskEvaluation.score,
          reasons: riskEvaluation.reasons,
          recommendations: riskEvaluation.recommendations,
          policyPassed: policyEvaluation.passed,
          explanation: `Risk Score: ${riskEvaluation.score}/100. Policy: ${policyEvaluation.passed ? 'PASSED' : 'FLAGGED'}.`,
        },
      });

      if (!isAutoApproved) {
        await tx.approval.create({
          data: {
            userId,
            planId,
            status: 'PENDING',
            decisionNote: `Alternative item selected. ${policyEvaluation.reasons.join(' ')}`,
          },
        });
      }

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
    const tax = 0;
    const shipping = 0;
    const discount = 0;
    const total = Math.round((subtotal + tax + shipping - discount) * 100) / 100;

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

    const policyEvaluation = evaluatePolicy({
      planAmount: total,
      currency: 'USD',
      policy,
      dailySpentSoFar: dailySpent,
      monthlySpentSoFar: monthlySpent,
    });

    const dailyCap = policy.dailySpendingLimit ? Number(policy.dailySpendingLimit) : 500;
    const riskEvaluation = evaluateRisk({
      planAmount: total,
      policyPassed: policyEvaluation.passed,
      violationsCount: policyEvaluation.violations.length,
      dailySpentRatio: (dailySpent + total) / dailyCap,
      itemCount: simulatedQuantity,
    });

    const isAutoApproved =
      policyEvaluation.canAutoExecute &&
      riskEvaluation.level !== 'CRITICAL' &&
      riskEvaluation.level !== 'HIGH';

    const newPlanStatus = isAutoApproved ? 'APPROVED' : 'AWAITING_APPROVAL';

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
          status: newPlanStatus,
          policyEvaluation,
          riskAssessment: {
            level: riskEvaluation.level,
            score: riskEvaluation.score,
            policyPassed: policyEvaluation.passed,
          },
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
          status: newPlanStatus,
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          shipping: shipping.toFixed(2),
          discount: discount.toFixed(2),
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

      await tx.riskAssessment.create({
        data: {
          planId: newPlan.id,
          level: riskEvaluation.level,
          score: riskEvaluation.score,
          reasons: riskEvaluation.reasons,
          recommendations: riskEvaluation.recommendations,
          policyPassed: policyEvaluation.passed,
          explanation: `Risk Score: ${riskEvaluation.score}/100. Policy: ${policyEvaluation.passed ? 'PASSED' : 'FLAGGED'}.`,
        },
      });

      if (!isAutoApproved) {
        await tx.approval.create({
          data: {
            userId,
            planId: newPlan.id,
            status: 'PENDING',
            decisionNote: `What-if plan committed. ${policyEvaluation.reasons.join(' ')}`,
          },
        });
      }

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

    const nextPlanStatus = transitionPlanStatus(plan.status as any, 'CANCELLED');
    const nextIntentStatus = transitionIntentStatus(plan.intent.status as any, 'CANCELLED');

    return this.prisma.$transaction(async (tx) => {
      const updatedPlan = await tx.purchasePlan.update({
        where: { id: planId },
        data: { status: nextPlanStatus },
      });

      await tx.purchaseIntent.update({
        where: { id: plan.intentId },
        data: { status: nextIntentStatus },
      });

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
