import { Controller, Get } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { LedgerService } from './ledger.service.js';

@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get()
  findAll(@Session() session: UserSession) {
    return this.ledgerService.findAll(session.user.id);
  }
}

