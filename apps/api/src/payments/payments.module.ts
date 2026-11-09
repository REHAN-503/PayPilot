import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { PayPalService } from './paypal.service.js';
import { PayPalModule } from '../paypal/paypal.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';

@Module({
  imports: [PayPalModule, LedgerModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PayPalService],
  exports: [PaymentsService, PayPalService],
})
export class PaymentsModule {}

