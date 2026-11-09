import { describe, expect, it } from 'vitest';
import {
  PAYMENT_TRANSITIONS,
  type PaymentStatus,
  assertPaymentTransition,
  canProgressPaymentStatus,
  isLegalPaymentTransition,
} from './payment.sm.js';
import { ForbiddenActionError } from '../agent/llm/llm-errors.js';

describe('Payment State Machine', () => {
  describe('isLegalPaymentTransition()', () => {
    it('returns true when from === to', () => {
      const statuses: PaymentStatus[] = [
        'CREATED',
        'ORDER_CREATED',
        'PAYER_ACTION_REQUIRED',
        'CAPTURE_PENDING',
        'CAPTURED',
        'FAILED',
      ];
      for (const s of statuses) {
        expect(isLegalPaymentTransition(s, s)).toBe(true);
      }
    });

    it.each(
      Object.entries(PAYMENT_TRANSITIONS).flatMap(([from, allowed]) =>
        allowed.map((to) => ({ from: from as PaymentStatus, to })),
      ),
    )('allows legal transition $from -> $to', ({ from, to }) => {
      expect(isLegalPaymentTransition(from, to)).toBe(true);
      expect(assertPaymentTransition(from, to)).toBe(to);
    });

    it('rejects illegal transitions', () => {
      expect(isLegalPaymentTransition('CAPTURED', 'ORDER_CREATED')).toBe(false);
      expect(isLegalPaymentTransition('FAILED', 'CAPTURED')).toBe(false);
      expect(isLegalPaymentTransition('CANCELLED', 'APPROVED')).toBe(false);
    });

    it('throws ForbiddenActionError on assertPaymentTransition for illegal transition', () => {
      expect(() => assertPaymentTransition('CAPTURED', 'ORDER_CREATED')).toThrow(
        ForbiddenActionError,
      );
      expect(() => assertPaymentTransition('FAILED', 'APPROVED')).toThrow(
        ForbiddenActionError,
      );
    });
  });

  describe('canProgressPaymentStatus() - out-of-order webhook protection', () => {
    it('allows normal progression', () => {
      expect(canProgressPaymentStatus('ORDER_CREATED', 'PAYER_ACTION_REQUIRED')).toBe(true);
      expect(canProgressPaymentStatus('PAYER_ACTION_REQUIRED', 'APPROVED')).toBe(true);
      expect(canProgressPaymentStatus('APPROVED', 'CAPTURE_PENDING')).toBe(true);
      expect(canProgressPaymentStatus('CAPTURE_PENDING', 'CAPTURED')).toBe(true);
      expect(canProgressPaymentStatus('CAPTURED', 'REFUNDED')).toBe(true);
    });

    it('blocks regression from CAPTURED to earlier states', () => {
      expect(canProgressPaymentStatus('CAPTURED', 'ORDER_CREATED')).toBe(false);
      expect(canProgressPaymentStatus('CAPTURED', 'PAYER_ACTION_REQUIRED')).toBe(false);
      expect(canProgressPaymentStatus('CAPTURED', 'CAPTURE_PENDING')).toBe(false);
      expect(canProgressPaymentStatus('CAPTURED', 'APPROVED')).toBe(false);
      expect(canProgressPaymentStatus('CAPTURED', 'FAILED')).toBe(false);
    });

    it('blocks regression from CAPTURE_PENDING to ORDER_CREATED', () => {
      expect(canProgressPaymentStatus('CAPTURE_PENDING', 'ORDER_CREATED')).toBe(false);
      expect(canProgressPaymentStatus('CAPTURE_PENDING', 'PAYER_ACTION_REQUIRED')).toBe(false);
    });

    it('blocks transitions from terminal states', () => {
      expect(canProgressPaymentStatus('FAILED', 'CAPTURED')).toBe(false);
      expect(canProgressPaymentStatus('CANCELLED', 'ORDER_CREATED')).toBe(false);
      expect(canProgressPaymentStatus('REFUNDED', 'CAPTURED')).toBe(false);
    });
  });
});

