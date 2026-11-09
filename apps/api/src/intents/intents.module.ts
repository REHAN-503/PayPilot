import { Module } from '@nestjs/common';
import { IntentsController } from './intents.controller.js';
import { IntentsService } from './intents.service.js';
import { AgentModule } from '../agent/agent.module.js';
import { ReplanModule } from '../replan/replan.module.js';

@Module({
  imports: [AgentModule, ReplanModule],
  controllers: [IntentsController],
  providers: [IntentsService],
  exports: [IntentsService],
})
export class IntentsModule {}
