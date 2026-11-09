import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller.js';
import { DevWebhooksController } from './dev-webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { PayPalModule } from '../paypal/paypal.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';

@Module({
  imports: [PaymentsModule, PayPalModule, LedgerModule],
  controllers: [WebhooksController, DevWebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}

