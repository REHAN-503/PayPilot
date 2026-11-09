import { describe, expect, it } from 'vitest';
import { evaluateRisk } from './risk-engine.js';

describe('Transaction Risk Engine Pure Logic', () => {
  it('assigns LOW risk to small, compliant purchases', () => {
    const result = evaluateRisk({
      planAmount: 24.99,
      policyPassed: true,
      violationsCount: 0,
      dailySpentRatio: 0.1,
      itemCount: 1,
    });

    expect(result.level).toBe('LOW');
    expect(result.score).toBeLessThan(30);
  });

  it('assigns HIGH or CRITICAL risk when policy violations occur', () => {
    const result = evaluateRisk({
      planAmount: 600,
      policyPassed: false,
      violationsCount: 2,
      dailySpentRatio: 1.2,
      itemCount: 2,
    });

    expect(result.level).toBe('CRITICAL');
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.recommendations).toContain(
      'Halt autonomous execution. Require explicit secondary user authorization.',
    );
  });

  it('elevates risk when approaching 80% daily budget ratio', () => {
    const result = evaluateRisk({
      planAmount: 180,
      policyPassed: true,
      violationsCount: 0,
      dailySpentRatio: 0.85,
      itemCount: 1,
    });

    expect(result.level).toBe('MEDIUM');
    expect(result.reasons).toContain(
      'Transaction consumes over 80% of current daily spending budget.',
    );
  });
});

