import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TimelineService } from './timeline.service.js';

describe('TimelineService', () => {
  let service: TimelineService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      agentActivity: {
        findMany: vi.fn(),
      },
      approval: {
        findMany: vi.fn(),
      },
      riskAssessment: {
        findMany: vi.fn(),
      },
      payment: {
        findMany: vi.fn(),
      },
      transaction: {
        findMany: vi.fn(),
      },
      negotiation: {
        findMany: vi.fn(),
      },
      webhookEvent: {
        findMany: vi.fn(),
      },
    };

    service = new TimelineService(mockPrisma);
  });

  it('aggregates and normalizes events chronologically across multiple subsystem sources', async () => {
    const t0 = new Date('2026-11-09T01:00:00Z');
    const t1 = new Date('2026-11-09T01:05:00Z');
    const t2 = new Date('2026-11-09T01:10:00Z');
    const t3 = new Date('2026-11-09T01:15:00Z');

    mockPrisma.agentActivity.findMany.mockResolvedValue([
      {
        id: '1',
        createdAt: t0,
        type: 'INTENT_CREATED',
        actor: 'USER',
        title: 'User entered purchase intent',
        description: 'Need a developer monitor under $250',
        metadata: {},
      },
    ]);

    mockPrisma.approval.findMany.mockResolvedValue([
      {
        id: 'app-1',
        planId: 'plan-1',
        status: 'APPROVED',
        approvedAt: t2,
        createdAt: t1,
        decisionNote: 'Authorized by admin',
      },
    ]);

    mockPrisma.riskAssessment.findMany.mockResolvedValue([
      {
        id: 'risk-1',
        planId: 'plan-1',
        level: 'LOW',
        score: 15,
        reasons: ['Normal transaction volume'],
        policyPassed: true,
        createdAt: t1,
      },
    ]);

    mockPrisma.payment.findMany.mockResolvedValue([
      {
        id: 'pay-1',
        status: 'CAPTURED',
        amount: '229.99',
        currency: 'USD',
        paypalOrderId: 'ORD-123',
        paypalCaptureId: 'CAP-123',
        createdAt: t2,
        capturedAt: t3,
        webhookConfirmedAt: t3,
      },
    ]);

    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        type: 'PAYMENT_CAPTURED',
        amount: '229.99',
        currency: 'USD',
        idempotencyKey: 'CAP-123:PAYMENT_CAPTURED',
        createdAt: t3,
      },
    ]);

    mockPrisma.negotiation.findMany.mockResolvedValue([]);
    mockPrisma.webhookEvent.findMany.mockResolvedValue([]);

    const result = await service.getTimeline('user-1', { planId: 'plan-1' });

    expect(result.count).toBeGreaterThanOrEqual(4);
    // Chronological order verification
    for (let i = 1; i < result.events.length; i++) {
      const prevTime = new Date(result.events[i - 1].at).getTime();
      const currTime = new Date(result.events[i].at).getTime();
      expect(currTime).toBeGreaterThanOrEqual(prevTime);
    }

    // Verify stage mappings
    const stages = result.events.map((e) => e.stage);
    expect(stages).toContain('INTENT');
    expect(stages).toContain('RISK');
    expect(stages).toContain('APPROVAL');
    expect(stages).toContain('PAYPAL');
    expect(stages).toContain('LEDGER');
  });
});

