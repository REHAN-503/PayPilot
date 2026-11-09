export type PolicyDecision = 'ALLOW_AUTO' | 'REQUIRE_APPROVAL' | 'BLOCK';

export interface PlanItemStockInfo {
  quantity: number;
  product?: {
    stock?: number | null;
    status?: string | null;
    price?: number | string | null;
  } | null;
}

export interface PlanForPolicy {
  total: number;
  currency: string;
  category?: string | null;
  expiresAt?: Date | string | null;
  items?: PlanItemStockInfo[];
}

export interface PolicyRules {
  currency: string;
  autonomyMode: 'MANUAL_APPROVAL' | 'ASK_EVERY_TIME' | 'AUTO_WITHIN_LIMITS';
  maxTransactionAmount?: number | null;
  dailySpendingLimit?: number | null;
  monthlySpendingLimit?: number | null;
  requireApprovalAbove?: number | null;
  allowAutoExecute?: boolean;
  allowedCategories?: string[];
  blockedCategories?: string[];
  autoApproveCategories?: string[];
}

export interface SpendSoFar {
  today: number;
  month: number;
}

export interface PolicyEvaluationResult {
  decision: PolicyDecision;
  violations: string[];
  reasons: string[];
}

/**
 * Pure policy evaluation engine.
 * Computes deterministic spending, category, stock, expiry, and autonomy rules.
 */
export function evaluate(
  plan: PlanForPolicy,
  policy: PolicyRules,
  spendSoFar: SpendSoFar,
  now: Date = new Date(),
): PolicyEvaluationResult {
  const violations: string[] = [];
  const reasons: string[] = [];

  // 1. Currency Rule
  if (plan.currency.toUpperCase() !== policy.currency.toUpperCase()) {
    violations.push(
      `Currency mismatch: plan uses '${plan.currency}', but account policy requires '${policy.currency}'.`,
    );
  }

  // 2. Transaction Amount Ceiling (Total <= maxTransactionAmount)
  if (policy.maxTransactionAmount != null && plan.total > policy.maxTransactionAmount) {
    violations.push(
      `Plan total of $${plan.total.toFixed(2)} exceeds maximum per-transaction limit of $${policy.maxTransactionAmount.toFixed(2)}.`,
    );
  }

  // 3. Daily Spending Limit (spendSoFar.today + plan.total <= dailySpendingLimit)
  if (policy.dailySpendingLimit != null) {
    const projectedDaily = spendSoFar.today + plan.total;
    if (projectedDaily > policy.dailySpendingLimit) {
      violations.push(
        `Projected daily spend of $${projectedDaily.toFixed(2)} ($${spendSoFar.today.toFixed(2)} settled today + $${plan.total.toFixed(2)} new) exceeds daily limit of $${policy.dailySpendingLimit.toFixed(2)}.`,
      );
    }
  }

  // 4. Monthly Spending Limit (spendSoFar.month + plan.total <= monthlySpendingLimit)
  if (policy.monthlySpendingLimit != null) {
    const projectedMonthly = spendSoFar.month + plan.total;
    if (projectedMonthly > policy.monthlySpendingLimit) {
      violations.push(
        `Projected monthly spend of $${projectedMonthly.toFixed(2)} ($${spendSoFar.month.toFixed(2)} settled this month + $${plan.total.toFixed(2)} new) exceeds monthly limit of $${policy.monthlySpendingLimit.toFixed(2)}.`,
      );
    }
  }

  // 5. Category Restrictions (allowedCategories / blockedCategories)
  if (plan.category) {
    const normCategory = plan.category.toLowerCase();

    // Blocked categories check
    if (policy.blockedCategories && policy.blockedCategories.length > 0) {
      const isBlocked = policy.blockedCategories.some((c) => c.toLowerCase() === normCategory);
      if (isBlocked) {
        violations.push(`Category '${plan.category}' is prohibited by spending policy.`);
      }
    }

    // Allowed categories whitelist check
    if (policy.allowedCategories && policy.allowedCategories.length > 0) {
      const isAllowed = policy.allowedCategories.some((c) => c.toLowerCase() === normCategory);
      if (!isAllowed) {
        violations.push(
          `Category '${plan.category}' is not in the permitted category list [${policy.allowedCategories.join(', ')}].`,
        );
      }
    }
  }

  // 6. Plan Expiration Check
  if (plan.expiresAt) {
    const expDate = new Date(plan.expiresAt);
    if (now > expDate) {
      violations.push(`Purchase plan has expired (expired at ${expDate.toISOString()}).`);
    }
  }

  // 7. Product Stock & Status Check
  if (plan.items && plan.items.length > 0) {
    for (const item of plan.items) {
      if (item.product) {
        if (item.product.status && item.product.status !== 'ACTIVE') {
          violations.push(
            `Product status is '${item.product.status}'. Only ACTIVE catalog items may be purchased.`,
          );
        }
        if (item.product.stock != null) {
          if (item.product.stock <= 0) {
            violations.push('Product is currently out of stock.');
          } else if (item.quantity > item.product.stock) {
            violations.push(
              `Requested quantity (${item.quantity}) exceeds available stock (${item.product.stock}).`,
            );
          }
        }
      }
    }
  }

  // If any hard limit was breached, the decision is strictly BLOCK
  if (violations.length > 0) {
    return {
      decision: 'BLOCK',
      violations,
      reasons: violations,
    };
  }

  // 8. Autonomy Mode Semantics
  switch (policy.autonomyMode) {
    case 'MANUAL_APPROVAL':
      reasons.push("Autonomy mode 'MANUAL_APPROVAL' mandates manual review for all transactions.");
      return { decision: 'REQUIRE_APPROVAL', violations: [], reasons };

    case 'ASK_EVERY_TIME':
      reasons.push("Autonomy mode 'ASK_EVERY_TIME' requires explicit authorization for each purchase.");
      return { decision: 'REQUIRE_APPROVAL', violations: [], reasons };

    case 'AUTO_WITHIN_LIMITS': {
      // Must satisfy allowAutoExecute
      if (!policy.allowAutoExecute) {
        reasons.push("Autonomy policy has 'allowAutoExecute' disabled, requiring manual authorization.");
        return { decision: 'REQUIRE_APPROVAL', violations: [], reasons };
      }

      // Must be under or equal to requireApprovalAbove ceiling
      if (policy.requireApprovalAbove != null && plan.total > policy.requireApprovalAbove) {
        reasons.push(
          `Plan total of $${plan.total.toFixed(2)} exceeds the $${policy.requireApprovalAbove.toFixed(2)} automatic execution ceiling.`,
        );
        return { decision: 'REQUIRE_APPROVAL', violations: [], reasons };
      }

      // If autoApproveCategories is specified, category must be included
      if (
        policy.autoApproveCategories &&
        policy.autoApproveCategories.length > 0 &&
        plan.category
      ) {
        const isAutoCategory = policy.autoApproveCategories.some(
          (c) => c.toLowerCase() === plan.category!.toLowerCase(),
        );
        if (!isAutoCategory) {
          reasons.push(
            `Category '${plan.category}' is not in auto-approve categories list [${policy.autoApproveCategories.join(', ')}].`,
          );
          return { decision: 'REQUIRE_APPROVAL', violations: [], reasons };
        }
      }

      reasons.push('Plan satisfies all deterministic limits and qualifies for automated execution.');
      return { decision: 'ALLOW_AUTO', violations: [], reasons };
    }

    default:
      reasons.push('Unrecognized autonomy mode; defaulting to manual approval.');
      return { decision: 'REQUIRE_APPROVAL', violations: [], reasons };
  }
}

