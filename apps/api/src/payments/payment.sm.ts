import { ForbiddenActionError } from '../agent/llm/llm-errors.js';

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

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  CREATED: ['ORDER_CREATED', 'PAYER_ACTION_REQUIRED', 'CANCELLED', 'FAILED'],
  ORDER_CREATED: ['PAYER_ACTION_REQUIRED', 'APPROVED', 'CAPTURE_PENDING', 'CANCELLED', 'FAILED'],
  PAYER_ACTION_REQUIRED: ['APPROVED', 'CAPTURE_PENDING', 'CAPTURED', 'CANCELLED', 'FAILED'],
  PENDING_APPROVAL: ['APPROVED', 'CANCELLED', 'FAILED'],
  APPROVED: ['CAPTURE_PENDING', 'CAPTURED', 'CANCELLED', 'FAILED'],
  CAPTURE_PENDING: ['CAPTURED', 'FAILED', 'REVERSED'],
  CAPTURED: ['REFUNDED', 'PARTIALLY_REFUNDED', 'REVERSED'],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
  PARTIALLY_REFUNDED: ['REFUNDED'],
  REVERSED: [],
};

/**
 * Precedence / lifecycle ranking to guard against out-of-order webhook delivery.
 * Higher rank means further along in the lifecycle. Out-of-order events must never regress rank.
 */
export const PAYMENT_STATUS_RANK: Record<PaymentStatus, number> = {
  CREATED: 0,
  ORDER_CREATED: 1,
  PAYER_ACTION_REQUIRED: 2,
  PENDING_APPROVAL: 2,
  APPROVED: 3,
  CAPTURE_PENDING: 4,
  CAPTURED: 5,
  PARTIALLY_REFUNDED: 6,
  REFUNDED: 6,
  REVERSED: 6,
  FAILED: 6,
  CANCELLED: 6,
};

export function isLegalPaymentTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return true;
  const allowed = PAYMENT_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): PaymentStatus {
  if (!isLegalPaymentTransition(from, to)) {
    throw new ForbiddenActionError(
      `Illegal payment state transition from '${from}' to '${to}'. State machine prohibits this transition.`,
    );
  }
  return to;
}

/**
 * Checks whether an incoming webhook status should update the current payment status.
 * Prevents out-of-order webhooks from regressing an already captured or completed payment.
 */
export function canProgressPaymentStatus(current: PaymentStatus, target: PaymentStatus): boolean {
  if (current === target) return true;

  // Once terminal or CAPTURED, cannot regress to an earlier status
  if (['CAPTURED', 'REFUNDED', 'REVERSED', 'FAILED', 'CANCELLED'].includes(current)) {
    // Only refund/reversal can move from CAPTURED
    if (current === 'CAPTURED' && ['REFUNDED', 'PARTIALLY_REFUNDED', 'REVERSED'].includes(target)) {
      return true;
    }
    return false;
  }

  // Reject regression in rank
  if (PAYMENT_STATUS_RANK[target] < PAYMENT_STATUS_RANK[current]) {
    return false;
  }

  return isLegalPaymentTransition(current, target);
}

