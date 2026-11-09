import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AnalyticsService } from './analytics.service.js';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      userPolicy: {
        findUnique: vi.fn(),
      },
      transaction: {
        findMany: vi.fn(),
      },
      payment: {
        findMany: vi.fn(),
      },
      agentActivity: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      negotiation: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    service = new AnalyticsService(mockPrisma);
  });

  describe('getSummary', () => {
    it('calculates aggregate financial metrics and success rate correctly', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        { amount: '229.99' },
        { amount: '70.01' },
      ]);

      mockPrisma.payment.findMany.mockResolvedValue([
        { status: 'CAPTURED', webhookConfirmedAt: new Date() },
        { status: 'CAPTURED', webhookConfirmedAt: new Date() },
        { status: 'FAILED', webhookConfirmedAt: null },
      ]);

      mockPrisma.agentActivity.count
        .mockResolvedValueOnce(2) // POLICY_BLOCKED
        .mockResolvedValueOnce(1); // BUDGET_REPLANNED

      mockPrisma.negotiation.findMany.mockResolvedValue([
        { initialPrice: '289.00', agreedPrice: '262.00' }, // 9.34% savings
      ]);

      const summary = await service.getSummary('user-1');

      expect(summary.totalSpend).toBe(300.0);
      expect(summary.successRate).toBe(66.7);
      expect(summary.webhookConfirmedCount).toBe(2);
      expect(summary.blockedByPolicyCount).toBe(2);
      expect(summary.replansCount).toBe(1);
      expect(summary.avgNegotiationSavingsPct).toBeGreaterThan(9.0);
    });
  });

  describe('getTransactions', () => {
    it('returns formatted transaction rows for AG Grid', async () => {
      mockPrisma.userPolicy.findUnique.mockResolvedValue({
        autonomyMode: 'AUTO_WITHIN_LIMITS',
      });

      mockPrisma.negotiation.findMany.mockResolvedValue([
        {
          planId: 'plan-v2',
          initialPrice: '289.00',
          agreedPrice: '262.00',
          plan: { intentId: 'intent-1' },
        },
      ]);

      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          paymentId: 'pay-1',
          createdAt: new Date(),
          type: 'PAYMENT_CAPTURED',
          amount: '262.00',
          currency: 'USD',
          idempotencyKey: 'CAP-1:PAYMENT_CAPTURED',
          payment: {
            status: 'CAPTURED',
            webhookConfirmedAt: new Date(),
            plan: {
              id: 'plan-v2',
              intentId: 'intent-1',
              version: 2,
              items: [
                {
                  productName: 'NovaView 27-inch Pro Developer Monitor',
                  productSku: 'ELEC-007',
                  product: { category: 'Electronics' },
                },
              ],
              riskAssessments: [{ level: 'LOW', score: 20 }],
              negotiations: [{ initialPrice: '289.00', agreedPrice: '262.00' }],
            },
          },
        },
      ]);

      const rows = await service.getTransactions('user-1');

      expect(rows.length).toBe(1);
      expect(rows[0].productName).toBe('NovaView 27-inch Pro Developer Monitor');
      expect(rows[0].negotiatedSavings).toBe(27.0);
      expect(rows[0].autonomyMode).toBe('AUTO_WITHIN_LIMITS');
      expect(rows[0].riskLevel).toBe('LOW');
      expect(rows[0].webhookConfirmed).toBe(true);
    });
  });
});
