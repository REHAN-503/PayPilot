import { Controller, Get, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { LlmService } from './agent/llm/llm.service.js';

@Controller()
export class AppController {
  constructor(
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly llmService?: LlmService,
  ) {}

  @AllowAnonymous()
  @Get()
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'PayPilot API',
      timestamp: new Date().toISOString(),
    };
  }

  @AllowAnonymous()
  @Get('health/config')
  getConfigHealth() {
    const demoMode = this.config?.get<string>('DEMO_MODE') === 'true';
    const nodeEnv = this.config?.get<string>('NODE_ENV') || 'development';
    const llm = this.llmService?.getConfigHealth();
    const liveRequired = this.llmService?.isLiveRequired() ?? (!demoMode || this.config?.get<string>('LLM_FORCE_LIVE') === 'true');
    const llmConfigured = llm?.llmConfigured ?? this.llmService?.hasLiveProvider() ?? false;

    return {
      llmMode: llm?.llmMode ?? (!liveRequired ? 'fixture' : 'live'),
      llmProvider: llm?.llmProvider ?? (this.config?.get<string>('LLM_PROVIDER') || 'anthropic'),
      llmModel: llm?.llmModel ?? (this.config?.get<string>('LLM_MODEL') || ''),
      llmConfigured,
      paypalMode: demoMode ? 'mock' : 'sandbox',
      simulatorEnabled: false,
      environment: nodeEnv,
    } as const;
  }
}