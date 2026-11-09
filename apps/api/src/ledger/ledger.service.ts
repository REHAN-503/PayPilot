import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

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

