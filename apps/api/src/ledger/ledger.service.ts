import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LedgerEntryType } from '../generated/prisma/enums.js';

export interface RecordLedgerParams {
  type: LedgerEntryType;
  userId: string;
  paymentId: string;
  amount: number | string | { toString(): string };
  currency?: string;
  externalReference?: string | null;
  idempotencyKey: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append-only ledger recording with idempotency guarantee.
   * If a ledger record with the same idempotencyKey already exists, returns the existing record.
   */
  async record(params: RecordLedgerParams, tx?: any) {
    const client = tx || this.prisma;

    // Check for existing ledger entry with same idempotency key
    const existing = await client.transaction.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });

    if (existing) {
      this.logger.warn(
        `[LedgerService] Duplicate ledger entry ignored for idempotencyKey '${params.idempotencyKey}'`,
      );
      return existing;
    }

    const row = await client.transaction.create({
      data: {
        userId: params.userId,
        paymentId: params.paymentId,
        type: params.type,
        amount: params.amount.toString(),
        currency: params.currency || 'USD',
        externalReference: params.externalReference,
        idempotencyKey: params.idempotencyKey,
        description: params.description,
        metadata: params.metadata || {},
      },
    });

    this.logger.log(
      `[LedgerService] Recorded immutable ledger entry ${row.id} (${params.type}) for payment ${params.paymentId}, amount: $${row.amount}`,
    );

    return row;
  }

  async findAll(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        payment: {
          include: {
            plan: {
              include: { items: true },
            },
          },
        },
      },
    });

    const totalCaptured = transactions
      .filter((t) => t.type === 'PAYMENT_CAPTURED')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalRefunded = transactions
      .filter((t) => t.type === 'REFUND' || t.type === 'PARTIAL_REFUND')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      transactions,
      summary: {
        count: transactions.length,
        totalCaptured,
        totalRefunded,
        netSpend: totalCaptured - totalRefunded,
        currency: 'USD',
      },
    };
  }
}

