import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { explainEvent } from '../agent/explainer.js';
import type { TimelineEvent, TimelineStage, TimelineStatus } from './timeline.emitter.js';

export interface TimelineQuery {
  intentId?: string;
  planId?: string;
  paymentId?: string;
}

@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async getTimeline(
    userId: string,
    query: TimelineQuery,
  ): Promise<{ events: TimelineEvent[]; count: number }> {
    const { intentId, planId, paymentId } = query;

    // 1. Fetch AgentActivity
    const activityWhere: any = { userId };
    if (intentId) activityWhere.intentId = intentId;
    if (planId) activityWhere.planId = planId;
    if (paymentId) activityWhere.paymentId = paymentId;

    const activities = await this.prisma.agentActivity.findMany({
      where: activityWhere,
      orderBy: { createdAt: 'asc' },
    });

    // 2. Fetch Approvals
    const approvalWhere: any = { userId };
    if (planId) approvalWhere.planId = planId;

    const approvals = await this.prisma.approval.findMany({
      where: approvalWhere,
      include: { plan: true },
      orderBy: { createdAt: 'asc' },
    });

    // 3. Fetch RiskAssessments
    const riskWhere: any = {};
    if (planId) {
      riskWhere.planId = planId;
    } else if (intentId) {
      riskWhere.plan = { intentId, userId };
    } else {
      riskWhere.plan = { userId };
    }

    const riskAssessments = await this.prisma.riskAssessment.findMany({
      where: riskWhere,
      include: { plan: true },
      orderBy: { createdAt: 'asc' },
    });

    // 4. Fetch Payments
    const paymentWhere: any = { userId };
    if (paymentId) paymentWhere.id = paymentId;
    if (planId) paymentWhere.planId = planId;

    const payments = await this.prisma.payment.findMany({
      where: paymentWhere,
      include: { plan: true },
      orderBy: { createdAt: 'asc' },
    });

    // 5. Fetch Transactions
    const txWhere: any = { userId };
    if (paymentId) {
      txWhere.paymentId = paymentId;
    } else if (planId) {
      txWhere.payment = { planId };
    }

    const transactions = await this.prisma.transaction.findMany({
      where: txWhere,
      orderBy: { createdAt: 'asc' },
    });

    // 6. Fetch Negotiations & Rounds
    const negWhere: any = { userId };
    if (planId) negWhere.planId = planId;

    const negotiations = await this.prisma.negotiation.findMany({
      where: negWhere,
      include: {
        rounds: {
          orderBy: [{ roundNumber: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 7. Fetch Webhook events related to these payments
    const orderIds = payments.map((p) => p.paypalOrderId).filter(Boolean) as string[];
    const captureIds = payments.map((p) => p.paypalCaptureId).filter(Boolean) as string[];
    const resourceIds = [...orderIds, ...captureIds];

    const webhooks = resourceIds.length > 0
      ? await this.prisma.webhookEvent.findMany({
          where: { resourceId: { in: resourceIds } },
          orderBy: { receivedAt: 'asc' },
        })
      : [];

    const events: TimelineEvent[] = [];

    // Map Activities
    for (const act of activities) {
      const stage = this.mapActivityTypeToStage(act.type);
      const status = this.mapActivityStatus(act.type);
      const metadata = (act.metadata as any) || {};

      const explanation = explainEvent({
        type: act.type,
        planAmount: metadata.planAmount || metadata.price || metadata.agreedPrice,
        currency: metadata.currency || 'USD',
        productName: metadata.productName,
        riskLevel: metadata.riskLevel,
        riskScore: metadata.riskScore,
        policyPassed: metadata.policyPassed,
        violations: metadata.violations,
        reasons: act.description ? [act.description] : undefined,
        autonomyMode: metadata.autonomyMode,
      });

      events.push({
        id: `act-${act.id}`,
        at: act.createdAt.toISOString(),
        stage,
        actor: act.actor,
        title: act.title,
        explanation: explanation || act.description || act.title,
        status,
        data: metadata,
      });
    }

    // Map Approvals (if not already represented as an activity)
    for (const app of approvals) {
      const isAlreadyIncluded = events.some((e) => e.data?.approvalId === app.id);
      if (!isAlreadyIncluded) {
        const status: TimelineStatus =
          app.status === 'APPROVED' ? 'ok' : app.status === 'REJECTED' ? 'blocked' : 'pending';
        events.push({
          id: `app-${app.id}`,
          at: (app.approvedAt || app.rejectedAt || app.createdAt).toISOString(),
          stage: 'APPROVAL',
          actor: app.status === 'PENDING' ? 'SYSTEM' : 'USER',
          title: `Purchase Plan ${app.status === 'PENDING' ? 'Awaiting Approval' : app.status}`,
          explanation: app.decisionNote || (app.status === 'APPROVED' ? 'Plan approved by user' : 'Pending user authorization'),
          status,
          data: { approvalId: app.id, planId: app.planId, status: app.status },
        });
      }
    }

    // Map Risk Assessments
    for (const risk of riskAssessments) {
      const isAlreadyIncluded = events.some((e) => e.data?.riskScore === risk.score && e.stage === 'RISK');
      if (!isAlreadyIncluded) {
        const status: TimelineStatus =
          risk.level === 'LOW' ? 'ok' : risk.level === 'MEDIUM' ? 'warn' : 'blocked';
        events.push({
          id: `risk-${risk.id}`,
          at: risk.createdAt.toISOString(),
          stage: 'RISK',
          actor: 'AGENT',
          title: `Risk Assessed: ${risk.level} (${risk.score}/100)`,
          explanation: risk.explanation || `Risk scored at ${risk.score}/100 with policy ${risk.policyPassed ? 'passed' : 'flagged'}.`,
          status,
          data: { riskId: risk.id, score: risk.score, level: risk.level, reasons: risk.reasons },
        });
      }
    }

    // Map Payments
    for (const pay of payments) {
      const status: TimelineStatus =
        pay.status === 'CAPTURED' ? 'ok' : pay.status === 'FAILED' ? 'blocked' : 'pending';
      events.push({
        id: `pay-${pay.id}`,
        at: (pay.capturedAt || pay.approvedAt || pay.createdAt).toISOString(),
        stage: 'PAYPAL',
        actor: 'PAYPAL',
        title: `PayPal Order: ${pay.status}`,
        explanation: pay.capturedAt
          ? `PayPal order captured for $${Number(pay.amount).toFixed(2)} ${pay.currency}.`
          : `PayPal order ${pay.paypalOrderId || pay.id} created with status ${pay.status}.`,
        status,
        data: {
          paymentId: pay.id,
          paypalOrderId: pay.paypalOrderId,
          paypalCaptureId: pay.paypalCaptureId,
          amount: Number(pay.amount),
          status: pay.status,
          webhookConfirmedAt: pay.webhookConfirmedAt,
        },
      });
    }

    // Map Transactions (Ledger)
    for (const tx of transactions) {
      events.push({
        id: `tx-${tx.id}`,
        at: tx.createdAt.toISOString(),
        stage: 'LEDGER',
        actor: 'SYSTEM',
        title: `Ledger Entry: ${tx.type}`,
        explanation: tx.description || `Immutable transaction recorded for $${Number(tx.amount).toFixed(2)} ${tx.currency}.`,
        status: 'ok',
        data: {
          transactionId: tx.id,
          type: tx.type,
          amount: Number(tx.amount),
          idempotencyKey: tx.idempotencyKey,
        },
      });
    }

    // Map Webhook Events
    for (const wh of webhooks) {
      events.push({
        id: `wh-${wh.id}`,
        at: (wh.processedAt || wh.receivedAt).toISOString(),
        stage: 'WEBHOOK',
        actor: 'PAYPAL',
        title: `Webhook: ${wh.eventType}`,
        explanation: wh.status === 'PROCESSED'
          ? `Verified signature and processed ${wh.eventType} notification.`
          : `Received ${wh.eventType} notification (status: ${wh.status}).`,
        status: wh.status === 'PROCESSED' ? 'ok' : wh.status === 'FAILED' ? 'blocked' : 'pending',
        data: { eventId: wh.eventId, eventType: wh.eventType, status: wh.status },
      });
    }

    // Map Negotiations & Rounds (omitting merchantFloor!)
    for (const neg of negotiations) {
      for (const round of neg.rounds) {
        const isAlreadyIncluded = events.some(
          (e) => e.data?.negotiationId === neg.id && e.data?.roundNumber === round.roundNumber && e.actor === round.speaker,
        );
        if (!isAlreadyIncluded) {
          events.push({
            id: `rnd-${round.id}`,
            at: round.createdAt.toISOString(),
            stage: 'NEGOTIATION',
            actor: round.speaker,
            title: `${round.speaker === 'BUYER' ? 'Buyer Offer' : 'Merchant Counter'} Round ${round.roundNumber}: $${Number(round.price).toFixed(2)}`,
            explanation: round.rationale,
            status: 'pending',
            data: {
              negotiationId: neg.id,
              roundNumber: round.roundNumber,
              action: round.action,
              price: Number(round.price),
              speaker: round.speaker,
            },
          });
        }
      }
    }

    // Sort chronologically ascending
    events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    return {
      events,
      count: events.length,
    };
  }

  private mapActivityTypeToStage(type: string): TimelineStage {
    switch (type) {
      case 'INTENT_CREATED':
      case 'INTENT_ANALYZED':
        return 'INTENT';
      case 'PRODUCT_SEARCHED':
      case 'PRODUCT_SELECTED':
      case 'PLAN_CREATED':
      case 'PLAN_REVISED':
      case 'BUDGET_REPLANNED':
      case 'REPLAN_PROPOSED':
        return 'PLAN';
      case 'POLICY_CHECKED':
      case 'POLICY_BLOCKED':
        return 'POLICY';
      case 'RISK_ASSESSED':
        return 'RISK';
      case 'APPROVAL_REQUESTED':
      case 'APPROVAL_GRANTED':
      case 'APPROVAL_REJECTED':
        return 'APPROVAL';
      case 'PAYMENT_CREATED':
      case 'PAYMENT_CAPTURED':
      case 'PAYMENT_FAILED':
        return 'PAYPAL';
      case 'WEBHOOK_RECEIVED':
        return 'WEBHOOK';
      case 'AGENT_NEGOTIATED':
      case 'NEGOTIATION_ROUND':
        return 'NEGOTIATION';
      case 'FORBIDDEN_ACTION_BLOCKED':
        return 'RECOVERY';
      default:
        return 'PLAN';
    }
  }

  private mapActivityStatus(type: string): TimelineStatus {
    switch (type) {
      case 'POLICY_BLOCKED':
      case 'PAYMENT_FAILED':
      case 'APPROVAL_REJECTED':
      case 'FORBIDDEN_ACTION_BLOCKED':
        return 'blocked';
      case 'BUDGET_REPLANNED':
      case 'REPLAN_PROPOSED':
        return 'warn';
      case 'APPROVAL_REQUESTED':
        return 'pending';
      default:
        return 'ok';
    }
  }
}

