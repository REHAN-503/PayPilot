import { Controller, Get, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllowAnonymous, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { LlmService } from './agent/llm/llm.service.js';
import { PayPalClient } from './paypal/paypal.client.js';
import { isDemoAccount } from './auth/demo-account.js';

@Controller()
export class AppController {
  constructor(
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly llmService?: LlmService,
    @Optional() private readonly paypalClient?: PayPalClient,
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
  getConfigHealth(@Session() session?: UserSession) {
    const demoMode = this.config?.get<string>('DEMO_MODE') === 'true';
    const accountIsDemo = isDemoAccount(session?.user?.email);
    const nodeEnv = this.config?.get<string>('NODE_ENV') || 'development';
    const llm = this.llmService?.getConfigHealth();
    const liveRequired = this.llmService?.isLiveRequired() ?? (!demoMode || this.config?.get<string>('LLM_FORCE_LIVE') === 'true');
    const llmConfigured = llm?.llmConfigured ?? this.llmService?.hasLiveProvider() ?? false;

    return {
      llmMode: accountIsDemo ? 'fixture' : llm?.llmMode ?? (!liveRequired ? 'fixture' : 'live'),
      llmProvider: accountIsDemo ? 'fixture' : llm?.llmProvider ?? (this.config?.get<string>('LLM_PROVIDER') || 'anthropic'),
      llmModel: accountIsDemo ? 'built-in-demo-fixtures' : llm?.llmModel ?? (this.config?.get<string>('LLM_MODEL') || ''),
      llmConfigured: accountIsDemo || llmConfigured,
      paypalMode: this.paypalClient?.getMode() ?? (demoMode ? 'mock' : 'sandbox'),
      simulatorEnabled: false,
      environment: nodeEnv,
    } as const;
  }
}
