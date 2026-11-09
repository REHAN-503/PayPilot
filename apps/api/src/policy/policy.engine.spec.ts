import { describe, expect, it } from 'vitest';
import {
  evaluate,
  type PlanForPolicy,
  type PolicyRules,
  type SpendSoFar,
} from './policy.engine.js';

// ── Factory helpers ──────────────────────────────────────────────────────────

function makePlan(overrides: Partial<PlanForPolicy> = {}): PlanForPolicy {
  return {
    total: 50,
    currency: 'USD',
    ...overrides,
  };
}

function makePolicy(overrides: Partial<PolicyRules> = {}): PolicyRules {
  return {
    currency: 'USD',
    autonomyMode: 'AUTO_WITHIN_LIMITS',
    allowAutoExecute: true,
    maxTransactionAmount: 1000,
    dailySpendingLimit: 500,
    monthlySpendingLimit: 5000,
    ...overrides,
  };
}

function makeSpend(overrides: Partial<SpendSoFar> = {}): SpendSoFar {
  return { today: 0, month: 0, ...overrides };
}

const NOW = new Date('2026-06-15T12:00:00Z');

// ── Tests ────────────────────────────────────────────────────────────────────

describe('evaluate – BLOCK violations', () => {
  it.each([
    {
      name: '1. Currency mismatch → BLOCK',
      plan: makePlan({ currency: 'EUR' }),
      policy: makePolicy({ currency: 'USD' }),
      spend: makeSpend(),
      expectViolationSubstring: 'Currency mismatch',
    },
    {
      name: '2a. total > maxTransactionAmount → BLOCK',
      plan: makePlan({ total: 1001 }),
      policy: makePolicy({ maxTransactionAmount: 1000 }),
      spend: makeSpend(),
      expectViolationSubstring: 'exceeds maximum per-transaction limit',
    },
    {
      name: '3a. daily spend + total > dailyLimit → BLOCK',
      plan: makePlan({ total: 100 }),
      policy: makePolicy({ dailySpendingLimit: 500 }),
      spend: makeSpend({ today: 450 }),
      expectViolationSubstring: 'exceeds daily limit',
    },
    {
      name: '4a. monthly spend + total > monthlyLimit → BLOCK',
      plan: makePlan({ total: 200 }),
      policy: makePolicy({ monthlySpendingLimit: 5000 }),
      spend: makeSpend({ month: 4900 }),
      expectViolationSubstring: 'exceeds monthly limit',
    },
    {
      name: '5. Category in blockedCategories → BLOCK',
      plan: makePlan({ category: 'Gambling' }),
      policy: makePolicy({ blockedCategories: ['gambling', 'weapons'] }),
      spend: makeSpend(),
      expectViolationSubstring: "Category 'Gambling' is prohibited",
    },
    {
      name: '6. Category not in allowedCategories → BLOCK',
      plan: makePlan({ category: 'Electronics' }),
      policy: makePolicy({ allowedCategories: ['Office Supplies', 'Software'] }),
      spend: makeSpend(),
      expectViolationSubstring: 'is not in the permitted category list',
    },
    {
      name: '7. Plan expired → BLOCK',
      plan: makePlan({ expiresAt: new Date('2026-06-14T00:00:00Z') }),
      policy: makePolicy(),
      spend: makeSpend(),
      expectViolationSubstring: 'Purchase plan has expired',
    },
    {
      name: '8. Product stock = 0 → BLOCK',
      plan: makePlan({
        items: [{ quantity: 1, product: { stock: 0, status: 'ACTIVE' } }],
      }),
      policy: makePolicy(),
      spend: makeSpend(),
      expectViolationSubstring: 'out of stock',
    },
    {
      name: '9. Product quantity > stock → BLOCK',
      plan: makePlan({
        items: [{ quantity: 10, product: { stock: 5, status: 'ACTIVE' } }],
      }),
      policy: makePolicy(),
      spend: makeSpend(),
      expectViolationSubstring: 'exceeds available stock',
    },
    {
      name: '10. Product status not ACTIVE → BLOCK',
      plan: makePlan({
        items: [{ quantity: 1, product: { stock: 10, status: 'DISCONTINUED' } }],
      }),
      policy: makePolicy(),
      spend: makeSpend(),
      expectViolationSubstring: "Product status is 'DISCONTINUED'",
    },
  ])('$name', ({ plan, policy, spend, expectViolationSubstring }) => {
    const result = evaluate(plan, policy, spend, NOW);
    expect(result.decision).toBe('BLOCK');
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.violations.some((v) => v.includes(expectViolationSubstring))).toBe(true);
  });
});

describe('evaluate – boundary: exactly at limit → NOT BLOCK', () => {
  it.each([
    {
      name: '2b. total == maxTransactionAmount → NOT BLOCK',
      plan: makePlan({ total: 1000 }),
      policy: makePolicy({
        maxTransactionAmount: 1000,
        dailySpendingLimit: null,
        monthlySpendingLimit: null,
      }),
      spend: makeSpend(),
    },
    {
      name: '3b. daily spend + total == dailyLimit → NOT BLOCK',
      plan: makePlan({ total: 100 }),
      policy: makePolicy({ dailySpendingLimit: 500 }),
      spend: makeSpend({ today: 400 }),
    },
    {
      name: '4b. monthly spend + total == monthlyLimit → NOT BLOCK',
      plan: makePlan({ total: 100 }),
      policy: makePolicy({ monthlySpendingLimit: 5000 }),
      spend: makeSpend({ month: 4900 }),
    },
  ])('$name', ({ plan, policy, spend }) => {
    const result = evaluate(plan, policy, spend, NOW);
    expect(result.decision).not.toBe('BLOCK');
    expect(result.violations).toHaveLength(0);
  });
});

describe('evaluate – REQUIRE_APPROVAL autonomy modes', () => {
  it.each([
    {
      name: '11. MANUAL_APPROVAL → REQUIRE_APPROVAL (no violations)',
      policy: makePolicy({ autonomyMode: 'MANUAL_APPROVAL' }),
      expectReasonSubstring: 'MANUAL_APPROVAL',
    },
    {
      name: '12. ASK_EVERY_TIME → REQUIRE_APPROVAL',
      policy: makePolicy({ autonomyMode: 'ASK_EVERY_TIME' }),
      expectReasonSubstring: 'ASK_EVERY_TIME',
    },
    {
      name: '13. AUTO_WITHIN_LIMITS + allowAutoExecute=false → REQUIRE_APPROVAL',
      policy: makePolicy({ autonomyMode: 'AUTO_WITHIN_LIMITS', allowAutoExecute: false }),
      expectReasonSubstring: 'allowAutoExecute',
    },
    {
      name: '14. AUTO_WITHIN_LIMITS + total > requireApprovalAbove → REQUIRE_APPROVAL',
      policy: makePolicy({
        autonomyMode: 'AUTO_WITHIN_LIMITS',
        allowAutoExecute: true,
        requireApprovalAbove: 25,
      }),
      expectReasonSubstring: 'exceeds the $25.00 automatic execution ceiling',
    },
    {
      name: '15. AUTO_WITHIN_LIMITS + category not in autoApproveCategories → REQUIRE_APPROVAL',
      policy: makePolicy({
        autonomyMode: 'AUTO_WITHIN_LIMITS',
        allowAutoExecute: true,
        autoApproveCategories: ['Office Supplies'],
      }),
      expectReasonSubstring: 'is not in auto-approve categories list',
    },
  ])('$name', ({ policy, expectReasonSubstring }) => {
    // For case 15 we need a category on the plan so the autoApproveCategories check fires
    const plan =
      expectReasonSubstring.includes('auto-approve')
        ? makePlan({ category: 'Electronics' })
        : makePlan();
    const result = evaluate(plan, policy, makeSpend(), NOW);
    expect(result.decision).toBe('REQUIRE_APPROVAL');
    expect(result.violations).toHaveLength(0);
    expect(result.reasons.some((r) => r.includes(expectReasonSubstring))).toBe(true);
  });
});

describe('evaluate – ALLOW_AUTO happy path', () => {
  it('16. AUTO_WITHIN_LIMITS + all conditions met → ALLOW_AUTO', () => {
    const plan = makePlan({ total: 50, category: 'Office Supplies' });
    const policy = makePolicy({
      autonomyMode: 'AUTO_WITHIN_LIMITS',
      allowAutoExecute: true,
      requireApprovalAbove: 100,
      autoApproveCategories: ['Office Supplies'],
      allowedCategories: ['Office Supplies', 'Software'],
    });
    const result = evaluate(plan, policy, makeSpend(), NOW);

    expect(result.decision).toBe('ALLOW_AUTO');
    expect(result.violations).toHaveLength(0);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain('qualifies for automated execution');
  });
});

describe('evaluate – edge cases', () => {
  it('17. No category set + allowedCategories non-empty → should NOT block', () => {
    const plan = makePlan({ category: null });
    const policy = makePolicy({
      allowedCategories: ['Office Supplies', 'Software'],
    });
    const result = evaluate(plan, policy, makeSpend(), NOW);

    expect(result.decision).not.toBe('BLOCK');
    expect(
      result.violations.some((v) => v.includes('not in the permitted category list')),
    ).toBe(false);
  });

  it('18. Multiple violations simultaneously → BLOCK with multiple violations', () => {
    const plan = makePlan({
      total: 2000,
      currency: 'GBP',
      category: 'Weapons',
      expiresAt: new Date('2025-01-01T00:00:00Z'),
      items: [{ quantity: 5, product: { stock: 2, status: 'DISCONTINUED' } }],
    });
    const policy = makePolicy({
      currency: 'USD',
      maxTransactionAmount: 1000,
      dailySpendingLimit: 500,
      monthlySpendingLimit: 3000,
      blockedCategories: ['Weapons'],
    });
    const spend = makeSpend({ today: 400, month: 2500 });

    const result = evaluate(plan, policy, spend, NOW);
    expect(result.decision).toBe('BLOCK');

    // Should have at least: currency, maxTransaction, daily, monthly, blockedCategory, expired, stock quantity, product status
    expect(result.violations.length).toBeGreaterThanOrEqual(7);
    expect(result.violations.some((v) => v.includes('Currency mismatch'))).toBe(true);
    expect(result.violations.some((v) => v.includes('exceeds maximum per-transaction limit'))).toBe(true);
    expect(result.violations.some((v) => v.includes('exceeds daily limit'))).toBe(true);
    expect(result.violations.some((v) => v.includes('exceeds monthly limit'))).toBe(true);
    expect(result.violations.some((v) => v.includes('is prohibited'))).toBe(true);
    expect(result.violations.some((v) => v.includes('Purchase plan has expired'))).toBe(true);
    expect(result.violations.some((v) => v.includes("Product status is 'DISCONTINUED'"))).toBe(true);
    expect(result.violations.some((v) => v.includes('exceeds available stock'))).toBe(true);
  });
});
