import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { NegotiationService, type SafeNegotiationResponse } from './negotiation.service.js';
import { LlmRateLimitGuard } from '../common/rate-limit.guard.js';
import { isDemoAccount } from '../auth/demo-account.js';

@Controller()
export class NegotiationController {
  constructor(private readonly negotiationService: NegotiationService) {}

  @Post('plans/:id/negotiate')
  @UseGuards(LlmRateLimitGuard)
  negotiate(
    @Param('id') id: string,
    @Session() session: UserSession,
    @Body() body: unknown,
  ): Promise<SafeNegotiationResponse> {
    const parsed = z.object({ targetDiscountPercent: z.number().min(0).max(50).optional() }).safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException('targetDiscountPercent must be between 0 and 50');
    return this.negotiationService.startNegotiation(
      session.user.id,
      id,
      parsed.data.targetDiscountPercent,
      isDemoAccount(session.user.email),
    );
  }

  @Get('negotiations/:id')
  findOne(
    @Param('id') id: string,
    @Session() session: UserSession,
  ): Promise<SafeNegotiationResponse> {
    return this.negotiationService.findOne(session.user.id, id);
  }
}
