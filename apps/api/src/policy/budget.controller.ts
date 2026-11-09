import { Controller, Get } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { PolicyService } from './policy.service.js';

@Controller('budget')
export class BudgetController {
  constructor(private readonly policyService: PolicyService) {}

  @Get('summary')
  getBudgetSummary(@Session() session: UserSession) {
    return this.policyService.getBudgetSummary(session.user.id);
  }
}

