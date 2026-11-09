export type AutonomyMode =
  | 'ASK_EVERY_TIME'
  | 'AUTO_WITHIN_LIMITS'
  | 'MANUAL_APPROVAL';

export interface UserPolicySnapshot {
  autonomyMode: AutonomyMode;
  currency: string;
  maxTransactionAmount?: number | string | { toString(): string } | null;
  dailySpendingLimit?: number | string | { toString(): string } | null;
  monthlySpendingLimit?: number | string | { toString(): string } | null;
  requireApprovalAbove?: number | string | { toString(): string } | null;
  allowAutoExecute: boolean;
}

export interface PolicyEvaluationInput {
  planAmount: number;
  currency: string;
  policy: UserPolicySnapshot;
  dailySpentSoFar: number;
  monthlySpentSoFar: number;
}

export interface PolicyEvaluationResult {
  passed: boolean;
  requiresApproval: boolean;
  canAutoExecute: boolean;
  violations: string[];
  reasons: string[];
  metrics: {
    planAmount: number;
    currency: string;
    dailySpent: number;
    dailyLimit: number | null;
    dailyRemaining: number | null;
    monthlySpent: number;
    monthlyLimit: number | null;
    monthlyRemaining: number | null;
    maxTransactionAmount: number | null;
    requireApprovalAbove: number | null;
  };
}

function parseLimit(value: number | string | { toString(): string } | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function evaluatePolicy(input: PolicyEvaluationInput): PolicyEvaluationResult {
  const { planAmount, currency, policy, dailySpentSoFar, monthlySpentSoFar } = input;
  const violations: string[] = [];
  const reasons: string[] = [];

  // 1. Currency enforcement: PayPal sandbox requires consistent USD
  const targetCurrency = policy.currency || 'USD';
  if (currency.toUpperCase() !== targetCurrency.toUpperCase()) {
    violations.push(
      `Currency mismatch: plan currency (${currency}) does not match policy currency (${targetCurrency}).`,
    );
  }

  const maxTx = parseLimit(policy.maxTransactionAmount);
  const dailyLimit = parseLimit(policy.dailySpendingLimit);
  const monthlyLimit = parseLimit(policy.monthlySpendingLimit);
  const requireApprovalAbove = parseLimit(policy.requireApprovalAbove);

  // 2. Per-Transaction limit check
  if (maxTx !== null && planAmount > maxTx) {
    violations.push(
      `Plan total of $${planAmount.toFixed(2)} exceeds maximum per-transaction limit of $${maxTx.toFixed(2)}.`,
    );
  }

  // 3. Daily spending ceiling check
  const projectedDaily = dailySpentSoFar + planAmount;
  if (dailyLimit !== null && projectedDaily > dailyLimit) {
    violations.push(
      `Projected daily spend of $${projectedDaily.toFixed(2)} ($${dailySpentSoFar.toFixed(2)} prior + $${planAmount.toFixed(2)} new) exceeds daily budget of $${dailyLimit.toFixed(2)}.`,
    );
  }

  // 4. Monthly spending ceiling check
  const projectedMonthly = monthlySpentSoFar + planAmount;
  if (monthlyLimit !== null && projectedMonthly > monthlyLimit) {
    violations.push(
      `Projected monthly spend of $${projectedMonthly.toFixed(2)} ($${monthlySpentSoFar.toFixed(2)} prior + $${planAmount.toFixed(2)} new) exceeds monthly budget of $${monthlyLimit.toFixed(2)}.`,
    );
  }

  const passed = violations.length === 0;

  let requiresApproval = true;
  let canAutoExecute = false;

  if (!passed) {
    requiresApproval = true;
    canAutoExecute = false;
    reasons.push(...violations);
  } else {
    // Determine autonomy branching
    switch (policy.autonomyMode) {
      case 'ASK_EVERY_TIME':
      case 'MANUAL_APPROVAL':
        requiresApproval = true;
        canAutoExecute = false;
        reasons.push(`Autonomy mode '${policy.autonomyMode}' requires explicit user authorization.`);
        break;

      case 'AUTO_WITHIN_LIMITS':
        if (requireApprovalAbove !== null && planAmount > requireApprovalAbove) {
          requiresApproval = true;
          canAutoExecute = false;
          reasons.push(
            `Plan total of $${planAmount.toFixed(2)} exceeds the $${requireApprovalAbove.toFixed(2)} automatic execution threshold.`,
          );
        } else if (policy.allowAutoExecute) {
          requiresApproval = false;
          canAutoExecute = true;
          reasons.push('Plan satisfies all deterministic limits and qualifies for automated execution.');
        } else {
          requiresApproval = true;
          canAutoExecute = false;
          reasons.push('Automatic execution flag is currently disabled in policy.');
        }
        break;

      default:
        requiresApproval = true;
        canAutoExecute = false;
        reasons.push('Defaulting to safe user authorization mode.');
    }
  }

  return {
    passed,
    requiresApproval,
    canAutoExecute,
    violations,
    reasons,
    metrics: {
      planAmount,
      currency: targetCurrency,
      dailySpent: dailySpentSoFar,
      dailyLimit,
      dailyRemaining: dailyLimit !== null ? Math.max(0, dailyLimit - dailySpentSoFar) : null,
      monthlySpent: monthlySpentSoFar,
      monthlyLimit,
      monthlyRemaining: monthlyLimit !== null ? Math.max(0, monthlyLimit - monthlySpentSoFar) : null,
      maxTransactionAmount: maxTx,
      requireApprovalAbove,
    },
  };
}
