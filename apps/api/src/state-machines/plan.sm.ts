import { ForbiddenActionError } from '../agent/llm/llm-errors.js';

export type PlanStatus =
  | 'DRAFT'
  | 'READY'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'FAILED';

export const PLAN_TRANSITIONS: Record<PlanStatus, readonly PlanStatus[]> = {
  DRAFT: ['READY', 'AWAITING_APPROVAL', 'APPROVED', 'CANCELLED', 'FAILED'],
  READY: ['AWAITING_APPROVAL', 'APPROVED', 'CANCELLED', 'FAILED'],
  AWAITING_APPROVAL: ['APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
  APPROVED: ['EXECUTING', 'CANCELLED', 'EXPIRED'],
  EXECUTING: ['COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: [],
  REJECTED: [],
  EXPIRED: [],
  CANCELLED: [],
  FAILED: [],
};

export function isLegalPlanTransition(from: PlanStatus, to: PlanStatus): boolean {
  if (from === to) return true;
  const allowed = PLAN_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function assertPlanTransition(from: PlanStatus, to: PlanStatus): PlanStatus {
  if (!isLegalPlanTransition(from, to)) {
    throw new ForbiddenActionError(
      `Illegal plan state transition from '${from}' to '${to}'. State machine prohibits this transition.`,
    );
  }
  return to;
}

