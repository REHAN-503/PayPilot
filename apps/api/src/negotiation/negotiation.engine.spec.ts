import { describe, expect, it } from 'vitest';
import {
  generateDeterministicRound,
  isMonotoneConcession,
  validateOfferBounds,
  type NegotiationContext,
  type RoundProposal,
} from './negotiation.engine.js';

describe('Negotiation Engine Pure Logic', () => {
  const standardContext: NegotiationContext = {
    listPrice: 289.0,
    buyerCeiling: 289.0,
    merchantFloor: 250.0,
    maxRounds: 3,
  };

  describe('validateOfferBounds', () => {
    it('rejects buyer offer exceeding authorized ceiling', () => {
      const result = validateOfferBounds(295.0, standardContext, 'BUYER');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('exceeds authorized ceiling');
    });

    it('rejects buyer offer below 50% of list price', () => {
      const result = validateOfferBounds(100.0, standardContext, 'BUYER');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('below minimum threshold');
    });

    it('accepts buyer offer within valid limits', () => {
      const result = validateOfferBounds(240.0, standardContext, 'BUYER');
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('rejects merchant counter below secret merchant floor', () => {
      const result = validateOfferBounds(245.0, standardContext, 'MERCHANT');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('below secret merchant floor');
    });

    it('rejects merchant counter exceeding original list price', () => {
      const result = validateOfferBounds(310.0, standardContext, 'MERCHANT');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('exceeds original list price');
    });

    it('accepts merchant counter within valid limits', () => {
      const result = validateOfferBounds(275.0, standardContext, 'MERCHANT');
      expect(result.valid).toBe(true);
    });
  });

  describe('isMonotoneConcession', () => {
    it('verifies non-decreasing buyer concessions', () => {
      expect(isMonotoneConcession(240.0, 255.0, 'BUYER')).toBe(true);
      expect(isMonotoneConcession(255.0, 255.0, 'BUYER')).toBe(true);
      expect(isMonotoneConcession(255.0, 250.0, 'BUYER')).toBe(false);
    });

    it('verifies non-increasing merchant concessions', () => {
      expect(isMonotoneConcession(275.0, 262.0, 'MERCHANT')).toBe(true);
      expect(isMonotoneConcession(262.0, 262.0, 'MERCHANT')).toBe(true);
      expect(isMonotoneConcession(262.0, 270.0, 'MERCHANT')).toBe(false);
    });
  });

  describe('Deterministic 3-Round Benchmark for $289 Monitor', () => {
    it('executes exact sequence list $289 -> buyer 240 -> merchant 275 -> buyer 255 -> merchant 262 -> agreed 262', () => {
      const history: RoundProposal[] = [];

      // Round 1 Buyer
      const r1b = generateDeterministicRound(1, 'BUYER', standardContext, history);
      expect(r1b.price).toBe(240.0);
      expect(r1b.action).toBe('PROPOSE');
      history.push({ roundNumber: 1, speaker: 'BUYER', action: r1b.action, price: r1b.price, rationale: r1b.rationale });

      // Round 1 Merchant
      const r1m = generateDeterministicRound(1, 'MERCHANT', standardContext, history);
      expect(r1m.price).toBe(275.0);
      expect(r1m.action).toBe('COUNTER');
      history.push({ roundNumber: 1, speaker: 'MERCHANT', action: r1m.action, price: r1m.price, rationale: r1m.rationale });

      // Round 2 Buyer
      const r2b = generateDeterministicRound(2, 'BUYER', standardContext, history);
      expect(r2b.price).toBe(255.0);
      expect(r2b.action).toBe('COUNTER');
      expect(isMonotoneConcession(r1b.price, r2b.price, 'BUYER')).toBe(true);
      history.push({ roundNumber: 2, speaker: 'BUYER', action: r2b.action, price: r2b.price, rationale: r2b.rationale });

      // Round 2 Merchant
      const r2m = generateDeterministicRound(2, 'MERCHANT', standardContext, history);
      expect(r2m.price).toBe(262.0);
      expect(r2m.action).toBe('COUNTER');
      expect(isMonotoneConcession(r1m.price, r2m.price, 'MERCHANT')).toBe(true);
      history.push({ roundNumber: 2, speaker: 'MERCHANT', action: r2m.action, price: r2m.price, rationale: r2m.rationale });

      // Round 3 Buyer
      const r3b = generateDeterministicRound(3, 'BUYER', standardContext, history);
      expect(r3b.price).toBe(262.0);
      expect(r3b.action).toBe('ACCEPT');
      history.push({ roundNumber: 3, speaker: 'BUYER', action: r3b.action, price: r3b.price, rationale: r3b.rationale });

      // Round 3 Merchant
      const r3m = generateDeterministicRound(3, 'MERCHANT', standardContext, history);
      expect(r3m.price).toBe(262.0);
      expect(r3m.action).toBe('ACCEPT');

      // Assert final bounds
      expect(r3m.price).toBeGreaterThanOrEqual(standardContext.merchantFloor);
      expect(r3m.price).toBeLessThanOrEqual(standardContext.buyerCeiling);
    });
  });

  describe('Generalized Concessions for Arbitrary Catalog Items', () => {
    it('produces valid monotone concessions within bounds for arbitrary prices', () => {
      const customContext: NegotiationContext = {
        listPrice: 500.0,
        buyerCeiling: 450.0,
        merchantFloor: 380.0,
        maxRounds: 3,
      };

      const history: RoundProposal[] = [];

      const r1b = generateDeterministicRound(1, 'BUYER', customContext, history);
      expect(validateOfferBounds(r1b.price, customContext, 'BUYER').valid).toBe(true);
      history.push({ roundNumber: 1, speaker: 'BUYER', action: r1b.action, price: r1b.price, rationale: r1b.rationale });

      const r1m = generateDeterministicRound(1, 'MERCHANT', customContext, history);
      expect(validateOfferBounds(r1m.price, customContext, 'MERCHANT').valid).toBe(true);
      history.push({ roundNumber: 1, speaker: 'MERCHANT', action: r1m.action, price: r1m.price, rationale: r1m.rationale });

      const r2b = generateDeterministicRound(2, 'BUYER', customContext, history);
      expect(isMonotoneConcession(r1b.price, r2b.price, 'BUYER')).toBe(true);
      history.push({ roundNumber: 2, speaker: 'BUYER', action: r2b.action, price: r2b.price, rationale: r2b.rationale });

      const r2m = generateDeterministicRound(2, 'MERCHANT', customContext, history);
      expect(isMonotoneConcession(r1m.price, r2m.price, 'MERCHANT')).toBe(true);
      history.push({ roundNumber: 2, speaker: 'MERCHANT', action: r2m.action, price: r2m.price, rationale: r2m.rationale });

      const r3b = generateDeterministicRound(3, 'BUYER', customContext, history);
      expect(r3b.price).toBeLessThanOrEqual(customContext.buyerCeiling);
    });
  });
});

