import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TimelineEmitter } from '../timeline/timeline.emitter.js';
import { LlmService } from '../agent/llm/llm.service.js';
import {
  type NegotiationContext,
  type NegotiationSpeaker,
  type RoundProposal,
  BuyerOfferSchema,
  MerchantOfferSchema,
  generateDeterministicRound,
  isMonotoneConcession,
  validateOfferBounds,
} from './negotiation.engine.js';
import { evaluate, type PolicyRules } from '../policy/policy.engine.js';
import { assess, type PlanRiskInput, type UserHistoryMetrics } from '../policy/risk.gate.js';

export interface SafeNegotiationResponse {
  id: string;
  userId: string;
  planId: string;
  status: string;
  initialPrice: number;
  agreedPrice: number | null;
  buyerCeiling: number;
  roundsCount: number;
  maxRounds: number;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
  rounds: Array<{
    id: string;
    roundNumber: number;
    speaker: string;
    action: string;
    price: number;
    rationale: string;
    createdAt: Date;
  }>;
  newPlan?: any;
}

@Injectable()
export class NegotiationService {
  private readonly logger = new Logger(NegotiationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly timelineEmitter: TimelineEmitter,
    private readonly llmService: LlmService,
  ) {}

  async startNegotiation(userId: string, planId: string): Promise<SafeNegotiationResponse> {
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

    if (plan.items.length === 0 || !plan.items[0]) {
      throw new BadRequestException('Plan contains no items to negotiate');
    }

    const policy = await this.prisma.userPolicy.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    if (!policy.allowNegotiation) {
      throw new ForbiddenException(
        'Autonomous agent negotiation is disabled by current user policy settings',
      );
    }

    const primaryItem = plan.items[0];
    const product = primaryItem.product;
    const initialPrice = Number(plan.total);
    const quantity = primaryItem.quantity || 1;
    const unitListPrice = Number(primaryItem.unitPrice);

    // Compute spend so far to determine exact buyer ceiling
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

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
        select: { amount: true, payment: { select: { plan: { select: { items: { select: { product: true } } } } } } },
      }),
      this.prisma.transaction.findMany({
        where: {
          userId,
          type: 'PAYMENT_CAPTURED',
          createdAt: { gte: new Date(now.getTime() - 10 * 60 * 1000) },
        },
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
      for (const it of items) {
        if (it.product?.category && !purchasedCategories.includes(it.product.category)) {
          purchasedCategories.push(it.product.category);
        }
      }
    }

    // Buyer ceiling strictly enforced: min(plan.total, maxTransactionAmount, dailyRemaining)
    const maxTxLimit = policy.maxTransactionAmount ? Number(policy.maxTransactionAmount) : initialPrice;
    const dailyRemaining = policy.dailySpendingLimit
      ? Math.max(0, Number(policy.dailySpendingLimit) - dailySpent)
      : initialPrice;
    const buyerCeiling = Math.min(initialPrice, maxTxLimit, dailyRemaining);

    // Merchant floor: server-side only! Never leak to buyer agent or client
    const minUnitFloor = product?.minPrice
      ? Number(product.minPrice)
      : Math.round(unitListPrice * 0.8 * 100) / 100;
    const merchantFloor = Math.round(minUnitFloor * quantity * 100) / 100;

    const maxRounds = policy.negotiationMaxRounds || 3;
    const context: NegotiationContext = {
      listPrice: initialPrice,
      buyerCeiling,
      merchantFloor,
      maxRounds,
    };

    // Create root Negotiation record
    const negotiation = await this.prisma.negotiation.create({
      data: {
        userId,
        planId,
        status: 'IN_PROGRESS',
        initialPrice: initialPrice.toFixed(2),
        buyerCeiling: buyerCeiling.toFixed(2),
        merchantFloor: merchantFloor.toFixed(2),
        maxRounds,
      },
    });

    const roundProposals: RoundProposal[] = [];
    let isAgreed = false;
    let finalAgreedPrice: number | null = null;
    let lastBuyerPrice = 0;
    let lastMerchantPrice = initialPrice;

    for (let roundNumber = 1; roundNumber <= maxRounds; roundNumber++) {
      // 1. Buyer Agent Turn
      let buyerOffer = await this.executeAgentStep(
        'BUYER',
        roundNumber,
        context,
        roundProposals,
        product?.name || primaryItem.productName,
      );

      // Deterministic validation & guards
      const buyerBounds = validateOfferBounds(buyerOffer.price, context, 'BUYER');
      const buyerMonotone =
        roundNumber === 1 || isMonotoneConcession(lastBuyerPrice, buyerOffer.price, 'BUYER');

      if (!buyerBounds.valid || !buyerMonotone) {
        this.logger.warn(
          `[Negotiation] Invalid Buyer LLM output at round ${roundNumber}: ${buyerBounds.reason || 'Concession regression'}. Falling back to deterministic rules.`,
        );
        buyerOffer = generateDeterministicRound(roundNumber, 'BUYER', context, roundProposals);
      }

      // Hard clamp guarantees
      buyerOffer.price = Math.min(buyerCeiling, Math.max(initialPrice * 0.5, buyerOffer.price));
      lastBuyerPrice = buyerOffer.price;

      roundProposals.push({
        roundNumber,
        speaker: 'BUYER',
        action: buyerOffer.action,
        price: buyerOffer.price,
        rationale: buyerOffer.rationale,
      });

      await this.prisma.negotiationRound.create({
        data: {
          negotiationId: negotiation.id,
          roundNumber,
          speaker: 'BUYER',
          action: buyerOffer.action,
          price: buyerOffer.price.toFixed(2),
          rationale: buyerOffer.rationale,
        },
      });

      const buyerAct = await this.prisma.agentActivity.create({
        data: {
          userId,
          intentId: plan.intentId,
          planId: plan.id,
          type: 'NEGOTIATION_ROUND',
          actor: 'BUYER',
          title: `Buyer Agent Round ${roundNumber}: $${buyerOffer.price.toFixed(2)}`,
          description: buyerOffer.rationale,
          metadata: {
            roundNumber,
            action: buyerOffer.action,
            price: buyerOffer.price,
            speaker: 'BUYER',
          },
        },
      });

      this.timelineEmitter.emit(userId, {
        id: buyerAct.id,
        at: buyerAct.createdAt.toISOString(),
        stage: 'NEGOTIATION',
        actor: 'BUYER',
        title: buyerAct.title,
        explanation: buyerOffer.rationale,
        status: 'pending',
        data: { negotiationId: negotiation.id, roundNumber, price: buyerOffer.price },
      });

      // 2. Merchant Agent Turn
      let merchantCounter = await this.executeAgentStep(
        'MERCHANT',
        roundNumber,
        context,
        roundProposals,
        product?.name || primaryItem.productName,
      );

      // Deterministic validation & guards
      const merchantBounds = validateOfferBounds(merchantCounter.price, context, 'MERCHANT');
      const merchantMonotone = isMonotoneConcession(lastMerchantPrice, merchantCounter.price, 'MERCHANT');

      if (!merchantBounds.valid || !merchantMonotone) {
        this.logger.warn(
          `[Negotiation] Invalid Merchant LLM output at round ${roundNumber}: ${merchantBounds.reason || 'Concession regression'}. Falling back to deterministic rules.`,
        );
        merchantCounter = generateDeterministicRound(roundNumber, 'MERCHANT', context, roundProposals);
      }

      // Hard clamp guarantees
      merchantCounter.price = Math.max(merchantFloor, Math.min(initialPrice, merchantCounter.price));
      lastMerchantPrice = merchantCounter.price;

      roundProposals.push({
        roundNumber,
        speaker: 'MERCHANT',
        action: merchantCounter.action,
        price: merchantCounter.price,
        rationale: merchantCounter.rationale,
      });

      await this.prisma.negotiationRound.create({
        data: {
          negotiationId: negotiation.id,
          roundNumber,
          speaker: 'MERCHANT',
          action: merchantCounter.action,
          price: merchantCounter.price.toFixed(2),
          rationale: merchantCounter.rationale,
        },
      });

      const merchantAct = await this.prisma.agentActivity.create({
        data: {
          userId,
          intentId: plan.intentId,
          planId: plan.id,
          type: 'NEGOTIATION_ROUND',
          actor: 'MERCHANT',
          title: `Merchant Agent Round ${roundNumber}: $${merchantCounter.price.toFixed(2)}`,
          description: merchantCounter.rationale,
          metadata: {
            roundNumber,
            action: merchantCounter.action,
            price: merchantCounter.price,
            speaker: 'MERCHANT',
          },
        },
      });

      this.timelineEmitter.emit(userId, {
        id: merchantAct.id,
        at: merchantAct.createdAt.toISOString(),
        stage: 'NEGOTIATION',
        actor: 'MERCHANT',
        title: merchantAct.title,
        explanation: merchantCounter.rationale,
        status: 'pending',
        data: { negotiationId: negotiation.id, roundNumber, price: merchantCounter.price },
      });

      // Check termination & agreement conditions
      if (
        buyerOffer.action === 'ACCEPT' ||
        merchantCounter.action === 'ACCEPT' ||
        buyerOffer.price >= merchantCounter.price - 0.01 ||
        (roundNumber === maxRounds && merchantCounter.price <= buyerCeiling)
      ) {
        isAgreed = true;
        finalAgreedPrice = Math.min(buyerCeiling, Math.max(merchantFloor, merchantCounter.price));
        break;
      }

      if (merchantCounter.action === 'REJECT' && roundNumber === maxRounds) {
        break;
      }
    }

    let replannedPlan: any = null;

    if (isAgreed && finalAgreedPrice != null) {
      // Create version+1 plan with negotiated unit price
      const roundsCount = roundProposals.filter((r) => r.speaker === 'MERCHANT').length;
      const unitAgreed = Math.round((finalAgreedPrice / quantity) * 100) / 100;
      const totalAgreed = Math.round(unitAgreed * quantity * 100) / 100;

      // Deterministic policy ceiling verification
      if (totalAgreed > buyerCeiling + 0.01) {
        throw new BadRequestException('Negotiated price cannot exceed authorized buyer ceiling');
      }

      const nextVersion = plan.version + 1;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute agreement window

      // Re-evaluate policy and risk for the new plan
      const policyRules: PolicyRules = {
        currency: policy.currency || 'USD',
        maxTransactionAmount: policy.maxTransactionAmount ? Number(policy.maxTransactionAmount) : null,
        dailySpendingLimit: policy.dailySpendingLimit ? Number(policy.dailySpendingLimit) : null,
        monthlySpendingLimit: policy.monthlySpendingLimit ? Number(policy.monthlySpendingLimit) : null,
        allowedCategories: policy.allowedCategories || [],
        blockedCategories: policy.blockedCategories || [],
        autoApproveCategories: policy.autoApproveCategories || [],
        allowAutoExecute: policy.allowAutoExecute ?? false,
        requireApprovalAbove: policy.requireApprovalAbove ? Number(policy.requireApprovalAbove) : null,
        autonomyMode: policy.autonomyMode as any,
      };

      const policyEval = evaluate(
        {
          total: totalAgreed,
          currency: 'USD',
          category: product?.category || plan.intent?.category,
          expiresAt,
          items: [{ quantity, product: { stock: product?.stock ?? 10, status: (product?.status as any) || 'ACTIVE' } }],
        },
        policyRules,
        { today: dailySpent, month: monthlySpent },
        now,
      );

      const riskInput: PlanRiskInput = {
        total: totalAgreed,
        category: product?.category || plan.intent?.category,
        quantity,
        catalogPriceAtCreation: initialPrice,
        currentCatalogPrice: initialPrice,
        minItemStock: product?.stock,
        negotiationInvolved: true,
        version: nextVersion,
      };

      const historyMetrics: UserHistoryMetrics = {
        typicalSpendAverage,
        pastPaymentsCount,
        dailySpentSoFar: dailySpent,
        dailySpendingLimit: policy.dailySpendingLimit ? Number(policy.dailySpendingLimit) : null,
        purchasedCategories,
        recentPaymentsIn10Min: recentTx.length,
      };

      const riskEval = assess(riskInput, historyMetrics);

      const isAuto =
        policyEval.decision === 'ALLOW_AUTO' &&
        riskEval.level !== 'HIGH' &&
        riskEval.level !== 'CRITICAL';

      const planStatus = isAuto ? 'APPROVED' : 'AWAITING_APPROVAL';

      replannedPlan = await this.prisma.$transaction(async (tx) => {
        // Create new plan version
        const newPlan = await tx.purchasePlan.create({
          data: {
            userId,
            intentId: plan.intentId,
            version: nextVersion,
            status: planStatus,
            subtotal: totalAgreed.toFixed(2),
            total: totalAgreed.toFixed(2),
            currency: 'USD',
            explanation: `Negotiated from $${initialPrice.toFixed(2)} to $${totalAgreed.toFixed(2)} over ${roundsCount} rounds.`,
            expiresAt,
            items: {
              create: {
                productId: primaryItem.productId,
                productName: primaryItem.productName,
                productSku: primaryItem.productSku,
                unitPrice: unitAgreed.toFixed(2),
                quantity,
                lineTotal: totalAgreed.toFixed(2),
                currency: 'USD',
              },
            },
          },
          include: {
            items: { include: { product: true } },
            intent: true,
          },
        });

        // Record risk assessment
        await tx.riskAssessment.create({
          data: {
            planId: newPlan.id,
            level: riskEval.level,
            score: riskEval.score,
            reasons: riskEval.reasons,
            policyPassed: policyEval.decision !== 'BLOCK',
            explanation: `Negotiated Plan Risk Score: ${riskEval.score}/100. Policy Decision: ${policyEval.decision}.`,
          },
        });

        // Record approval or auto-approval
        if (!isAuto) {
          await tx.approval.create({
            data: {
              userId,
              planId: newPlan.id,
              status: 'PENDING',
              expiresAt,
              decisionNote: `Negotiated purchase plan v${nextVersion}. ${policyEval.reasons.join(' ')}`,
            },
          });
        } else {
          await tx.purchaseIntent.update({
            where: { id: plan.intentId },
            data: { status: 'APPROVED' },
          });

          await tx.agentActivity.create({
            data: {
              userId,
              intentId: plan.intentId,
              planId: newPlan.id,
              type: 'APPROVAL_GRANTED',
              actor: 'AGENT',
              title: 'Auto-approved negotiated plan',
              description: `Negotiated purchase plan satisfies all deterministic autonomy rules.`,
              metadata: { autoApproved: true, negotiatedPrice: totalAgreed },
            },
          });
        }

        // Update root negotiation record
        await tx.negotiation.update({
          where: { id: negotiation.id },
          data: {
            status: 'AGREED',
            agreedPrice: totalAgreed.toFixed(2),
            roundsCount,
            summary: `Successfully agreed at $${totalAgreed.toFixed(2)} (saved $${(initialPrice - totalAgreed).toFixed(2)}) over ${roundsCount} rounds.`,
          },
        });

        return newPlan;
      });

      const agreedAct = await this.prisma.agentActivity.create({
        data: {
          userId,
          intentId: plan.intentId,
          planId: replannedPlan.id,
          type: 'AGENT_NEGOTIATED',
          actor: 'AGENT',
          title: `Negotiation Succeeded: $${totalAgreed.toFixed(2)}`,
          description: `Negotiated purchase plan v${replannedPlan.version} successfully created with 15-minute price hold.`,
          metadata: {
            initialPrice,
            agreedPrice: totalAgreed,
            savings: initialPrice - totalAgreed,
            roundsCount,
          },
        },
      });

      this.timelineEmitter.emit(userId, {
        id: agreedAct.id,
        at: agreedAct.createdAt.toISOString(),
        stage: 'NEGOTIATION',
        actor: 'AGENT',
        title: agreedAct.title,
        explanation: agreedAct.description || '',
        status: 'ok',
        data: { newPlanId: replannedPlan.id, agreedPrice: totalAgreed },
      });
    } else {
      // Failed negotiation
      const roundsCount = roundProposals.filter((r) => r.speaker === 'MERCHANT').length;
      await this.prisma.negotiation.update({
        where: { id: negotiation.id },
        data: {
          status: 'FAILED',
          roundsCount,
          summary: `Negotiation reached round cap (${roundsCount}) without mutual agreement. Original plan retained.`,
        },
      });

      const failedAct = await this.prisma.agentActivity.create({
        data: {
          userId,
          intentId: plan.intentId,
          planId: plan.id,
          type: 'AGENT_NEGOTIATED',
          actor: 'AGENT',
          title: 'Negotiation Concluded Without Agreement',
          description: 'No mutual discount agreed within round limit. Existing purchase plan remains active.',
          metadata: { initialPrice, status: 'FAILED' },
        },
      });

      this.timelineEmitter.emit(userId, {
        id: failedAct.id,
        at: failedAct.createdAt.toISOString(),
        stage: 'NEGOTIATION',
        actor: 'AGENT',
        title: failedAct.title,
        explanation: failedAct.description || '',
        status: 'warn',
        data: { negotiationId: negotiation.id, status: 'FAILED' },
      });
    }

    return this.findOne(userId, negotiation.id, replannedPlan);
  }

  async findOne(
    userId: string,
    negotiationId: string,
    newPlan?: any,
  ): Promise<SafeNegotiationResponse> {
    const record = await this.prisma.negotiation.findFirst({
      where: { id: negotiationId, userId },
      include: {
        rounds: {
          orderBy: [{ roundNumber: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`Negotiation '${negotiationId}' not found`);
    }

    // Exclude merchantFloor strictly from serialized output!
    return {
      id: record.id,
      userId: record.userId,
      planId: record.planId,
      status: record.status,
      initialPrice: Number(record.initialPrice),
      agreedPrice: record.agreedPrice ? Number(record.agreedPrice) : null,
      buyerCeiling: Number(record.buyerCeiling),
      roundsCount: record.roundsCount,
      maxRounds: record.maxRounds,
      summary: record.summary,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      rounds: record.rounds.map((r) => ({
        id: r.id,
        roundNumber: r.roundNumber,
        speaker: r.speaker,
        action: r.action,
        price: Number(r.price),
        rationale: r.rationale,
        createdAt: r.createdAt,
      })),
      newPlan,
    };
  }

  private async executeAgentStep(
    speaker: NegotiationSpeaker,
    roundNumber: number,
    context: NegotiationContext,
    history: RoundProposal[],
    productName: string,
  ): Promise<{ action: any; price: number; rationale: string }> {
    // If running in DEMO_MODE or without real LLM keys, use deterministic rule concession directly
    if (this.llmService.isDemoMode()) {
      return generateDeterministicRound(roundNumber, speaker, context, history);
    }

    try {
      if (speaker === 'BUYER') {
        const systemPrompt = `You are an autonomous corporate Buyer Procurement Agent.
Your goal is to acquire '${productName}' at the most favorable price for your organization.
CRITICAL CONSTRAINTS:
1. List price is $${context.listPrice.toFixed(2)}. Your absolute authorized budget ceiling is $${context.buyerCeiling.toFixed(2)}.
2. You must never offer above your ceiling.
3. Keep offers non-decreasing (monotonic concessions).
4. Provide a professional, concise procurement rationale.`;

        const userPrompt = `Current round: ${roundNumber} of ${context.maxRounds}.
History:
${JSON.stringify(history)}
Propose your next offer price and rationale.`;

        const result = await this.llmService.generateJson(BuyerOfferSchema, systemPrompt, userPrompt);
        return {
          action: roundNumber >= context.maxRounds ? 'ACCEPT' : 'COUNTER',
          price: result.offerPrice,
          rationale: result.rationale,
        };
      } else {
        const systemPrompt = `You are an authorized Merchant Sales Agent for '${productName}'.
CRITICAL CONSTRAINTS:
1. List price is $${context.listPrice.toFixed(2)}. Your hidden cost floor is $${context.merchantFloor.toFixed(2)}.
2. You must NEVER sell below your floor.
3. Concessions must be non-increasing (decreasing counter-offers).
4. Provide a realistic business justification.`;

        const userPrompt = `Current round: ${roundNumber} of ${context.maxRounds}.
History:
${JSON.stringify(history)}
Provide your action (ACCEPT, COUNTER, REJECT), price, and rationale.`;

        const result = await this.llmService.generateJson(MerchantOfferSchema, systemPrompt, userPrompt);
        return {
          action: result.action,
          price: result.price,
          rationale: result.rationale,
        };
      }
    } catch (err) {
      this.logger.warn(
        `[Negotiation] LLM call failed for ${speaker} round ${roundNumber}: ${(err as Error).message}. Falling back to deterministic concession.`,
      );
      return generateDeterministicRound(roundNumber, speaker, context, history);
    }
  }
}
