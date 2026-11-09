import { describe, expect, it, vi } from 'vitest';
import { ReceiptsService } from './receipts.service.js';

describe('ReceiptsService', () => {
  it('detects a tampered AgentActivity row', async () => {
    const activity = {
      id: 'event-1',
      userId: 'user-1',
      planId: 'plan-1',
      paymentId: 'payment-1',
      type: 'SYSTEM_EVENT',
      actor: 'AGENT',
      title: 'Original event',
      description: 'Original description',
      metadata: {},
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      prevHash: null,
      eventHash: 'tampered',
    };
    const prisma = {
      payment: {
        findFirst: vi.fn().mockResolvedValue({ id: 'payment-1', planId: 'plan-1' }),
      },
      agentActivity: {
        findMany: vi.fn().mockResolvedValue([activity]),
      },
    };
    const service = new ReceiptsService(prisma as never);

    await expect(service.verify('user-1', 'payment-1')).resolves.toEqual({
      valid: false,
      brokenAtEventId: 'event-1',
      events: 1,
    });
  });
});
