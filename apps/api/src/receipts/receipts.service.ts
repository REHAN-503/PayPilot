import { createHash } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

type ActivityForHash = {
  id: string;
  userId: string;
  planId: string | null;
  paymentId: string | null;
  type: string;
  actor: string;
  title: string;
  description: string | null;
  metadata: unknown;
  createdAt: Date;
  prevHash: string | null;
  eventHash: string | null;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function canonicalEvent(event: ActivityForHash): string {
  return stableStringify({
    actor: event.actor,
    createdAt: event.createdAt.toISOString(),
    description: event.description,
    id: event.id,
    metadata: event.metadata,
    paymentId: event.paymentId,
    planId: event.planId,
    title: event.title,
    type: event.type,
    userId: event.userId,
  });
}

function hashEvent(previousHash: string | null, event: ActivityForHash): string {
  return createHash('sha256')
    .update(`${previousHash ?? ''}${canonicalEvent(event)}`)
    .digest('hex');
}

@Injectable()
export class ReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReceipt(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
      include: {
        plan: {
          include: {
            items: { include: { product: true } },
            intent: true,
            approvals: { orderBy: { createdAt: 'desc' } },
            riskAssessments: { orderBy: { createdAt: 'desc' }, take: 1 },
            activities: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
          },
        },
        transactions: true,
        activities: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!payment) throw new NotFoundException(`Payment '${paymentId}' not found`);

    const policy = await this.prisma.userPolicy.findUnique({ where: { userId } });
    const amount = Number(payment.amount);
    const risk = payment.plan.riskAssessments[0] ?? null;
    const rules = policy
      ? [
          { name: 'Transaction limit', value: amount, limit: policy.maxTransactionAmount ? Number(policy.maxTransactionAmount) : null, passed: !policy.maxTransactionAmount || amount <= Number(policy.maxTransactionAmount) },
          { name: 'Daily spending limit', value: amount, limit: policy.dailySpendingLimit ? Number(policy.dailySpendingLimit) : null, passed: true },
          { name: 'Approval threshold', value: amount, limit: policy.requireApprovalAbove ? Number(policy.requireApprovalAbove) : null, passed: !policy.requireApprovalAbove || amount <= Number(policy.requireApprovalAbove) || payment.plan.approvals.some((approval) => approval.status === 'APPROVED') },
        ]
      : [];

    return {
      payment,
      merchant: 'PayPilot Catalog Merchant',
      items: payment.plan.items,
      amounts: { subtotal: Number(payment.plan.subtotal), tax: Number(payment.plan.tax), shipping: Number(payment.plan.shipping), discount: Number(payment.plan.discount), total: amount, currency: payment.currency },
      policyRules: rules,
      risk: risk ? { score: risk.score, level: risk.level, reasons: risk.reasons } : null,
      approval: payment.plan.approvals[0] ?? null,
      paypal: { orderId: payment.paypalOrderId, captureId: payment.paypalCaptureId, webhookConfirmedAt: payment.webhookConfirmedAt },
      chain: this.verifyActivities(payment.plan.activities),
      timelineEvents: payment.plan.activities.length,
    };
  }

  async verify(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
      select: { id: true, planId: true },
    });
    if (!payment) throw new NotFoundException(`Payment '${paymentId}' not found`);
    const activities = await this.prisma.agentActivity.findMany({
      where: { userId, planId: payment.planId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return this.verifyActivities(activities);
  }

  private verifyActivities(activities: ActivityForHash[]) {
    let previousHash: string | null = null;
    for (const event of activities) {
      const expected = hashEvent(previousHash, event);
      if (event.prevHash !== previousHash || event.eventHash !== expected) {
        return { valid: false, brokenAtEventId: event.id, events: activities.length };
      }
      previousHash = event.eventHash;
    }
    return { valid: true, brokenAtEventId: null, events: activities.length };
  }
}
