import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NegotiationService } from './negotiation.service.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('NegotiationService', () => {
  let service: NegotiationService;
  let mockPrisma: any;
  let mockTimelineEmitter: any;
  let mockLlmService: any;

  beforeEach(() => {
    mockPrisma = {
      purchasePlan: {
        findFirst: vi.fn(),
      },
      userPolicy: {
        upsert: vi.fn(),
      },
      transaction: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      negotiation: {
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
      },
      negotiationRound: {
        create: vi.fn(),
      },
      agentActivity: {
        create: vi.fn().mockResolvedValue({ id: 'act-1', createdAt: new Date() }),
      },
      $transaction: vi.fn(),
    };

    mockTimelineEmitter = {
      emit: vi.fn(),
    };

    mockLlmService = {
      isDemoMode: vi.fn().mockReturnValue(true),
      isForceLive: vi.fn().mockReturnValue(false),
      isLiveRequired: vi.fn().mockReturnValue(false),
      hasLiveProvider: vi.fn().mockReturnValue(false),
    };

    service = new NegotiationService(mockPrisma, mockTimelineEmitter, mockLlmService);
  });

  it('throws ForbiddenException if policy disallows negotiation', async () => {
    mockPrisma.purchasePlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      userId: 'user-1',
      total: 289.0,
      items: [{ quantity: 1, unitPrice: 289.0, product: { price: 289.0, minPrice: 250.0 } }],
    });

    mockPrisma.userPolicy.upsert.mockResolvedValue({
      userId: 'user-1',
      allowNegotiation: false,
    });

    await expect(service.startNegotiation('user-1', 'plan-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws NotFoundException if plan does not exist', async () => {
    mockPrisma.purchasePlan.findFirst.mockResolvedValue(null);

    await expect(service.startNegotiation('user-1', 'plan-404')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('completes 3-round negotiation for $289 monitor and creates agreed v2 plan', async () => {
    const plan = {
      id: 'plan-1',
      userId: 'user-1',
      intentId: 'intent-1',
      version: 1,
      total: 289.0,
      items: [
        {
          productId: 'prod-1',
          productName: 'NovaView 27-inch Pro Developer Monitor',
          productSku: 'ELEC-007',
          quantity: 1,
          unitPrice: 289.0,
          product: {
            id: 'prod-1',
            price: 289.0,
            minPrice: 250.0,
            stock: 15,
            status: 'ACTIVE',
            category: 'Electronics',
          },
        },
      ],
      intent: { category: 'Electronics' },
    };

    mockPrisma.purchasePlan.findFirst.mockResolvedValue(plan);

    mockPrisma.userPolicy.upsert.mockResolvedValue({
      userId: 'user-1',
      allowNegotiation: true,
      negotiationMaxRounds: 3,
      autonomyMode: 'ASK_EVERY_TIME',
      maxTransactionAmount: 500.0,
      dailySpendingLimit: 1000.0,
    });

    mockPrisma.negotiation.create.mockResolvedValue({
      id: 'neg-123',
      userId: 'user-1',
      planId: 'plan-1',
      status: 'IN_PROGRESS',
      initialPrice: 289.0,
      buyerCeiling: 289.0,
      merchantFloor: 250.0,
      maxRounds: 3,
    });

    const mockV2Plan = {
      id: 'plan-v2',
      version: 2,
      total: '262.00',
      status: 'AWAITING_APPROVAL',
      items: [
        {
          productId: 'prod-1',
          unitPrice: '262.00',
          quantity: 1,
          lineTotal: '262.00',
        },
      ],
    };

    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      return callback({
        purchasePlan: {
          create: vi.fn().mockResolvedValue(mockV2Plan),
        },
        riskAssessment: {
          create: vi.fn().mockResolvedValue({ id: 'risk-1' }),
        },
        approval: {
          create: vi.fn().mockResolvedValue({ id: 'app-1' }),
        },
        negotiation: {
          update: vi.fn().mockResolvedValue({ id: 'neg-123' }),
        },
      });
    });

    mockPrisma.negotiation.findFirst.mockResolvedValue({
      id: 'neg-123',
      userId: 'user-1',
      planId: 'plan-1',
      status: 'AGREED',
      initialPrice: '289.00',
      agreedPrice: '262.00',
      buyerCeiling: '289.00',
      merchantFloor: '250.00', // Stored in DB
      roundsCount: 3,
      maxRounds: 3,
      summary: 'Agreed at $262.00',
      createdAt: new Date(),
      updatedAt: new Date(),
      rounds: [
        { id: 'r1', roundNumber: 1, speaker: 'BUYER', action: 'PROPOSE', price: '240.00', rationale: 'offer 240', createdAt: new Date() },
        { id: 'r2', roundNumber: 1, speaker: 'MERCHANT', action: 'COUNTER', price: '275.00', rationale: 'counter 275', createdAt: new Date() },
        { id: 'r3', roundNumber: 2, speaker: 'BUYER', action: 'COUNTER', price: '255.00', rationale: 'offer 255', createdAt: new Date() },
        { id: 'r4', roundNumber: 2, speaker: 'MERCHANT', action: 'COUNTER', price: '262.00', rationale: 'counter 262', createdAt: new Date() },
        { id: 'r5', roundNumber: 3, speaker: 'BUYER', action: 'ACCEPT', price: '262.00', rationale: 'accept 262', createdAt: new Date() },
        { id: 'r6', roundNumber: 3, speaker: 'MERCHANT', action: 'ACCEPT', price: '262.00', rationale: 'accept 262', createdAt: new Date() },
      ],
    });

    const result = await service.startNegotiation('user-1', 'plan-1');

    expect(result.status).toBe('AGREED');
    expect(result.agreedPrice).toBe(262.0);
    expect(result.rounds.length).toBe(6);

    // CRITICAL SECURITY ASSERTION: merchantFloor MUST be excluded from serialized output!
    expect((result as any).merchantFloor).toBeUndefined();
  });
});

