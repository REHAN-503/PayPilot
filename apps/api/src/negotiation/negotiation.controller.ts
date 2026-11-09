import { Controller, Get, Param, Post } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { NegotiationService, type SafeNegotiationResponse } from './negotiation.service.js';

@Controller()
export class NegotiationController {
  constructor(private readonly negotiationService: NegotiationService) {}

  @Post('plans/:id/negotiate')
  negotiate(
    @Param('id') id: string,
    @Session() session: UserSession,
  ): Promise<SafeNegotiationResponse> {
    return this.negotiationService.startNegotiation(session.user.id, id);
  }

  @Get('negotiations/:id')
  findOne(
    @Param('id') id: string,
    @Session() session: UserSession,
  ): Promise<SafeNegotiationResponse> {
    return this.negotiationService.findOne(session.user.id, id);
  }
}

