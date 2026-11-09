import type { PolicyDecision } from './policy.engine.js';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface PlanRiskInput {
  total: number;
  category?: string | null;
  quantity?: number;
  catalogPriceAtCreation?: number | null;
  currentCatalogPrice?: number | null;
  minItemStock?: number | null;
  unknownMerchant?: boolean;
  negotiationInvolved?: boolean;
  version?: number;
}

export interface UserHistoryMetrics {
  typicalSpendAverage?: number; // Average of past captured payments
  pastPaymentsCount?: number;
  dailySpentSoFar: number;
  dailySpendingLimit?: number | null;
  purchasedCategories?: string[]; // Historical categories purchased
  recentPaymentsIn10Min?: number; // Velocity count in past 10 minutes
}

export interface RiskAssessmentResult {
  score: number; // 0 to 100
  level: RiskLevel;
  reasons: string[];
}

/**
 * Pure risk assessment gate.
 * Evaluates behavioral heuristics, price divergence, velocity, and budget consumption.
 */
export function assess(
  plan: PlanRiskInput,
  history: UserHistoryMetrics,
): RiskAssessmentResult {
  let score = 10; // Baseline profile score
  const reasons: string[] = [];

  // 1. Amount vs Typical Historical Spend
  if (
    history.typicalSpendAverage != null &&
    history.typicalSpendAverage > 0 &&
    (history.pastPaymentsCount ?? 0) >= 2
  ) {
    if (plan.total >= history.typicalSpendAverage * 2.5) {
      score += 25;
      reasons.push(
        `Transaction amount ($${plan.total.toFixed(2)}) is over 2.5x typical historical average ($${history.typicalSpendAverage.toFixed(2)}).`,
      );
    } else if (plan.total >= history.typicalSpendAverage * 1.5) {
      score += 15;
      reasons.push(
        `Transaction amount ($${plan.total.toFixed(2)}) is substantially above historical average.`,
      );
    }
  }

  // 2. Budget Consumption Ratio
  if (history.dailySpendingLimit != null && history.dailySpendingLimit > 0) {
    const ratio = (history.dailySpentSoFar + plan.total) / history.dailySpendingLimit;
    if (ratio >= 1.0) {
      score += 35;
      reasons.push('Transaction fully exhausts or breaches the allocated daily budget limit.');
    } else if (ratio >= 0.8) {
      score += 20;
      reasons.push(
        `Transaction consumes ${(ratio * 100).toFixed(0)}% of the daily spending limit.`,
      );
    }
  }

  // 3. Stale-Price / Divergence Check (>5% increase since plan creation)
  if (
    plan.catalogPriceAtCreation != null &&
    plan.currentCatalogPrice != null &&
    plan.catalogPriceAtCreation > 0
  ) {
    const priceDivergence =
      (plan.currentCatalogPrice - plan.catalogPriceAtCreation) / plan.catalogPriceAtCreation;
    if (priceDivergence > 0.05) {
      score += 25;
      reasons.push(
        `Catalog price increased by ${(priceDivergence * 100).toFixed(1)}% since plan creation (stale-price divergence).`,
      );
    }
  }

  // 4. Low-Stock Inventory or Unknown Merchant
  if (plan.minItemStock != null && plan.minItemStock > 0 && plan.minItemStock < 5) {
    score += 15;
    reasons.push(`Low merchant inventory remaining (${plan.minItemStock} items in stock).`);
  }
  if (plan.unknownMerchant) {
    score += 15;
    reasons.push('Transaction involves an unverified or newly introduced merchant.');
  }

  // 5. New Category Exploration
  if (
    plan.category &&
    history.purchasedCategories &&
    history.purchasedCategories.length > 0
  ) {
    const seen = history.purchasedCategories.some(
      (c) => c.toLowerCase() === plan.category!.toLowerCase(),
    );
    if (!seen) {
      score += 15;
      reasons.push(`First-time transaction in category '${plan.category}'.`);
    }
  }

  // 6. Velocity (Payments in last 10 minutes)
  const velocity = history.recentPaymentsIn10Min ?? 0;
  if (velocity >= 3) {
    score += 35;
    reasons.push(`High payment velocity: ${velocity} transactions initiated in the last 10 minutes.`);
  } else if (velocity >= 2) {
    score += 20;
    reasons.push(`Elevated payment velocity: ${velocity} transactions initiated in the last 10 minutes.`);
  }

  // 7. Negotiation / Version Revisions
  if (plan.negotiationInvolved || (plan.version != null && plan.version > 1)) {
    score += 10;
    reasons.push(`Transaction involves negotiated or re-planned order (v${plan.version || 1}).`);
  }

  // 8. Bulk Quantity (> 3 units)
  if (plan.quantity != null && plan.quantity > 3) {
    score += 15;
    reasons.push(`Bulk quantity order (${plan.quantity} units).`);
  }

  // Clamp score to [0, 100]
  score = Math.max(0, Math.min(100, score));

  // Determine Level
  let level: RiskLevel = 'LOW';
  if (score >= 80) {
    level = 'CRITICAL';
  } else if (score >= 50) {
    level = 'HIGH';
  } else if (score >= 25) {
    level = 'MEDIUM';
  }

  return {
    score,
    level,
    reasons,
  };
}

/**
 * Applies risk-gating rules on top of policy decisions:
 * - CRITICAL risk forces BLOCK.
 * - HIGH risk forces REQUIRE_APPROVAL even in auto mode.
 */
export function applyRiskGate(
  policyDecision: PolicyDecision,
  risk: RiskAssessmentResult,
): { decision: PolicyDecision; riskGated: boolean; note?: string } {
  if (policyDecision === 'BLOCK') {
    return { decision: 'BLOCK', riskGated: false };
  }

  if (risk.level === 'CRITICAL') {
    return {
      decision: 'BLOCK',
      riskGated: true,
      note: 'Transaction blocked due to CRITICAL risk score (>= 80).',
    };
  }

  if (risk.level === 'HIGH' && policyDecision === 'ALLOW_AUTO') {
    return {
      decision: 'REQUIRE_APPROVAL',
      riskGated: true,
      note: 'Automatic execution overridden: HIGH risk score requires explicit human approval.',
    };
  }

  return { decision: policyDecision, riskGated: false };
}

