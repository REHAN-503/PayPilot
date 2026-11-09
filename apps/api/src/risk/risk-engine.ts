export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskEvaluationInput {
  planAmount: number;
  policyPassed: boolean;
  violationsCount: number;
  dailySpentRatio: number; // e.g. (dailySpentSoFar + planAmount) / dailySpendingLimit
  itemCount: number;
  isFirstPurchase?: boolean;
}

export interface RiskEvaluationResult {
  score: number; // 0 to 100
  level: RiskLevel;
  reasons: string[];
  recommendations: string[];
}

export function evaluateRisk(input: RiskEvaluationInput): RiskEvaluationResult {
  const { planAmount, policyPassed, violationsCount, dailySpentRatio, itemCount, isFirstPurchase } = input;
  let score = 10; // Baseline score
  const reasons: string[] = [];
  const recommendations: string[] = [];

  // Policy violations immediately spike risk
  if (!policyPassed || violationsCount > 0) {
    score += 45;
    reasons.push(`Plan triggered ${violationsCount} deterministic spending policy violation(s).`);
    recommendations.push('Review budget limits or request policy administrator override.');
  }

  // High absolute amount heuristics
  if (planAmount >= 500) {
    score += 35;
    reasons.push(`High transaction amount ($${planAmount.toFixed(2)}).`);
    recommendations.push('Confirm merchant credibility and delivery terms.');
  } else if (planAmount >= 250) {
    score += 20;
    reasons.push(`Substantial transaction amount ($${planAmount.toFixed(2)}).`);
  } else if (planAmount >= 150) {
    score += 10;
  } else if (planAmount < 50) {
    score -= 5;
  }

  // Budget consumption ratio
  if (dailySpentRatio >= 1.0) {
    score += 30;
    reasons.push('Transaction fully exhausts or breaches the allocated daily budget.');
  } else if (dailySpentRatio >= 0.8) {
    score += 20;
    reasons.push('Transaction consumes over 80% of current daily spending budget.');
    recommendations.push('Pace additional purchases for subsequent budget cycles.');
  }

  // Large basket size
  if (itemCount > 5) {
    score += 10;
    reasons.push(`Large multi-item cart (${itemCount} items).`);
  }

  // First purchase penalty
  if (isFirstPurchase) {
    score += 10;
    reasons.push('Initial account transaction; baseline profile being established.');
  }

  // Clamp score strictly between 0 and 100
  const clampedScore = Math.max(0, Math.min(100, score));

  let level: RiskLevel = 'LOW';
  if (clampedScore >= 80) {
    level = 'CRITICAL';
    recommendations.unshift('Halt autonomous execution. Require explicit secondary user authorization.');
  } else if (clampedScore >= 55) {
    level = 'HIGH';
    recommendations.unshift('Flag for user review before payment execution.');
  } else if (clampedScore >= 30) {
    level = 'MEDIUM';
  } else {
    level = 'LOW';
  }

  return {
    score: clampedScore,
    level,
    reasons,
    recommendations,
  };
}
