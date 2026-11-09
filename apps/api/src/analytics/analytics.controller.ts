import { Controller, Get } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import {
  AnalyticsService,
  type AnalyticsSummary,
  type AnalyticsTransactionRow,
} from './analytics.service.js';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('transactions')
  getTransactions(@Session() session: UserSession): Promise<AnalyticsTransactionRow[]> {
    return this.analyticsService.getTransactions(session.user.id);
  }

  @Get('summary')
  getSummary(@Session() session: UserSession): Promise<AnalyticsSummary> {
    return this.analyticsService.getSummary(session.user.id);
  }

  @Get('agent-activity')
  getAgentActivity(@Session() session: UserSession) {
    return this.analyticsService.getAgentActivity(session.user.id);
  }
}

