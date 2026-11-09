import { describe, expect, it } from 'vitest';
import { evaluatePolicy, UserPolicySnapshot } from './policy-engine.js';

describe('Deterministic Policy Engine Pure Logic', () => {
  const basePolicy: UserPolicySnapshot = {
    autonomyMode: 'AUTO_WITHIN_LIMITS',
    currency: 'USD',
    maxTransactionAmount: 200,
    dailySpendingLimit: 500,
    monthlySpendingLimit: 2000,
    requireApprovalAbove: 100,
    allowAutoExecute: true,
  };

  it('approves auto-execution when plan is strictly within all limits', () => {
    const result = evaluatePolicy({
      planAmount: 79.99,
      currency: 'USD',
      policy: basePolicy,
      dailySpentSoFar: 50,
      monthlySpentSoFar: 200,
    });

    expect(result.passed).toBe(true);
    expect(result.requiresApproval).toBe(false);
    expect(result.canAutoExecute).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('triggers manual approval when plan exceeds requireApprovalAbove threshold', () => {
    const result = evaluatePolicy({
      planAmount: 149.99, // > 100
      currency: 'USD',
      policy: basePolicy,
      dailySpentSoFar: 0,
      monthlySpentSoFar: 0,
    });

    expect(result.passed).toBe(true);
    expect(result.requiresApproval).toBe(true);
    expect(result.canAutoExecute).toBe(false);
    expect(result.reasons[0]).toContain('exceeds the $100.00 automatic execution threshold');
  });

  it('fails policy when plan exceeds maxTransactionAmount', () => {
    const result = evaluatePolicy({
      planAmount: 250, // > 200
      currency: 'USD',
      policy: basePolicy,
      dailySpentSoFar: 0,
      monthlySpentSoFar: 0,
    });

    expect(result.passed).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.violations[0]).toContain('exceeds maximum per-transaction limit');
  });

  it('fails policy when daily spending limit would be breached', () => {
    const result = evaluatePolicy({
      planAmount: 150,
      currency: 'USD',
      policy: basePolicy,
      dailySpentSoFar: 400, // 400 + 150 = 550 > 500
      monthlySpentSoFar: 400,
    });

    expect(result.passed).toBe(false);
    expect(result.violations[0]).toContain('exceeds daily budget of $500.00');
  });

  it('enforces ASK_EVERY_TIME autonomy mode regardless of amount', () => {
    const result = evaluatePolicy({
      planAmount: 19.99,
      currency: 'USD',
      policy: {
        ...basePolicy,
        autonomyMode: 'ASK_EVERY_TIME',
      },
      dailySpentSoFar: 0,
      monthlySpentSoFar: 0,
    });

    expect(result.passed).toBe(true);
    expect(result.requiresApproval).toBe(true);
    expect(result.canAutoExecute).toBe(false);
  });

  it('rejects foreign currency requests', () => {
    const result = evaluatePolicy({
      planAmount: 50,
      currency: 'EUR',
      policy: basePolicy,
      dailySpentSoFar: 0,
      monthlySpentSoFar: 0,
    });

    expect(result.passed).toBe(false);
    expect(result.violations[0]).toContain('Currency mismatch');
  });
});

