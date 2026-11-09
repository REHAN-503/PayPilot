import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AnalyticsTransactionRow {
  id: string;
  paymentId: string;
  createdAt: Date;
  type: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
  paymentStatus: string;
  webhookConfirmed: boolean;
  webhookConfirmedAt: Date | null;
  productName: string;
  productSku: string | null;
  category: string | null;
  riskLevel: string;
  riskScore: number;
  autonomyMode: string;
  negotiatedSavings: number;
  planVersion: number;
}

export interface AnalyticsSummary {
  totalSpend: number;
  blockedByPolicyCount: number;
  replansCount: number;
  avgNegotiationSavingsPct: number;
  successRate: number;
  webhookConfirmedCount: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTransactions(userId: string): Promise<AnalyticsTransactionRow[]> {
    const policy = await this.prisma.userPolicy.findUnique({
      where: { userId },
      select: { autonomyMode: true },
    });

    const autonomyMode = policy?.autonomyMode || 'ASK_EVERY_TIME';

    const [transactions, agreedNegotiations] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId },
        include: {
          payment: {
            include: {
              plan: {
                include: {
                  items: { include: { product: true } },
                  riskAssessments: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.negotiation.findMany({
        where: { userId, status: 'AGREED' },
        include: { plan: { select: { intentId: true } } },
      }),
    ]);

    return transactions.map((tx) => {
      const plan = tx.payment?.plan;
      const primaryItem = plan?.items?.[0];
      const risk = plan?.riskAssessments?.[0];
      const negotiation = agreedNegotiations.find(
        (n) => n.planId === plan?.id || (plan?.intentId && n.plan?.intentId === plan.intentId),
      );

      let negotiatedSavings = 0;
      if (negotiation && negotiation.agreedPrice) {
        negotiatedSavings = Math.max(
          0,
          Math.round((Number(negotiation.initialPrice) - Number(negotiation.agreedPrice)) * 100) / 100,
        );
      }

      return {
        id: tx.id,
        paymentId: tx.paymentId,
        createdAt: tx.createdAt,
        type: tx.type,
        amount: Number(tx.amount),
        currency: tx.currency,
        idempotencyKey: tx.idempotencyKey,
        paymentStatus: tx.payment?.status || 'UNKNOWN',
        webhookConfirmed: !!tx.payment?.webhookConfirmedAt,
        webhookConfirmedAt: tx.payment?.webhookConfirmedAt || null,
        productName: primaryItem?.productName || 'General Product',
        productSku: primaryItem?.productSku || null,
        category: primaryItem?.product?.category || null,
        riskLevel: risk?.level || 'LOW',
        riskScore: risk?.score ?? 10,
        autonomyMode,
        negotiatedSavings,
        planVersion: plan?.version ?? 1,
      };
    });
  }

  async getSummary(userId: string): Promise<AnalyticsSummary> {
    const [
      capturedTx,
      allPayments,
      blockedActivities,
      replanActivities,
      agreedNegotiations,
    ] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId, type: 'PAYMENT_CAPTURED' },
        select: { amount: true },
      }),
      this.prisma.payment.findMany({
        where: { userId },
        select: { status: true, webhookConfirmedAt: true },
      }),
      this.prisma.agentActivity.count({
        where: { userId, type: 'POLICY_BLOCKED' },
      }),
      this.prisma.agentActivity.count({
        where: { userId, type: 'BUDGET_REPLANNED' },
      }),
      this.prisma.negotiation.findMany({
        where: { userId, status: 'AGREED' },
        select: { initialPrice: true, agreedPrice: true },
      }),
    ]);

    const totalSpend = capturedTx.reduce((sum, tx) => sum + Number(tx.amount), 0);

    const capturedCount = allPayments.filter((p) => p.status === 'CAPTURED').length;
    const totalPayments = allPayments.length;
    const successRate = totalPayments > 0
      ? Math.round((capturedCount / totalPayments) * 1000) / 10
      : 100.0;

    const webhookConfirmedCount = allPayments.filter((p) => p.webhookConfirmedAt != null).length;

    let avgNegotiationSavingsPct = 0;
    if (agreedNegotiations.length > 0) {
      const totalPct = agreedNegotiations.reduce((sum, neg) => {
        const init = Number(neg.initialPrice);
        const agr = Number(neg.agreedPrice || init);
        if (init <= 0) return sum;
        const pct = ((init - agr) / init) * 100;
        return sum + Math.max(0, pct);
      }, 0);
      avgNegotiationSavingsPct = Math.round((totalPct / agreedNegotiations.length) * 10) / 10;
    }

    return {
      totalSpend: Math.round(totalSpend * 100) / 100,
      blockedByPolicyCount: blockedActivities,
      replansCount: replanActivities,
      avgNegotiationSavingsPct,
      successRate,
      webhookConfirmedCount,
    };
  }

  async getAgentActivity(userId: string) {
    const activities = await this.prisma.agentActivity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return activities.map((act) => ({
      id: act.id,
      createdAt: act.createdAt,
      type: act.type,
      actor: act.actor,
      title: act.title,
      description: act.description,
      metadata: act.metadata,
      intentId: act.intentId,
      planId: act.planId,
      paymentId: act.paymentId,
    }));
  }
}
