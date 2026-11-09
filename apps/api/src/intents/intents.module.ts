import { Module } from '@nestjs/common';
import { IntentsController } from './intents.controller.js';
import { IntentsService } from './intents.service.js';
import { AgentModule } from '../agent/agent.module.js';

@Module({
  imports: [AgentModule],
  controllers: [IntentsController],
  providers: [IntentsService],
  exports: [IntentsService],
})
export class IntentsModule {}
