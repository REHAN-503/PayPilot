import { describe, expect, it } from 'vitest';
import { ForbiddenActionError } from '../agent/llm/llm-errors.js';
import {
  assertPlanTransition,
  isLegalPlanTransition,
  PLAN_TRANSITIONS,
  type PlanStatus,
} from './plan.sm.js';

// Flatten the transition table into [from, to] pairs for table-driven tests.
const allLegalPairs: [PlanStatus, PlanStatus][] = [];
for (const [from, targets] of Object.entries(PLAN_TRANSITIONS)) {
  for (const to of targets) {
    allLegalPairs.push([from as PlanStatus, to as PlanStatus]);
  }
}

const allStatuses: PlanStatus[] = Object.keys(PLAN_TRANSITIONS) as PlanStatus[];

const terminalStates: PlanStatus[] = ['COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'FAILED'];

describe('isLegalPlanTransition', () => {
  it.each(allLegalPairs)(
    '%s → %s is legal',
    (from, to) => {
      expect(isLegalPlanTransition(from, to)).toBe(true);
    },
  );

  it.each(allStatuses)(
    'same-state transition %s → %s returns true',
    (status) => {
      expect(isLegalPlanTransition(status, status)).toBe(true);
    },
  );

  describe('terminal states block all outgoing transitions', () => {
    for (const terminal of terminalStates) {
      const nonSelfTargets = allStatuses.filter((s) => s !== terminal);
      it.each(nonSelfTargets)(
        `${terminal} → %s is illegal`,
        (to) => {
          expect(isLegalPlanTransition(terminal, to)).toBe(false);
        },
      );
    }
  });

  it.each([
    ['APPROVED', 'DRAFT'],
    ['EXECUTING', 'READY'],
    ['COMPLETED', 'APPROVED'],
  ] as [PlanStatus, PlanStatus][])(
    'specific illegal: %s → %s returns false',
    (from, to) => {
      expect(isLegalPlanTransition(from, to)).toBe(false);
    },
  );
});

describe('assertPlanTransition', () => {
  it.each(allLegalPairs)(
    '%s → %s returns the target status',
    (from, to) => {
      expect(assertPlanTransition(from, to)).toBe(to);
    },
  );

  it.each(allStatuses)(
    'same-state assertion %s → %s returns the status',
    (status) => {
      expect(assertPlanTransition(status, status)).toBe(status);
    },
  );

  it.each([
    ['APPROVED', 'DRAFT'],
    ['EXECUTING', 'READY'],
    ['COMPLETED', 'APPROVED'],
  ] as [PlanStatus, PlanStatus][])(
    'illegal %s → %s throws ForbiddenActionError',
    (from, to) => {
      expect(() => assertPlanTransition(from, to)).toThrow(ForbiddenActionError);
    },
  );

  it('thrown error contains descriptive message', () => {
    expect(() => assertPlanTransition('COMPLETED', 'DRAFT')).toThrow(
      /Illegal plan state transition from 'COMPLETED' to 'DRAFT'/,
    );
  });
});
