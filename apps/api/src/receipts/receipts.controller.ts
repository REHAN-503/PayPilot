import { Controller, Get, Param } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ReceiptsService } from './receipts.service.js';

@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get(':paymentId')
  getReceipt(@Session() session: UserSession, @Param('paymentId') paymentId: string) {
    return this.receiptsService.getReceipt(session.user.id, paymentId);
  }

  @Get(':paymentId/verify')
  verify(@Session() session: UserSession, @Param('paymentId') paymentId: string) {
    return this.receiptsService.verify(session.user.id, paymentId);
  }
}
