import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmService } from './llm/llm.service.js';

@Module({
  imports: [ConfigModule],
  providers: [LlmService],
  exports: [LlmService],
})
export class AgentModule {}

