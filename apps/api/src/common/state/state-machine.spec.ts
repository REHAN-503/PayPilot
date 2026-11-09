import { describe, expect, it } from 'vitest';
import {
  IllegalStateTransitionError,
  transitionApprovalStatus,
  transitionIntentStatus,
  transitionPaymentStatus,
  transitionPlanStatus,
} from './state-machine.js';

describe('State Machine Pure Logic', () => {
  describe('Intent Transitions', () => {
    it('allows valid intent progression', () => {
      expect(transitionIntentStatus('DRAFT', 'PROCESSING')).toBe('PROCESSING');
      expect(transitionIntentStatus('PROCESSING', 'PLANNED')).toBe('PLANNED');
      expect(transitionIntentStatus('PLANNED', 'AWAITING_APPROVAL')).toBe('AWAITING_APPROVAL');
      expect(transitionIntentStatus('AWAITING_APPROVAL', 'APPROVED')).toBe('APPROVED');
      expect(transitionIntentStatus('APPROVED', 'EXECUTING')).toBe('EXECUTING');
      expect(transitionIntentStatus('EXECUTING', 'COMPLETED')).toBe('COMPLETED');
    });

    it('rejects illegal intent jump', () => {
      expect(() => transitionIntentStatus('DRAFT', 'COMPLETED')).toThrow(
        IllegalStateTransitionError,
      );
      expect(() => transitionIntentStatus('COMPLETED', 'DRAFT')).toThrow(
        IllegalStateTransitionError,
      );
    });

    it('allows identical state as idempotent no-op', () => {
      expect(transitionIntentStatus('DRAFT', 'DRAFT')).toBe('DRAFT');
    });
  });

  describe('Plan Transitions', () => {
    it('allows valid plan lifecycle', () => {
      expect(transitionPlanStatus('READY', 'AWAITING_APPROVAL')).toBe('AWAITING_APPROVAL');
      expect(transitionPlanStatus('AWAITING_APPROVAL', 'APPROVED')).toBe('APPROVED');
      expect(transitionPlanStatus('APPROVED', 'EXECUTING')).toBe('EXECUTING');
      expect(transitionPlanStatus('EXECUTING', 'COMPLETED')).toBe('COMPLETED');
    });

    it('rejects moving directly from READY to COMPLETED without approval/execution', () => {
      expect(() => transitionPlanStatus('READY', 'COMPLETED')).toThrow(
        IllegalStateTransitionError,
      );
    });
  });

  describe('Payment Transitions', () => {
    it('progresses from ORDER_CREATED through CAPTURED to REFUNDED', () => {
      expect(transitionPaymentStatus('CREATED', 'ORDER_CREATED')).toBe('ORDER_CREATED');
      expect(transitionPaymentStatus('ORDER_CREATED', 'CAPTURE_PENDING')).toBe('CAPTURE_PENDING');
      expect(transitionPaymentStatus('CAPTURE_PENDING', 'CAPTURED')).toBe('CAPTURED');
      expect(transitionPaymentStatus('CAPTURED', 'REFUNDED')).toBe('REFUNDED');
    });

    it('rejects capturing an already refunded payment', () => {
      expect(() => transitionPaymentStatus('REFUNDED', 'CAPTURED')).toThrow(
        IllegalStateTransitionError,
      );
    });
  });

  describe('Approval Transitions', () => {
    it('allows PENDING -> APPROVED and PENDING -> REJECTED', () => {
      expect(transitionApprovalStatus('PENDING', 'APPROVED')).toBe('APPROVED');
      expect(transitionApprovalStatus('PENDING', 'REJECTED')).toBe('REJECTED');
    });

    it('rejects changing a REJECTED decision back to APPROVED', () => {
      expect(() => transitionApprovalStatus('REJECTED', 'APPROVED')).toThrow(
        IllegalStateTransitionError,
      );
    });
  });
});

