import { Module } from '@nestjs/common';
import { PayPalClient } from './paypal.client.js';

@Module({
  providers: [PayPalClient],
  exports: [PayPalClient],
})
export class PayPalModule {}

