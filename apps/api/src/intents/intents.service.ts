import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { LlmService } from '../agent/llm/llm.service.js';
import { LlmUnavailableError } from '../agent/llm/llm-errors.js';
import {
  parseIntentWithLlm,
  sanitizeUserPrompt,
  type ParsedIntent,
} from '../agent/intent-parser.js';
import {
  rankAndPlanWithLlm,
  type CandidateProduct,
} from '../agent/planner.js';
import {
  evaluate as evaluatePolicyNew,
  type PolicyRules,
  type PolicyEvaluationResult as NewPolicyResult,
} from '../policy/policy.engine.js';
import {
  assess as assessRiskNew,
  applyRiskGate,
  type RiskAssessmentResult as NewRiskResult,
} from '../policy/risk.gate.js';
import { ReplanService } from '../replan/replan.service.js';
import { toCents, fromCents, sumCents } from '../common/money.js';
import type { LlmRequestMode } from '../agent/llm/llm.service.js';

export type ActivityCallback = (activity: any) => void;

@Injectable()
export class IntentsService {
  private readonly logger = new Logger(IntentsService.name);
  private readonly demoMode: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly llmService: LlmService,
    private readonly replanService: ReplanService,
  ) {
    this.demoMode = this.config.get<string>('DEMO_MODE') === 'true';
  }

  async calculateHistoricalSpend(userId: string) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [dailyTransactions, monthlyTransactions] = await Promise.all([
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

    const dailySpentCents = sumCents(...dailyTransactions.map((tx) => tx.amount));
    const monthlySpentCents = sumCents(...monthlyTransactions.map((tx) => tx.amount));

    return { dailySpent: fromCents(dailySpentCents), monthlySpent: fromCents(monthlySpentCents) };
  }

  async create(
    userId: string,
    rawInput: string,
    onActivity?: ActivityCallback,
    requestMode?: LlmRequestMode,
  ) {
    const isDemoUser = requestMode === 'demo';
    // 1. Fetch or initialize user policy
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
      },
      update: {},
    });

    const policyCeiling = policy.maxTransactionAmount == null ? null : Number(policy.maxTransactionAmount);
    const { dailySpent, monthlySpent } = await this.calculateHistoricalSpend(userId);

    // Detect adversarial prompt injection indicators in raw text
    const lowerInput = rawInput.toLowerCase();
    const isAdversarial =
      lowerInput.includes('ignore') ||
      lowerInput.includes('previous instructions') ||
      lowerInput.includes('no approval') ||
      lowerInput.includes('bypass');

    // 2. Parse intent via LLM (with fallback to regex parser on LlmUnavailableError)
    let parsedIntent: ParsedIntent;
    let intentLlm: any = null;
    let fallbackUsed = false;
    let fallbackReason: string | undefined;
    let wasClamped = false;

    try {
      const result = await parseIntentWithLlm(
        this.llmService,
        rawInput,
        policyCeiling,
        requestMode,
      );
      parsedIntent = result.intent;
      wasClamped = result.wasClamped;
      intentLlm = result.llm;
      fallbackUsed = result.fallbackUsed || result.llm?.fallbackUsed === true;
      fallbackReason = result.fallbackReason || result.llm?.fallbackReason;
    } catch (err) {
      if (err instanceof LlmUnavailableError) {
        if (
          requestMode === 'live' ||
          (!isDemoUser && (this.llmService.isForceLive() || this.llmService.isLiveRequired()))
        ) {
          throw err;
        }
        this.logger.warn(`LLM unavailable for intent parsing, using deterministic fallback: ${err.message}`);
        fallbackUsed = true;
        fallbackReason = err.message;
        const sanitized = sanitizeUserPrompt(rawInput);
        const budgetMatch = sanitized.match(/\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
        const extractedBudget = budgetMatch ? Number(budgetMatch[1].replace(/,/g, '')) : null;
        const maxBudget = extractedBudget != null
          ? Math.min(extractedBudget, policyCeiling ?? Infinity)
          : policyCeiling ?? null;

        parsedIntent = {
          goal: sanitized,
          category: 'Electronics',
          minBudget: null,
          maxBudget,
          mustHave: [],
          niceToHave: [],
          useCase: sanitized,
          urgency: 'NORMAL',
          quantity: 1,
          riskNotes: isAdversarial ? ['Adversarial patterns flagged by fallback parser.'] : [],
        };
        intentLlm = {
          provider: 'fixture',
          model: this.llmService.getModelName(),
          latencyMs: 0,
          mode: 'live+fallback',
          fallbackUsed: true,
          fallbackReason,
          attempts: 0,
        };
      } else {
        throw err;
      }
    }

    let lastPolicyEvaluation: NewPolicyResult | null = null;
    let wasBlocked = false;
    let planLlm: any = null;

    const result = await this.prisma.$transaction(async (tx) => {
      // Helper to persist and notify activity listeners
      const emit = async (data: {
        intentId?: string;
        planId?: string;
        type: any;
        actor?: string;
        title: string;
        description?: string;
        metadata?: any;
      }) => {
        const act = await tx.agentActivity.create({
          data: {
            userId,
            intentId: data.intentId,
            planId: data.planId,
            type: data.type,
            actor: data.actor ?? 'AGENT',
            title: data.title,
            description: data.description,
            metadata: data.metadata,
          },
        });
        if (onActivity) {
          try {
            onActivity(act);
          } catch {
            // listener error should not abort transaction
          }
        }
        return act;
      };

      // 4. Persist Initial PurchaseIntent
      const intent = await tx.purchaseIntent.create({
        data: {
          userId,
          rawInput,
          interpretedGoal: parsedIntent.goal,
          category: parsedIntent.category,
          minBudget: parsedIntent.minBudget,
          maxBudget: parsedIntent.maxBudget,
          currency: 'USD',
          preferences: parsedIntent.mustHave,
          constraints: {
            minBudget: parsedIntent.minBudget,
            maxBudget: parsedIntent.maxBudget,
            quantity: parsedIntent.quantity,
            useCase: parsedIntent.useCase,
            urgency: parsedIntent.urgency,
          },
          status: 'PROCESSING',
        },
      });

      await emit({
        intentId: intent.id,
        type: 'INTENT_CREATED',
        actor: 'AGENT',
        title: 'Purchase intent recorded',
        description: `User goal: "${rawInput.slice(0, 100)}"`,
        metadata: { rawInput },
      });

      if (fallbackUsed || intentLlm?.fallbackUsed) {
        await emit({
          intentId: intent.id,
          type: 'SYSTEM_EVENT',
          actor: 'SYSTEM',
          title: 'llm.fallback',
          description: 'LLM output fell back to deterministic parsing after provider failure or unavailability.',
          metadata: {
            event: 'llm.fallback',
            stage: 'intent',
            reason: fallbackReason || intentLlm?.fallbackReason || 'LLM unavailable',
            provider: intentLlm?.provider ?? 'fixture',
            model: intentLlm?.model ?? this.llmService.getModelName(),
            latencyMs: intentLlm?.latencyMs ?? null,
            attempts: intentLlm?.attempts ?? 0,
            mode: intentLlm?.mode ?? 'live+fallback',
          },
        });
      }

      await emit({
        intentId: intent.id,
        type: 'INTENT_ANALYZED',
        actor: 'AGENT',
        title: 'Intent parsed by PayPilot agent',
        description: parsedIntent.goal,
        metadata: {
          category: parsedIntent.category,
          maxBudget: parsedIntent.maxBudget,
          mustHave: parsedIntent.mustHave,
          useCase: parsedIntent.useCase,
          wasClamped,
          llm: intentLlm,
        },
      });

      // Log prompt injection neutralization if adversarial indicators present
      if (isAdversarial || parsedIntent.riskNotes.some((n) => n.includes('neutralized') || n.includes('Adversarial'))) {
        await emit({
          intentId: intent.id,
          type: 'FORBIDDEN_ACTION_BLOCKED',
          actor: 'AGENT',
          title: 'Adversarial instruction neutralized',
          description: 'Adversarial instruction attempting to bypass policy or user authorization was blocked. Mandatory spending guardrails remain enforced.',
          metadata: { riskNotes: parsedIntent.riskNotes },
        });
      }

      // 5. Query candidate products: top 12 by SQL filter on category/budget ± 20%
      const maxBudgetNum = parsedIntent.maxBudget != null ? Number(parsedIntent.maxBudget) : null;
      const minBudgetNum = parsedIntent.minBudget != null ? Number(parsedIntent.minBudget) : null;
      const upperPrice = maxBudgetNum != null ? maxBudgetNum * 1.2 : undefined;
      const lowerPrice = minBudgetNum != null ? minBudgetNum * 0.8 : undefined;

      let candidateProducts = await tx.product.findMany({
        where: {
          status: 'ACTIVE',
          ...(parsedIntent.category
            ? { category: { equals: parsedIntent.category, mode: 'insensitive' } }
            : {}),
          ...(upperPrice != null || lowerPrice != null
            ? {
                price: {
                  ...(upperPrice != null ? { lte: upperPrice } : {}),
                  ...(lowerPrice != null ? { gte: lowerPrice } : {}),
                },
              }
            : {}),
        },
        take: 12,
        orderBy: { price: 'asc' },
      });

      // If category/price filter returns fewer than 3 candidates, expand search
      if (candidateProducts.length < 3) {
        const categoryItems = await tx.product.findMany({
          where: {
            status: 'ACTIVE',
            ...(parsedIntent.category
              ? { category: { equals: parsedIntent.category, mode: 'insensitive' } }
              : {}),
          },
          take: 12,
          orderBy: { price: 'asc' },
        });
        const seen = new Set(candidateProducts.map((c) => c.id));
        for (const item of categoryItems) {
          if (!seen.has(item.id)) {
            candidateProducts.push(item);
            seen.add(item.id);
          }
        }
      }

      // If still empty (e.g. unknown category), load top active items
      if (candidateProducts.length === 0) {
        candidateProducts = await tx.product.findMany({
          where: { status: 'ACTIVE' },
          take: 12,
          orderBy: { price: 'asc' },
        });
      }

      await emit({
        intentId: intent.id,
        type: 'PRODUCT_SEARCHED',
        actor: 'AGENT',
        title: 'Product catalog searched',
        description: `Found ${candidateProducts.length} candidate catalog products.`,
        metadata: {
          candidateCount: candidateProducts.length,
          candidates: candidateProducts.map((c) => ({ sku: c.sku, name: c.name, price: Number(c.price) })),
        },
      });

      // 6. Rank and plan with LLM planner (verifies candidate IDs, rejects hallucinated IDs, recomputes prices)
      const planExecution = await rankAndPlanWithLlm(
        this.llmService,
        parsedIntent,
        candidateProducts as CandidateProduct[],
        rawInput,
        requestMode,
      );
      planLlm = planExecution.llm;

      if (planLlm?.fallbackUsed) {
        await emit({
          intentId: intent.id,
          type: 'SYSTEM_EVENT',
          actor: 'SYSTEM',
          title: 'llm.fallback',
          description: 'LLM planner fell back to fixture output after provider failure.',
          metadata: {
            event: 'llm.fallback',
            stage: 'plan',
            reason: planLlm.fallbackReason || 'LLM planner fallback',
            provider: planLlm.provider,
            model: planLlm.model,
            latencyMs: planLlm.latencyMs,
            attempts: planLlm.attempts,
            mode: planLlm.mode,
          },
        });
      }

      await emit({
        intentId: intent.id,
        type: 'PRODUCT_SELECTED',
        actor: 'AGENT',
        title: 'Product recommended',
        description: `${planExecution.pickedProduct.name} (${planExecution.pickedProduct.sku}) selected at $${planExecution.unitPrice.toFixed(2)}.`,
        metadata: {
          sku: planExecution.pickedProduct.sku,
          price: planExecution.unitPrice,
          productId: planExecution.pickedProduct.id,
          reasoning: planExecution.reasoning,
          llm: planLlm,
        },
      });

      // 7. NEW Deterministic Policy Engine evaluation (Rule 3)
      const firstItem = planExecution.pickedProduct;
      const category = firstItem?.category ?? parsedIntent.category ?? null;

      const policyRules: PolicyRules = {
        currency: policy.currency,
        autonomyMode: policy.autonomyMode as any,
        maxTransactionAmount: policy.maxTransactionAmount == null ? null : Number(policy.maxTransactionAmount),
        dailySpendingLimit: policy.dailySpendingLimit == null ? null : Number(policy.dailySpendingLimit),
        monthlySpendingLimit: policy.monthlySpendingLimit == null ? null : Number(policy.monthlySpendingLimit),
        requireApprovalAbove: policy.requireApprovalAbove == null ? null : Number(policy.requireApprovalAbove),
        allowAutoExecute: policy.allowAutoExecute,
        allowedCategories: policy.allowedCategories ?? [],
        blockedCategories: policy.blockedCategories ?? [],
        autoApproveCategories: policy.autoApproveCategories ?? [],
      };

      const policyEvaluation: NewPolicyResult = evaluatePolicyNew(
        {
          total: toCents(planExecution.total),
          currency: 'USD',
          category,
        },
        policyRules,
        { today: dailySpent, month: monthlySpent },
      );

      // 8. NEW Deterministic Risk Assessment (Rule 3)
      const riskEvaluation: NewRiskResult = assessRiskNew(
        {
          total: planExecution.total,
          category,
          quantity: planExecution.quantity,
          version: 1,
        },
        {
          dailySpentSoFar: dailySpent,
          dailySpendingLimit: policy.dailySpendingLimit == null ? null : Number(policy.dailySpendingLimit),
        },
      );

      // 9. Apply risk gate on policy decision
      const gated = applyRiskGate(policyEvaluation.decision, riskEvaluation);

      // 10. Determine plan status based on gated decision
      const isAutoApproved = gated.decision === 'ALLOW_AUTO';
      const isBlocked = gated.decision === 'BLOCK';

      lastPolicyEvaluation = policyEvaluation;
      wasBlocked = isBlocked;

      let planStatus: 'APPROVED' | 'AWAITING_APPROVAL' | 'REJECTED' = isBlocked
        ? 'REJECTED'
        : isAutoApproved
          ? 'APPROVED'
          : 'AWAITING_APPROVAL';
      const intentStatus: 'APPROVED' | 'AWAITING_APPROVAL' = isAutoApproved
        ? 'APPROVED'
        : 'AWAITING_APPROVAL';

      // 11. Persist PurchasePlan with alternatives and tradeoffs
      const plan = await tx.purchasePlan.create({
        data: {
          userId,
          intentId: intent.id,
          version: 1,
          status: planStatus,
          subtotal: planExecution.subtotal.toFixed(2),
          tax: planExecution.tax.toFixed(2),
          shipping: planExecution.shipping.toFixed(2),
          discount: planExecution.discount.toFixed(2),
          total: planExecution.total.toFixed(2),
          currency: 'USD',
          explanation: planExecution.reasoning,
          alternatives: planExecution.alternatives.map((a) => ({
            productId: a.product.id,
            sku: a.product.sku,
            name: a.product.name,
            price: Number(a.product.price),
            reason: a.reason,
          })),
          tradeoffs: planExecution.tradeoffs,
          items: {
            create: {
              productId: planExecution.pickedProduct.id,
              productName: planExecution.pickedProduct.name,
              productSku: planExecution.pickedProduct.sku,
              unitPrice: planExecution.unitPrice.toFixed(2),
              quantity: planExecution.quantity,
              lineTotal: planExecution.total.toFixed(2),
              currency: 'USD',
            },
          },
        },
        include: {
          items: true,
        },
      });

      // 12. Persist RiskAssessment (uses new risk gate result)
      const riskRecord = await tx.riskAssessment.create({
        data: {
          planId: plan.id,
          level: riskEvaluation.level,
          score: riskEvaluation.score,
          reasons: riskEvaluation.reasons,
          policyPassed: policyEvaluation.decision !== 'BLOCK',
          explanation: `Risk Score: ${riskEvaluation.score}/100 (${riskEvaluation.level}). Policy: ${policyEvaluation.decision}.`,
        },
      });

      // 13. Create Approval row if manual review required (not blocked)
      let approvalRecord: any = null;
      if (!isAutoApproved && !isBlocked) {
        approvalRecord = await tx.approval.create({
          data: {
            userId,
            planId: plan.id,
            status: 'PENDING',
            decisionNote:
              policyEvaluation.reasons[0] ||
              policyEvaluation.violations[0] ||
              'Awaiting explicit user authorization.',
          },
        });
      }

      // Update Intent status
      await tx.purchaseIntent.update({
        where: { id: intent.id },
        data: { status: intentStatus },
      });

      // 14. Emit Policy & Risk activities
      if (policyEvaluation.decision !== 'BLOCK') {
        await emit({
          intentId: intent.id,
          planId: plan.id,
          type: 'POLICY_CHECKED',
          actor: 'AGENT',
          title: 'Spending policy passed',
          description: policyEvaluation.reasons.join('; ') || 'All deterministic limit checks passed.',
          metadata: { passed: true, decision: policyEvaluation.decision, violations: [] },
        });
      } else {
        await emit({
          intentId: intent.id,
          planId: plan.id,
          type: 'POLICY_BLOCKED',
          actor: 'AGENT',
          title: 'Spending policy violation detected',
          description: policyEvaluation.violations.join('; '),
          metadata: { passed: false, decision: 'BLOCK', violations: policyEvaluation.violations },
        });
      }

      await emit({
        intentId: intent.id,
        planId: plan.id,
        type: 'RISK_ASSESSED',
        actor: 'AGENT',
        title: `Risk evaluated: ${riskEvaluation.level} (${riskEvaluation.score}/100)`,
        description: riskEvaluation.reasons[0] || 'Baseline risk evaluation completed.',
        metadata: {
          level: riskEvaluation.level,
          score: riskEvaluation.score,
          reasons: riskEvaluation.reasons,
        },
      });

      if (!isAutoApproved) {
        await emit({
          intentId: intent.id,
          planId: plan.id,
          type: 'APPROVAL_REQUESTED',
          actor: 'AGENT',
          title: 'Awaiting user authorization',
          description: 'Explicit user authorization required before PayPal order can be created.',
          metadata: { approvalId: approvalRecord?.id },
        });
      } else {
        await emit({
          intentId: intent.id,
          planId: plan.id,
          type: 'APPROVAL_GRANTED',
          actor: 'AGENT',
          title: 'Auto-approved within policy',
          description: 'Plan satisfies all deterministic spending limits and autonomy conditions. Pre-authorized for execution.',
          metadata: { autoApproved: true },
        });
      }

      const ai = {
        reasoning: planExecution.reasoning,
        provider: planLlm?.provider ?? intentLlm?.provider ?? null,
        model: planLlm?.model ?? intentLlm?.model ?? null,
        mode: planLlm?.mode ?? intentLlm?.mode ?? 'fixture',
        fallbackUsed: Boolean(intentLlm?.fallbackUsed || planLlm?.fallbackUsed || fallbackUsed),
        fallbackReason: planLlm?.fallbackReason ?? fallbackReason ?? intentLlm?.fallbackReason ?? null,
        latencyMs: (intentLlm?.latencyMs ?? 0) + (planLlm?.latencyMs ?? 0),
        intentLatencyMs: intentLlm?.latencyMs ?? null,
        planLatencyMs: planLlm?.latencyMs ?? null,
      };

      return {
        intent,
        plan: {
          ...plan,
          ai,
          riskAssessments: [riskRecord],
          approvals: approvalRecord ? [approvalRecord] : [],
        },
        policyEvaluation,
        riskAssessment: riskRecord,
        alternatives: planExecution.alternatives.map((a) => a.product),
        tradeoffs: planExecution.tradeoffs,
        ai,
        message: isAutoApproved
          ? 'Purchase plan created and pre-authorized within your policy limits.'
          : 'Purchase plan generated. Please review and authorize the plan to proceed with payment.',
      };
    });

    if (wasBlocked && lastPolicyEvaluation) {
      const replanResult = await this.replanService.autoReplan(
        userId,
        result.plan.id,
        (lastPolicyEvaluation as NewPolicyResult).violations,
        onActivity,
      );

      if (replanResult.success && replanResult.replannedPlan) {
        return {
          intent: result.intent,
          plan: { ...replanResult.replannedPlan, ai: result.ai },
          policyEvaluation: lastPolicyEvaluation,
          riskAssessment: replanResult.replannedPlan.riskAssessments?.[0] || result.riskAssessment,
          alternatives: result.alternatives,
          tradeoffs: replanResult.tradeoffs || result.tradeoffs,
          ai: result.ai,
          message: 'Initial plan exceeded policy limits. Automatically re-planned with a compliant alternative.',
        };
      }
    }

    return result;
  }

  async findAll(userId: string) {
    return this.prisma.purchaseIntent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        plans: {
          orderBy: { version: 'desc' },
          include: {
            items: true,
            riskAssessments: true,
            approvals: true,
          },
        },
        activities: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const intent = await this.prisma.purchaseIntent.findFirst({
      where: { id, userId },
      include: {
        plans: {
          orderBy: { version: 'desc' },
          include: {
            items: true,
            riskAssessments: true,
            approvals: true,
          },
        },
        activities: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!intent) {
      throw new NotFoundException(`Purchase intent '${id}' not found`);
    }

    return intent;
  }
}
