import { ForbiddenActionError } from '../agent/llm/llm-errors.js';

export type IntentStatus =
  | 'DRAFT'
  | 'PROCESSING'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export const INTENT_TRANSITIONS: Record<IntentStatus, readonly IntentStatus[]> = {
  DRAFT: ['PROCESSING', 'FAILED', 'CANCELLED'],
  PROCESSING: ['AWAITING_APPROVAL', 'APPROVED', 'FAILED', 'CANCELLED'],
  AWAITING_APPROVAL: ['APPROVED', 'CANCELLED', 'FAILED'],
  APPROVED: ['EXECUTING', 'CANCELLED'],
  EXECUTING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function isLegalIntentTransition(from: IntentStatus, to: IntentStatus): boolean {
  if (from === to) return true;
  const allowed = INTENT_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function assertIntentTransition(from: IntentStatus, to: IntentStatus): IntentStatus {
  if (!isLegalIntentTransition(from, to)) {
    throw new ForbiddenActionError(
      `Illegal intent state transition from '${from}' to '${to}'. State machine prohibits this transition.`,
    );
  }
  return to;
}

