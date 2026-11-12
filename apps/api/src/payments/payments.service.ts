import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { PayPalClient } from '../paypal/paypal.client.js';
import { LedgerService } from '../ledger/ledger.service.js';
import {
  assertPaymentTransition,
  type PaymentStatus,
} from './payment.sm.js';
import { assertPlanTransition, type PlanStatus } from '../state-machines/plan.sm.js';
import { assertIntentTransition, type IntentStatus } from '../state-machines/intent.sm.js';
import { evaluate, type PolicyRules } from '../policy/policy.engine.js';
import { assess, applyRiskGate } from '../policy/risk.gate.js';
import { PolicyService } from '../policy/policy.service.js';
import { fromCents, sumCents } from '../common/money.js';

export type RecommendedNextAction =
  | 'RETRY_PAYMENT'
  | 'CHOOSE_ALTERNATIVE'
  | 'WAIT'
  | 'CONTACT_SUPPORT'
  | null;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paypalClient: PayPalClient,
    private readonly ledgerService: LedgerService,
    @Optional() private readonly policyService?: PolicyService,
  ) {}

  /**
   * Evaluates recovery action recommendation based on payment lifecycle state.
   * Agent must never claim success unless CAPTURED.
   */
  getRecommendedNextAction(payment: {
    status: string;
    updatedAt: Date;
    failureCode?: string | null;
  }): RecommendedNextAction {
    switch (payment.status) {
      case 'CAPTURED':
        return null; // Successfully paid and settled
      case 'FAILED':
        return 'RETRY_PAYMENT';
      case 'REVERSED':
        return 'CONTACT_SUPPORT';
      case 'CANCELLED':
        return 'CHOOSE_ALTERNATIVE';
      case 'CAPTURE_PENDING': {
        const ageMs = Date.now() - new Date(payment.updatedAt).getTime();
        return ageMs > 10 * 60 * 1000 ? 'CONTACT_SUPPORT' : 'WAIT';
      }
      case 'PAYER_ACTION_REQUIRED':
      case 'ORDER_CREATED':
      case 'CREATED':
      case 'APPROVED':
        return 'WAIT';
      default:
        return 'WAIT';
    }
  }

  async createPaymentOrder(userId: string, planId: string) {
    const plan = await this.prisma.purchasePlan.findFirst({
      where: { id: planId, userId },
      include: {
        items: { include: { product: true } },
        riskAssessments: { orderBy: { createdAt: 'desc' }, take: 1 },
        approvals: { orderBy: { createdAt: 'desc' }, take: 1 },
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

    // PayPal may invoke createOrder more than once while opening or retrying
    // the checkout popup. Reuse the active order instead of rejecting it after
    // the first request moved the plan to EXECUTING.
    if (plan.expiresAt && new Date() > new Date(plan.expiresAt)) {
      await this.prisma.agentActivity.create({
        data: {
          userId,
          planId: plan.id,
          intentId: plan.intentId,
          type: 'FORBIDDEN_ACTION_BLOCKED',
          actor: 'AGENT',
          title: 'Payment execution blocked on expired plan',
          description: `Plan expired at ${plan.expiresAt.toISOString()}. Payment authorization window has elapsed.`,
        },
      });
      throw new ForbiddenException('Purchase plan authorization has expired. Request fresh approval.');
    }

    const activePayment = await this.prisma.payment.findFirst({
      where: {
        userId,
        planId: plan.id,
        paypalOrderId: { not: null },
        status: { in: ['ORDER_CREATED', 'PAYER_ACTION_REQUIRED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activePayment?.paypalOrderId) {
      return {
        payment: activePayment,
        orderId: activePayment.paypalOrderId,
        status: activePayment.status,
        approveUrl: this.paypalClient.getApprovalUrl(activePayment.paypalOrderId),
      };
    }

    // 1. Plan status MUST be APPROVED
    if (plan.status !== 'APPROVED') {
      await this.prisma.agentActivity.create({
        data: {
          userId,
          planId: plan.id,
          intentId: plan.intentId,
          type: 'FORBIDDEN_ACTION_BLOCKED',
          actor: 'AGENT',
          title: 'Payment execution blocked on non-APPROVED plan',
          description: `Payment requested for plan in status '${plan.status}'. Payment execution is strictly forbidden unless plan is in APPROVED state.`,
          metadata: { planStatus: plan.status },
        },
      });

      throw new ForbiddenException(
        `Forbidden action: cannot create payment order for plan in '${plan.status}' state. Only APPROVED plans can proceed to payment.`,
      );
    }

    // 2. Approval window check
    const latestApproval = plan.approvals[0];
    if (latestApproval && latestApproval.expiresAt && new Date() > new Date(latestApproval.expiresAt)) {
      throw new ForbiddenException('User approval window has expired. Fresh authorization required.');
    }

    // 4. Fresh live policy + risk check at payment initiation
    const policy = await this.prisma.userPolicy.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    // Recompute total strictly from DB items (never trust LLM or client numbers)
    const recomputedSubtotal = plan.items.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.quantity,
      0,
    );
    const recomputedTotal = Math.round(recomputedSubtotal * 100) / 100;

    const policyRules: PolicyRules = {
      currency: policy.currency,
      autonomyMode: policy.autonomyMode as any,
      maxTransactionAmount: policy.maxTransactionAmount == null ? null : Number(policy.maxTransactionAmount),
      dailySpendingLimit: policy.dailySpendingLimit == null ? null : Number(policy.dailySpendingLimit),
      monthlySpendingLimit: policy.monthlySpendingLimit == null ? null : Number(policy.monthlySpendingLimit),
      requireApprovalAbove: policy.requireApprovalAbove == null ? null : Number(policy.requireApprovalAbove),
      allowAutoExecute: policy.allowAutoExecute,
      allowedCategories: policy.allowedCategories,
      blockedCategories: policy.blockedCategories,
      autoApproveCategories: policy.autoApproveCategories,
    };

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

    const dailySpent = fromCents(sumCents(...dailyTx.map((tx) => tx.amount)));
    const monthlySpent = fromCents(sumCents(...monthlyTx.map((tx) => tx.amount)));

    const firstItem = plan.items[0];
    const category = firstItem?.product?.category ?? plan.intent?.category ?? null;

    const livePolicyEval = evaluate(
      {
        total: recomputedTotal,
        currency: this.paypalClient.getCurrency(),
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
      { today: dailySpent, month: monthlySpent },
      now,
    );

    const liveRiskEval = assess(
      {
        total: recomputedTotal,
        category,
        quantity: firstItem?.quantity || 1,
        version: plan.version,
      },
      {
        dailySpentSoFar: dailySpent,
        dailySpendingLimit: policy.dailySpendingLimit == null ? null : Number(policy.dailySpendingLimit),
      },
    );

    const liveGated = applyRiskGate(livePolicyEval.decision, liveRiskEval);

    if (liveGated.decision === 'BLOCK') {
      await this.prisma.agentActivity.create({
        data: {
          userId,
          planId: plan.id,
          intentId: plan.intentId,
          type: 'POLICY_BLOCKED',
          actor: 'AGENT',
          title: 'Payment blocked by live policy check',
          description: livePolicyEval.violations.join('; ') || 'Live policy verification failed.',
          metadata: { violations: livePolicyEval.violations },
        },
      });

      throw new BadRequestException(
        `Cannot initiate payment: purchase plan has unresolved policy violations (${livePolicyEval.violations.join('; ')})`,
      );
    }

    // 5. Unique Idempotency Key = hash(planId + approvalId)
    const approvalId = latestApproval?.id ?? 'pre-approved';
    const idempotencyKey = createHash('sha256')
      .update(`${plan.id}:${approvalId}`)
      .digest('hex');

    // Check for existing payment under this idempotency key
    const existingPayment = await this.prisma.payment.findUnique({
      where: { idempotencyKey },
    });

    if (existingPayment?.paypalOrderId) {
      return {
        payment: existingPayment,
        orderId: existingPayment.paypalOrderId,
        status: existingPayment.status,
        approveUrl: this.paypalClient.getApprovalUrl(existingPayment.paypalOrderId),
      };
    }

    const paypalCurrency = this.paypalClient.getCurrency();

    // 6. Create initial Payment record in DB with ORDER_CREATED
    const payment = await this.prisma.payment.upsert({
      where: { idempotencyKey },
      create: {
        userId,
        planId: plan.id,
        status: 'ORDER_CREATED',
        amount: recomputedTotal.toFixed(2),
        currency: paypalCurrency,
        idempotencyKey,
      },
      update: {},
    });

    // 7. Call PayPal REST API Orders v2
    const order = await this.paypalClient.createOrder({
      idempotencyKey,
      referenceId: plan.id,
      customId: payment.id,
      invoiceId: payment.id,
      description: `PayPilot Plan #${plan.id.slice(-6)}`,
      currency: paypalCurrency,
      total: recomputedTotal,
      subtotal: recomputedTotal,
      items: plan.items.map((item) => ({
        name: item.productName,
        sku: item.productSku,
        unitPrice: Number(item.unitPrice),
        quantity: item.quantity,
      })),
    });

    // 8. Progress state inside transaction
    return this.prisma.$transaction(async (tx) => {
      assertPaymentTransition('ORDER_CREATED', 'PAYER_ACTION_REQUIRED');
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          paypalOrderId: order.id,
          status: 'PAYER_ACTION_REQUIRED',
        },
      });

      assertPlanTransition(plan.status as PlanStatus, 'EXECUTING');
      await tx.purchasePlan.update({
        where: { id: plan.id },
        data: { status: 'EXECUTING' },
      });

      if (plan.intent) {
        assertIntentTransition(plan.intent.status as IntentStatus, 'EXECUTING');
        await tx.purchaseIntent.update({
          where: { id: plan.intentId },
          data: { status: 'EXECUTING' },
        });
      }

      await tx.agentActivity.create({
        data: {
          userId,
          intentId: plan.intentId,
          planId: plan.id,
          paymentId: payment.id,
          type: 'PAYMENT_CREATED',
          actor: 'AGENT',
          title: 'PayPal order created',
          description: `Order ${order.id} initiated via PayPal Orders v2 for $${recomputedTotal.toFixed(2)}. Status: PAYER_ACTION_REQUIRED.`,
          metadata: {
            paypalOrderId: order.id,
            amount: recomputedTotal.toFixed(2),
            idempotencyKey,
          },
        },
      });

      const approveUrl = order.links?.find((l) => l.rel === 'approve')?.href;

      return {
        payment: updatedPayment,
        orderId: order.id,
        approveUrl,
      };
    });
  }

  async capturePayment(userId: string, paymentId: string, orderId?: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
      include: {
        plan: {
          include: { items: true, intent: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment record '${paymentId}' not found`);
    }
    await this.policyService?.assertAgentActive(userId, {
      planId: payment.planId,
      intentId: payment.plan.intentId,
      paymentId: payment.id,
    });

    if (payment.status === 'CAPTURED') {
      return {
        payment,
        captureId: payment.paypalCaptureId,
        status: 'CAPTURED',
        webhookConfirmed: Boolean(payment.webhookConfirmedAt),
        message: 'Payment already captured and settled.',
      };
    }

    if (!payment.paypalOrderId) {
      throw new BadRequestException('Payment does not have an active PayPal Order ID.');
    }

    // Verify orderId matches payment if passed
    if (orderId && payment.paypalOrderId !== orderId) {
      throw new BadRequestException(
        `Provided orderId '${orderId}' does not match registered order '${payment.paypalOrderId}' for this payment.`,
      );
    }

    assertPaymentTransition(payment.status as PaymentStatus, 'CAPTURE_PENDING');

    const captureIdempotencyKey = `${payment.id}:capture`;

    // 1. Move to CAPTURE_PENDING
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'CAPTURE_PENDING' },
    });

    // 2. Call PayPal Capture Order API
    const captureResult = await this.paypalClient.captureOrder(
      payment.paypalOrderId,
      captureIdempotencyKey,
      { total: Number(payment.amount), currency: payment.currency },
    );

    const capture = captureResult.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId = capture?.id ?? captureResult.id;
    const isCompleted = captureResult.status === 'COMPLETED' || capture?.status === 'COMPLETED';

    if (isCompleted) {
      const now = new Date();

      return this.prisma.$transaction(async (tx) => {
        // Update payment: mark CAPTURED, but webhookConfirmedAt remains null until webhook arrives
        assertPaymentTransition('CAPTURE_PENDING', 'CAPTURED');
        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'CAPTURED',
            paypalCaptureId: captureId,
            paypalPayerId: captureResult.payer?.payer_id ?? null,
            capturedAt: now,
          },
        });

        // Immutable transaction ledger record
        await this.ledgerService.record(
          {
            type: 'PAYMENT_CAPTURED',
            userId,
            paymentId: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            externalReference: captureId,
            idempotencyKey: `${captureId}:PAYMENT_CAPTURED`,
            description: `PayPal capture settled: Order ${payment.paypalOrderId}, Capture ${captureId}`,
            metadata: {
              orderId: payment.paypalOrderId,
              captureId,
              status: captureResult.status,
            },
          },
          tx,
        );

        // Mark plan and intent COMPLETED
        assertPlanTransition(payment.plan.status as PlanStatus, 'COMPLETED');
        await tx.purchasePlan.update({
          where: { id: payment.planId },
          data: { status: 'COMPLETED' },
        });

        if (payment.plan.intent) {
          assertIntentTransition(payment.plan.intent.status as IntentStatus, 'COMPLETED');
          await tx.purchaseIntent.update({
            where: { id: payment.plan.intentId },
            data: { status: 'COMPLETED' },
          });
        }

        await tx.agentActivity.create({
          data: {
            userId,
            intentId: payment.plan.intentId,
            planId: payment.planId,
            paymentId: payment.id,
            type: 'PAYMENT_CAPTURED',
            actor: 'AGENT',
            title: 'Payment captured via PayPal Orders v2',
            description: `Funds captured via PayPal (Capture ID: ${captureId}). Recorded to immutable ledger. Awaiting authoritative webhook confirmation.`,
            metadata: {
              captureId,
              orderId: payment.paypalOrderId,
              amount: payment.amount.toString(),
            },
          },
        });

        return {
          payment: updatedPayment,
          captureId,
          status: 'CAPTURED',
          webhookConfirmed: false,
          message: 'Payment captured successfully. Recorded to immutable ledger; webhook confirmation pending.',
        };
      });
    }

    return {
      payment: await this.prisma.payment.findUnique({ where: { id: payment.id } }),
      status: 'CAPTURE_PENDING',
      webhookConfirmed: false,
      message: 'Payment capture is currently pending authorization from PayPal.',
    };
  }

  async cancelPayment(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
      include: { plan: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment '${paymentId}' not found`);
    }
    await this.policyService?.assertAgentActive(userId, {
      planId: payment.planId,
      intentId: payment.plan.intentId,
      paymentId: payment.id,
    });

    if (payment.status === 'CAPTURED') {
      throw new BadRequestException('Cannot cancel an already captured payment.');
    }

    assertPaymentTransition(payment.status as PaymentStatus, 'CANCELLED');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'CANCELLED' },
      });

      await tx.agentActivity.create({
        data: {
          userId,
          paymentId: payment.id,
          planId: payment.planId,
          type: 'SYSTEM_EVENT',
          actor: 'USER',
          title: 'Payment cancelled',
          description: 'User aborted payment prior to settlement.',
        },
      });

      return updated;
    });
  }

  async findAll(userId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: { include: { items: true } },
        transactions: true,
        activities: { orderBy: { createdAt: 'asc' } },
      },
    });

    return payments.map((p) => ({
      ...p,
      recommendedNextAction: this.getRecommendedNextAction(p),
    }));
  }

  async findOne(userId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, userId },
      include: {
        plan: { include: { items: true, intent: true } },
        transactions: true,
        activities: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment record '${id}' not found`);
    }

    return {
      ...payment,
      recommendedNextAction: this.getRecommendedNextAction(payment),
    };
  }
}
