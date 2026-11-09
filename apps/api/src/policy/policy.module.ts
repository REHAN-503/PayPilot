import { Module } from '@nestjs/common';
import { PolicyService } from './policy.service.js';
import { PolicyController } from './policy.controller.js';
import { BudgetController } from './budget.controller.js';

@Module({
  controllers: [PolicyController, BudgetController],
  providers: [PolicyService],
  exports: [PolicyService],
})
export class PolicyModule {}

