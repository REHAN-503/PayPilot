import { Module } from '@nestjs/common';
import { NegotiationService } from './negotiation.service.js';
import { NegotiationController } from './negotiation.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AgentModule } from '../agent/agent.module.js';
import { TimelineModule } from '../timeline/timeline.module.js';

@Module({
  imports: [PrismaModule, AgentModule, TimelineModule],
  controllers: [NegotiationController],
  providers: [NegotiationService],
  exports: [NegotiationService],
})
export class NegotiationModule {}

