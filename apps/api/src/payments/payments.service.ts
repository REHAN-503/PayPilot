import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { PayPalService } from './paypal.service.js';
import {
  transitionIntentStatus,
  transitionPaymentStatus,
  transitionPlanStatus,
} from '../common/state/state-machine.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paypalService: PayPalService,
  ) {}

  async createPaymentOrder(userId: string, planId: string) {
    const plan = await this.prisma.purchasePlan.findFirst({
      where: { id: planId, userId },
      include: {
        items: true,
        riskAssessments: { orderBy: { createdAt: 'desc' }, take: 1 },
        intent: true,
      },
    });

    if (!plan) {
      throw new NotFoundException('Purchase plan not found');
    }

    // Rule 1 & Requirement 7: Only PaymentsService may call PayPal, and only when plan.status == APPROVED
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

    // Verify policy check passed
    const latestRisk = plan.riskAssessments[0];
    if (latestRisk && !latestRisk.policyPassed) {
      throw new BadRequestException(
        'Cannot initiate payment: purchase plan has unresolved policy violations.',
      );
    }

    // Check for existing pending/active payment
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        planId: plan.id,
        status: { in: ['ORDER_CREATED', 'PAYER_ACTION_REQUIRED', 'CAPTURE_PENDING'] },
      },
    });

    if (existingPayment?.paypalOrderId) {
      return {
        payment: existingPayment,
        orderId: existingPayment.paypalOrderId,
      };
    }

    // Rule 9: Idempotency key for request and DB
    const idempotencyKey = randomUUID();

    // Call PayPal REST API Orders v2
    const order = await this.paypalService.createOrder({
      planId: plan.id,
      total: Number(plan.total),
      subtotal: Number(plan.subtotal),
      items: plan.items.map((item) => ({
        name: item.productName,
        sku: item.productSku,
        unitPrice: Number(item.unitPrice),
        quantity: item.quantity,
      })),
      idempotencyKey,
    });

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          userId,
          planId: plan.id,
          status: 'ORDER_CREATED',
          amount: plan.total,
          currency: 'USD',
          paypalOrderId: order.id,
          idempotencyKey,
        },
      });

      const nextPlanStatus = transitionPlanStatus(plan.status as any, 'EXECUTING');
      const nextIntentStatus = transitionIntentStatus(plan.intent.status as any, 'EXECUTING');

      await tx.purchasePlan.update({
        where: { id: plan.id },
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
          planId: plan.id,
          paymentId: payment.id,
          type: 'PAYMENT_CREATED',
          title: 'PayPal order created',
          description: `Order ${order.id} initiated via PayPal Sandbox for $${Number(plan.total).toFixed(2)}.`,
          metadata: {
            paypalOrderId: order.id,
            amount: plan.total.toString(),
            idempotencyKey,
          },
        },
      });

      return {
        payment,
        orderId: order.id,
        approveUrl: order.approveUrl,
      };
    });
  }

  async capturePayment(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
      include: {
        plan: {
          include: { intent: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment record not found');
    }

    if (payment.status === 'CAPTURED') {
      return { payment, message: 'Payment already captured and settled.' };
    }

    if (!payment.paypalOrderId) {
      throw new BadRequestException('Payment does not have a valid PayPal Order ID.');
    }

    // Validate state transition
    transitionPaymentStatus(payment.status as any, 'CAPTURE_PENDING');

    const captureIdempotencyKey = randomUUID();

    // Call PayPal Orders v2 Capture
    const captureResult = await this.paypalService.captureOrder(
      payment.paypalOrderId,
      captureIdempotencyKey,
    );

    const now = new Date();
    const targetPaymentStatus = transitionPaymentStatus('CAPTURE_PENDING', 'CAPTURED');
    const targetPlanStatus = transitionPlanStatus(payment.plan.status as any, 'COMPLETED');
    const targetIntentStatus = transitionIntentStatus(payment.plan.intent.status as any, 'COMPLETED');

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Payment status
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: targetPaymentStatus,
          paypalCaptureId: captureResult.captureId,
          paypalPayerId: captureResult.payerId ?? null,
          capturedAt: now,
        },
      });

      // 2. Append immutable Transaction ledger record (Rule 8)
      await tx.transaction.create({
        data: {
          userId,
          paymentId: payment.id,
          type: 'PAYMENT_CAPTURED',
          amount: payment.amount,
          currency: 'USD',
          externalReference: captureResult.captureId,
          idempotencyKey: captureIdempotencyKey,
          description: `PayPal capture settled: Order ${payment.paypalOrderId}, Capture ${captureResult.captureId}`,
          metadata: {
            orderId: payment.paypalOrderId,
            captureId: captureResult.captureId,
            status: captureResult.status,
          },
        },
      });

      // 3. Mark Plan and Intent COMPLETED
      await tx.purchasePlan.update({
        where: { id: payment.planId },
        data: { status: targetPlanStatus },
      });

      await tx.purchaseIntent.update({
        where: { id: payment.plan.intentId },
        data: { status: targetIntentStatus },
      });

      // 4. Log Agent Activity
      await tx.agentActivity.create({
        data: {
          userId,
          intentId: payment.plan.intentId,
          planId: payment.planId,
          paymentId: payment.id,
          type: 'PAYMENT_CAPTURED',
          title: 'Payment captured and verified',
          description: `Funds captured via PayPal (Capture ID: ${captureResult.captureId}). Recorded to immutable ledger.`,
          metadata: {
            captureId: captureResult.captureId,
            orderId: payment.paypalOrderId,
            amount: payment.amount.toString(),
          },
        },
      });

      return {
        payment: updatedPayment,
        captureId: captureResult.captureId,
        message: 'Payment successfully captured and recorded to the immutable ledger.',
      };
    });
  }

  async findOne(userId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, userId },
      include: {
        transactions: true,
        plan: { include: { items: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }
}

