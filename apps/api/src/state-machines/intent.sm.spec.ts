import { describe, expect, it } from 'vitest';
import { ForbiddenActionError } from '../agent/llm/llm-errors.js';
import {
  assertIntentTransition,
  INTENT_TRANSITIONS,
  isLegalIntentTransition,
  type IntentStatus,
} from './intent.sm.js';

// Flatten the transition table into [from, to] pairs for table-driven tests.
const allLegalPairs: [IntentStatus, IntentStatus][] = [];
for (const [from, targets] of Object.entries(INTENT_TRANSITIONS)) {
  for (const to of targets) {
    allLegalPairs.push([from as IntentStatus, to as IntentStatus]);
  }
}

const allStatuses: IntentStatus[] = Object.keys(INTENT_TRANSITIONS) as IntentStatus[];

const terminalStates: IntentStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED'];

describe('isLegalIntentTransition', () => {
  it.each(allLegalPairs)(
    '%s → %s is legal',
    (from, to) => {
      expect(isLegalIntentTransition(from, to)).toBe(true);
    },
  );

  it.each(allStatuses)(
    'same-state transition %s → %s returns true',
    (status) => {
      expect(isLegalIntentTransition(status, status)).toBe(true);
    },
  );

  describe('terminal states block all outgoing transitions', () => {
    for (const terminal of terminalStates) {
      const nonSelfTargets = allStatuses.filter((s) => s !== terminal);
      it.each(nonSelfTargets)(
        `${terminal} → %s is illegal`,
        (to) => {
          expect(isLegalIntentTransition(terminal, to)).toBe(false);
        },
      );
    }
  });

  it.each([
    ['APPROVED', 'DRAFT'],
    ['EXECUTING', 'PROCESSING'],
    ['COMPLETED', 'APPROVED'],
    ['FAILED', 'EXECUTING'],
    ['CANCELLED', 'DRAFT'],
  ] as [IntentStatus, IntentStatus][])(
    'specific illegal: %s → %s returns false',
    (from, to) => {
      expect(isLegalIntentTransition(from, to)).toBe(false);
    },
  );
});

describe('assertIntentTransition', () => {
  it.each(allLegalPairs)(
    '%s → %s returns the target status',
    (from, to) => {
      expect(assertIntentTransition(from, to)).toBe(to);
    },
  );

  it.each(allStatuses)(
    'same-state assertion %s → %s returns the status',
    (status) => {
      expect(assertIntentTransition(status, status)).toBe(status);
    },
  );

  it.each([
    ['APPROVED', 'DRAFT'],
    ['EXECUTING', 'PROCESSING'],
    ['COMPLETED', 'APPROVED'],
    ['FAILED', 'EXECUTING'],
    ['CANCELLED', 'DRAFT'],
  ] as [IntentStatus, IntentStatus][])(
    'illegal %s → %s throws ForbiddenActionError',
    (from, to) => {
      expect(() => assertIntentTransition(from, to)).toThrow(ForbiddenActionError);
    },
  );

  it('thrown error contains descriptive message', () => {
    expect(() => assertIntentTransition('COMPLETED', 'DRAFT')).toThrow(
      /Illegal intent state transition from 'COMPLETED' to 'DRAFT'/,
    );
  });
});
