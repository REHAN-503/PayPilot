export class IllegalStateTransitionError extends Error {
  constructor(
    public readonly entity: string,
    public readonly fromState: string,
    public readonly toState: string,
  ) {
    super(
      `Illegal ${entity} state transition: cannot transition from '${fromState}' to '${toState}'.`,
    );
    this.name = 'IllegalStateTransitionError';
  }
}

export type IntentStatus =
  | 'DRAFT'
  | 'PROCESSING'
  | 'PLANNED'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FAILED';

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

export type ApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REVOKED';

export type PaymentStatus =
  | 'CREATED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ORDER_CREATED'
  | 'PAYER_ACTION_REQUIRED'
  | 'CAPTURE_PENDING'
  | 'CAPTURED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'REVERSED';

export const VALID_INTENT_TRANSITIONS: Record<IntentStatus, readonly IntentStatus[]> = {
  DRAFT: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PLANNED', 'FAILED'],
  PLANNED: ['AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED'],
  AWAITING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['EXECUTING', 'CANCELLED'],
  EXECUTING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  FAILED: [],
};

export const VALID_PLAN_TRANSITIONS: Record<PlanStatus, readonly PlanStatus[]> = {
  DRAFT: ['READY', 'CANCELLED'],
  READY: ['AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED'],
  AWAITING_APPROVAL: ['APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
  APPROVED: ['EXECUTING', 'CANCELLED'],
  EXECUTING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  REJECTED: [],
  EXPIRED: [],
  CANCELLED: [],
  FAILED: [],
};

export const VALID_APPROVAL_TRANSITIONS: Record<ApprovalStatus, readonly ApprovalStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED', 'EXPIRED'],
  APPROVED: ['REVOKED'],
  REJECTED: [],
  EXPIRED: [],
  REVOKED: [],
};

export const VALID_PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  CREATED: ['ORDER_CREATED', 'CANCELLED', 'FAILED'],
  PENDING_APPROVAL: ['APPROVED', 'CANCELLED', 'FAILED'],
  ORDER_CREATED: ['PAYER_ACTION_REQUIRED', 'APPROVED', 'CAPTURE_PENDING', 'CAPTURED', 'CANCELLED', 'FAILED'],
  PAYER_ACTION_REQUIRED: ['APPROVED', 'CAPTURE_PENDING', 'CAPTURED', 'CANCELLED', 'FAILED'],
  APPROVED: ['CAPTURE_PENDING', 'CAPTURED', 'CANCELLED', 'FAILED'],
  CAPTURE_PENDING: ['CAPTURED', 'FAILED'],
  CAPTURED: ['REFUNDED', 'PARTIALLY_REFUNDED', 'REVERSED'],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
  PARTIALLY_REFUNDED: ['REFUNDED'],
  REVERSED: [],
};

export function validateStateTransition<TState extends string>(
  entity: string,
  fromState: TState,
  toState: TState,
  validMap: Record<TState, readonly TState[]>,
): TState {
  if (fromState === toState) {
    return toState;
  }

  const allowed = validMap[fromState] ?? [];
  if (!allowed.includes(toState)) {
    throw new IllegalStateTransitionError(entity, fromState, toState);
  }

  return toState;
}

export function transitionIntentStatus(from: IntentStatus, to: IntentStatus): IntentStatus {
  return validateStateTransition('PurchaseIntent', from, to, VALID_INTENT_TRANSITIONS);
}

export function transitionPlanStatus(from: PlanStatus, to: PlanStatus): PlanStatus {
  return validateStateTransition('PurchasePlan', from, to, VALID_PLAN_TRANSITIONS);
}

export function transitionApprovalStatus(from: ApprovalStatus, to: ApprovalStatus): ApprovalStatus {
  return validateStateTransition('Approval', from, to, VALID_APPROVAL_TRANSITIONS);
}

export function transitionPaymentStatus(from: PaymentStatus, to: PaymentStatus): PaymentStatus {
  return validateStateTransition('Payment', from, to, VALID_PAYMENT_TRANSITIONS);
}

