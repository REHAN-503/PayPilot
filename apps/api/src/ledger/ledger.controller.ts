import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { LedgerService } from './ledger.service.js';

@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get()
  findAll(@Session() session: UserSession) {
    return this.ledgerService.findAll(session.user.id);
  }

  @Get('export')
  async export(
    @Session() session: UserSession,
    @Query('format') format: 'csv' | 'json' = 'json',
    @Res() response: Response,
  ) {
    const result = await this.ledgerService.findAll(session.user.id);
    if (format !== 'csv') return response.json(result.transactions);
    const rows = result.transactions.map((transaction) => [
      transaction.id,
      transaction.createdAt.toISOString(),
      transaction.type,
      transaction.amount.toString(),
      transaction.currency,
      transaction.paymentId,
      transaction.externalReference ?? '',
    ]);
    const csv = [['id', 'createdAt', 'type', 'amount', 'currency', 'paymentId', 'externalReference'], ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    response.type('text/csv').setHeader('Content-Disposition', 'attachment; filename="paypilot-ledger.csv"').send(csv);
  }
}
