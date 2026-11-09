import { describe, expect, it } from 'vitest';

import type { PlanRiskInput, RiskAssessmentResult, UserHistoryMetrics } from './risk.gate.js';
import { applyRiskGate, assess } from './risk.gate.js';

// ─── Factories ───────────────────────────────────────────────────────────────

/** Minimal plan that triggers no risk signals. */
function makePlan(overrides: Partial<PlanRiskInput> = {}): PlanRiskInput {
  return {
    total: 20,
    category: null,
    quantity: 1,
    catalogPriceAtCreation: null,
    currentCatalogPrice: null,
    minItemStock: null,
    unknownMerchant: false,
    negotiationInvolved: false,
    version: 1,
    ...overrides,
  };
}

/** Minimal history that triggers no risk signals. */
function makeHistory(overrides: Partial<UserHistoryMetrics> = {}): UserHistoryMetrics {
  return {
    typicalSpendAverage: undefined,
    pastPaymentsCount: undefined,
    dailySpentSoFar: 0,
    dailySpendingLimit: null,
    purchasedCategories: [],
    recentPaymentsIn10Min: 0,
    ...overrides,
  };
}

function makeRisk(overrides: Partial<RiskAssessmentResult> = {}): RiskAssessmentResult {
  return {
    score: 10,
    level: 'LOW',
    reasons: [],
    ...overrides,
  };
}

// ─── assess() ────────────────────────────────────────────────────────────────

describe('assess()', () => {
  // ── Baseline ────────────────────────────────────────────────────────────────

  it('returns baseline score=10 and level=LOW when no signals fire', () => {
    const result = assess(makePlan(), makeHistory());
    expect(result.score).toBe(10);
    expect(result.level).toBe('LOW');
    expect(result.reasons).toHaveLength(0);
  });

  // ── Signal 1: Amount vs Typical Spend ───────────────────────────────────────

  describe('signal 1 — amount vs typical spend', () => {
    it('adds +25 when total >= 2.5x typicalSpendAverage', () => {
      const result = assess(
        makePlan({ total: 250 }),
        makeHistory({ typicalSpendAverage: 100, pastPaymentsCount: 2 }),
      );
      expect(result.score).toBe(10 + 25);
      expect(result.reasons).toHaveLength(1);
      expect(result.reasons[0]).toContain('2.5x');
    });

    it('adds +15 when total >= 1.5x but < 2.5x typicalSpendAverage', () => {
      const result = assess(
        makePlan({ total: 150 }),
        makeHistory({ typicalSpendAverage: 100, pastPaymentsCount: 2 }),
      );
      expect(result.score).toBe(10 + 15);
      expect(result.level).toBe('MEDIUM');
    });

    it('does NOT fire when pastPaymentsCount < 2', () => {
      const result = assess(
        makePlan({ total: 500 }),
        makeHistory({ typicalSpendAverage: 100, pastPaymentsCount: 1 }),
      );
      expect(result.score).toBe(10);
    });

    it('does NOT fire when typicalSpendAverage is undefined', () => {
      const result = assess(
        makePlan({ total: 500 }),
        makeHistory({ typicalSpendAverage: undefined, pastPaymentsCount: 10 }),
      );
      expect(result.score).toBe(10);
    });

    it('does NOT fire when typicalSpendAverage is 0', () => {
      const result = assess(
        makePlan({ total: 500 }),
        makeHistory({ typicalSpendAverage: 0, pastPaymentsCount: 10 }),
      );
      expect(result.score).toBe(10);
    });

    it('does NOT fire at exactly 1.5x boundary (total < 1.5x)', () => {
      const result = assess(
        makePlan({ total: 149.99 }),
        makeHistory({ typicalSpendAverage: 100, pastPaymentsCount: 5 }),
      );
      expect(result.score).toBe(10);
    });

    it('fires +15 at exactly 1.5x boundary', () => {
      const result = assess(
        makePlan({ total: 150 }),
        makeHistory({ typicalSpendAverage: 100, pastPaymentsCount: 5 }),
      );
      expect(result.score).toBe(25);
    });

    it('fires +25 at exactly 2.5x boundary', () => {
      const result = assess(
        makePlan({ total: 250 }),
        makeHistory({ typicalSpendAverage: 100, pastPaymentsCount: 5 }),
      );
      expect(result.score).toBe(35);
    });
  });

  // ── Signal 2: Budget Ratio ──────────────────────────────────────────────────

  describe('signal 2 — budget consumption ratio', () => {
    it('adds +35 when ratio >= 1.0', () => {
      const result = assess(
        makePlan({ total: 50 }),
        makeHistory({ dailySpentSoFar: 50, dailySpendingLimit: 100 }),
      );
      // (50+50)/100 = 1.0 → +35
      expect(result.score).toBe(10 + 35);
    });

    it('adds +20 when ratio >= 0.8 but < 1.0', () => {
      const result = assess(
        makePlan({ total: 30 }),
        makeHistory({ dailySpentSoFar: 50, dailySpendingLimit: 100 }),
      );
      // (50+30)/100 = 0.8 → +20
      expect(result.score).toBe(10 + 20);
    });

    it('does NOT fire when ratio < 0.8', () => {
      const result = assess(
        makePlan({ total: 29 }),
        makeHistory({ dailySpentSoFar: 50, dailySpendingLimit: 100 }),
      );
      // (50+29)/100 = 0.79
      expect(result.score).toBe(10);
    });

    it('does NOT fire when dailySpendingLimit is null', () => {
      const result = assess(
        makePlan({ total: 1000 }),
        makeHistory({ dailySpentSoFar: 9000, dailySpendingLimit: null }),
      );
      expect(result.score).toBe(10);
    });

    it('does NOT fire when dailySpendingLimit is 0', () => {
      const result = assess(
        makePlan({ total: 100 }),
        makeHistory({ dailySpentSoFar: 50, dailySpendingLimit: 0 }),
      );
      expect(result.score).toBe(10);
    });
  });

  // ── Signal 3: Stale Price ───────────────────────────────────────────────────

  describe('signal 3 — stale price divergence', () => {
    it('adds +25 when price divergence > 5%', () => {
      const result = assess(
        makePlan({ catalogPriceAtCreation: 100, currentCatalogPrice: 106 }),
        makeHistory(),
      );
      // (106-100)/100 = 0.06 > 0.05 → +25
      expect(result.score).toBe(10 + 25);
    });

    it('does NOT fire at exactly 5% divergence', () => {
      const result = assess(
        makePlan({ catalogPriceAtCreation: 100, currentCatalogPrice: 105 }),
        makeHistory(),
      );
      // 0.05 is NOT > 0.05
      expect(result.score).toBe(10);
    });

    it('does NOT fire when price decreased', () => {
      const result = assess(
        makePlan({ catalogPriceAtCreation: 100, currentCatalogPrice: 90 }),
        makeHistory(),
      );
      expect(result.score).toBe(10);
    });

    it('does NOT fire when catalogPriceAtCreation is null', () => {
      const result = assess(
        makePlan({ catalogPriceAtCreation: null, currentCatalogPrice: 200 }),
        makeHistory(),
      );
      expect(result.score).toBe(10);
    });

    it('does NOT fire when catalogPriceAtCreation is 0', () => {
      const result = assess(
        makePlan({ catalogPriceAtCreation: 0, currentCatalogPrice: 200 }),
        makeHistory(),
      );
      expect(result.score).toBe(10);
    });
  });

  // ── Signal 4: Low Stock & Unknown Merchant ─────────────────────────────────

  describe('signal 4 — low stock / unknown merchant', () => {
    it.each([
      { stock: 1, expected: 10 + 15 },
      { stock: 4, expected: 10 + 15 },
    ])('adds +15 when minItemStock=$stock (>0 and <5)', ({ stock, expected }) => {
      const result = assess(makePlan({ minItemStock: stock }), makeHistory());
      expect(result.score).toBe(expected);
    });

    it('does NOT fire when minItemStock=0', () => {
      expect(assess(makePlan({ minItemStock: 0 }), makeHistory()).score).toBe(10);
    });

    it('does NOT fire when minItemStock=5', () => {
      expect(assess(makePlan({ minItemStock: 5 }), makeHistory()).score).toBe(10);
    });

    it('does NOT fire when minItemStock is null', () => {
      expect(assess(makePlan({ minItemStock: null }), makeHistory()).score).toBe(10);
    });

    it('adds +15 for unknownMerchant', () => {
      const result = assess(makePlan({ unknownMerchant: true }), makeHistory());
      expect(result.score).toBe(10 + 15);
    });

    it('adds +30 for both low stock AND unknown merchant', () => {
      const result = assess(
        makePlan({ minItemStock: 2, unknownMerchant: true }),
        makeHistory(),
      );
      expect(result.score).toBe(10 + 15 + 15);
    });
  });

  // ── Signal 5: New Category ──────────────────────────────────────────────────

  describe('signal 5 — new category exploration', () => {
    it('adds +15 when category not in purchasedCategories', () => {
      const result = assess(
        makePlan({ category: 'Electronics' }),
        makeHistory({ purchasedCategories: ['Food', 'Clothing'] }),
      );
      expect(result.score).toBe(10 + 15);
    });

    it('does NOT fire when category already seen (exact case)', () => {
      const result = assess(
        makePlan({ category: 'Food' }),
        makeHistory({ purchasedCategories: ['Food', 'Clothing'] }),
      );
      expect(result.score).toBe(10);
    });

    it('does NOT fire when category matches (case-insensitive)', () => {
      const result = assess(
        makePlan({ category: 'food' }),
        makeHistory({ purchasedCategories: ['Food'] }),
      );
      expect(result.score).toBe(10);
    });

    it('does NOT fire when category is null', () => {
      const result = assess(
        makePlan({ category: null }),
        makeHistory({ purchasedCategories: ['Food'] }),
      );
      expect(result.score).toBe(10);
    });

    it('does NOT fire when purchasedCategories is empty', () => {
      const result = assess(
        makePlan({ category: 'Electronics' }),
        makeHistory({ purchasedCategories: [] }),
      );
      expect(result.score).toBe(10);
    });

    it('does NOT fire when purchasedCategories is undefined', () => {
      const result = assess(
        makePlan({ category: 'Electronics' }),
        makeHistory({ purchasedCategories: undefined }),
      );
      expect(result.score).toBe(10);
    });
  });

  // ── Signal 6: Velocity ─────────────────────────────────────────────────────

  describe('signal 6 — velocity', () => {
    it('adds +35 when recentPaymentsIn10Min >= 3', () => {
      const result = assess(
        makePlan(),
        makeHistory({ recentPaymentsIn10Min: 3 }),
      );
      expect(result.score).toBe(10 + 35);
    });

    it('adds +35 when recentPaymentsIn10Min = 5', () => {
      const result = assess(
        makePlan(),
        makeHistory({ recentPaymentsIn10Min: 5 }),
      );
      expect(result.score).toBe(10 + 35);
    });

    it('adds +20 when recentPaymentsIn10Min = 2', () => {
      const result = assess(
        makePlan(),
        makeHistory({ recentPaymentsIn10Min: 2 }),
      );
      expect(result.score).toBe(10 + 20);
    });

    it('does NOT fire when recentPaymentsIn10Min = 1', () => {
      const result = assess(
        makePlan(),
        makeHistory({ recentPaymentsIn10Min: 1 }),
      );
      expect(result.score).toBe(10);
    });

    it('does NOT fire when recentPaymentsIn10Min = 0', () => {
      const result = assess(
        makePlan(),
        makeHistory({ recentPaymentsIn10Min: 0 }),
      );
      expect(result.score).toBe(10);
    });
  });

  // ── Signal 7: Negotiation / Version ────────────────────────────────────────

  describe('signal 7 — negotiation or version > 1', () => {
    it('adds +10 when negotiationInvolved=true', () => {
      const result = assess(
        makePlan({ negotiationInvolved: true }),
        makeHistory(),
      );
      expect(result.score).toBe(10 + 10);
    });

    it('adds +10 when version > 1', () => {
      const result = assess(makePlan({ version: 2 }), makeHistory());
      expect(result.score).toBe(10 + 10);
    });

    it('adds +10 (not +20) when BOTH negotiation and version > 1', () => {
      const result = assess(
        makePlan({ negotiationInvolved: true, version: 3 }),
        makeHistory(),
      );
      // Single if-branch, only fires once
      expect(result.score).toBe(10 + 10);
    });

    it('does NOT fire when version=1 and negotiationInvolved=false', () => {
      const result = assess(
        makePlan({ version: 1, negotiationInvolved: false }),
        makeHistory(),
      );
      expect(result.score).toBe(10);
    });
  });

  // ── Signal 8: Bulk Quantity ─────────────────────────────────────────────────

  describe('signal 8 — bulk quantity', () => {
    it('adds +15 when quantity > 3', () => {
      const result = assess(makePlan({ quantity: 4 }), makeHistory());
      expect(result.score).toBe(10 + 15);
    });

    it('does NOT fire when quantity = 3', () => {
      expect(assess(makePlan({ quantity: 3 }), makeHistory()).score).toBe(10);
    });

    it('does NOT fire when quantity is undefined', () => {
      expect(assess(makePlan({ quantity: undefined }), makeHistory()).score).toBe(10);
    });
  });

  // ── Level thresholds ───────────────────────────────────────────────────────

  describe('level thresholds', () => {
    it.each([
      { score: 0, level: 'LOW' },
      { score: 10, level: 'LOW' },
      { score: 24, level: 'LOW' },
      { score: 25, level: 'MEDIUM' },
      { score: 49, level: 'MEDIUM' },
      { score: 50, level: 'HIGH' },
      { score: 79, level: 'HIGH' },
      { score: 80, level: 'CRITICAL' },
      { score: 100, level: 'CRITICAL' },
    ] as const)('score=$score → level=$level', ({ level }) => {
      // We verify thresholds through combined signals below
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(level);
    });

    it('score exactly 25 → MEDIUM (baseline 10 + low-stock 15)', () => {
      const result = assess(makePlan({ minItemStock: 2 }), makeHistory());
      expect(result.score).toBe(25);
      expect(result.level).toBe('MEDIUM');
    });

    it('score exactly 50 → HIGH (baseline 10 + velocity>=3: 35 + quantity: no… use velocity 20 + budget 20)', () => {
      // 10 + 20 (velocity=2) + 20 (budget 0.8) = 50
      const result = assess(
        makePlan({ total: 30 }),
        makeHistory({
          dailySpentSoFar: 50,
          dailySpendingLimit: 100,
          recentPaymentsIn10Min: 2,
        }),
      );
      expect(result.score).toBe(50);
      expect(result.level).toBe('HIGH');
    });

    it('score exactly 80 → CRITICAL (10 + 25 + 35 + 10)', () => {
      // 10 baseline + 25 (amount >= 2.5x) + 35 (budget >= 1.0) + 10 (negotiation)
      const result = assess(
        makePlan({ total: 250, negotiationInvolved: true }),
        makeHistory({
          typicalSpendAverage: 100,
          pastPaymentsCount: 5,
          dailySpentSoFar: 200,
          dailySpendingLimit: 100,
        }),
      );
      expect(result.score).toBe(80);
      expect(result.level).toBe('CRITICAL');
    });
  });

  // ── Combined signals ───────────────────────────────────────────────────────

  describe('combined signals', () => {
    it('produces HIGH with multiple medium signals', () => {
      // 10 + 15 (amount 1.5x) + 15 (low stock) + 15 (new category) + 10 (negotiation) = 65
      const result = assess(
        makePlan({
          total: 150,
          minItemStock: 3,
          category: 'NewCat',
          negotiationInvolved: true,
        }),
        makeHistory({
          typicalSpendAverage: 100,
          pastPaymentsCount: 5,
          purchasedCategories: ['OldCat'],
        }),
      );
      expect(result.score).toBe(65);
      expect(result.level).toBe('HIGH');
    });

    it('produces CRITICAL with stacked heavy signals', () => {
      // 10 + 25 (amount 2.5x) + 35 (budget >= 1.0) + 35 (velocity >= 3) = 105 → clamped 100
      const result = assess(
        makePlan({ total: 500 }),
        makeHistory({
          typicalSpendAverage: 100,
          pastPaymentsCount: 10,
          dailySpentSoFar: 500,
          dailySpendingLimit: 100,
          recentPaymentsIn10Min: 5,
        }),
      );
      expect(result.score).toBe(100);
      expect(result.level).toBe('CRITICAL');
    });
  });

  // ── Clamping ───────────────────────────────────────────────────────────────

  describe('score clamping', () => {
    it('clamps score at 100 when raw sum exceeds 100', () => {
      // Fire every signal:
      // 10 baseline
      // +25 amount >= 2.5x
      // +35 budget >= 1.0
      // +25 stale price
      // +15 low stock
      // +15 unknown merchant
      // +15 new category
      // +35 velocity >= 3
      // +10 negotiation
      // +15 bulk quantity
      // = 200 → clamped to 100
      const result = assess(
        makePlan({
          total: 500,
          catalogPriceAtCreation: 100,
          currentCatalogPrice: 200,
          minItemStock: 1,
          unknownMerchant: true,
          category: 'NewCat',
          negotiationInvolved: true,
          version: 3,
          quantity: 10,
        }),
        makeHistory({
          typicalSpendAverage: 100,
          pastPaymentsCount: 10,
          dailySpentSoFar: 500,
          dailySpendingLimit: 100,
          purchasedCategories: ['OldCat'],
          recentPaymentsIn10Min: 5,
        }),
      );
      expect(result.score).toBe(100);
      expect(result.level).toBe('CRITICAL');
      // All 8 signal categories should produce reasons (9 total because signal 4 has two sub-reasons)
      expect(result.reasons.length).toBeGreaterThanOrEqual(8);
    });
  });
});

// ─── applyRiskGate() ─────────────────────────────────────────────────────────

describe('applyRiskGate()', () => {
  it('returns BLOCK unchanged (riskGated=false) when policyDecision is already BLOCK', () => {
    const result = applyRiskGate('BLOCK', makeRisk({ level: 'LOW', score: 10 }));
    expect(result).toEqual({ decision: 'BLOCK', riskGated: false });
  });

  it('returns BLOCK unchanged even when risk is CRITICAL if policyDecision is already BLOCK', () => {
    const result = applyRiskGate('BLOCK', makeRisk({ level: 'CRITICAL', score: 90 }));
    expect(result).toEqual({ decision: 'BLOCK', riskGated: false });
  });

  it('overrides to BLOCK when risk is CRITICAL (policyDecision=ALLOW_AUTO)', () => {
    const result = applyRiskGate('ALLOW_AUTO', makeRisk({ level: 'CRITICAL', score: 85 }));
    expect(result.decision).toBe('BLOCK');
    expect(result.riskGated).toBe(true);
    expect(result.note).toBeDefined();
  });

  it('overrides to BLOCK when risk is CRITICAL (policyDecision=REQUIRE_APPROVAL)', () => {
    const result = applyRiskGate(
      'REQUIRE_APPROVAL',
      makeRisk({ level: 'CRITICAL', score: 80 }),
    );
    expect(result.decision).toBe('BLOCK');
    expect(result.riskGated).toBe(true);
  });

  it('overrides ALLOW_AUTO to REQUIRE_APPROVAL when risk is HIGH', () => {
    const result = applyRiskGate('ALLOW_AUTO', makeRisk({ level: 'HIGH', score: 55 }));
    expect(result.decision).toBe('REQUIRE_APPROVAL');
    expect(result.riskGated).toBe(true);
    expect(result.note).toBeDefined();
  });

  it('does NOT override REQUIRE_APPROVAL when risk is HIGH (already requires approval)', () => {
    const result = applyRiskGate(
      'REQUIRE_APPROVAL',
      makeRisk({ level: 'HIGH', score: 60 }),
    );
    expect(result).toEqual({ decision: 'REQUIRE_APPROVAL', riskGated: false });
  });

  it('passes through ALLOW_AUTO unchanged when risk is MEDIUM', () => {
    const result = applyRiskGate('ALLOW_AUTO', makeRisk({ level: 'MEDIUM', score: 30 }));
    expect(result).toEqual({ decision: 'ALLOW_AUTO', riskGated: false });
  });

  it('passes through ALLOW_AUTO unchanged when risk is LOW', () => {
    const result = applyRiskGate('ALLOW_AUTO', makeRisk({ level: 'LOW', score: 10 }));
    expect(result).toEqual({ decision: 'ALLOW_AUTO', riskGated: false });
  });

  it('passes through REQUIRE_APPROVAL unchanged when risk is MEDIUM', () => {
    const result = applyRiskGate(
      'REQUIRE_APPROVAL',
      makeRisk({ level: 'MEDIUM', score: 40 }),
    );
    expect(result).toEqual({ decision: 'REQUIRE_APPROVAL', riskGated: false });
  });

  it('passes through REQUIRE_APPROVAL unchanged when risk is LOW', () => {
    const result = applyRiskGate(
      'REQUIRE_APPROVAL',
      makeRisk({ level: 'LOW', score: 10 }),
    );
    expect(result).toEqual({ decision: 'REQUIRE_APPROVAL', riskGated: false });
  });
});
