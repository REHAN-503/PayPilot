import { Module, forwardRef } from '@nestjs/common';
import { PlansController } from './plans.controller.js';
import { PlansService } from './plans.service.js';
import { ReplanModule } from '../replan/replan.module.js';
import { PaymentsModule } from '../payments/payments.module.js';

@Module({
  imports: [ReplanModule, forwardRef(() => PaymentsModule)],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}

