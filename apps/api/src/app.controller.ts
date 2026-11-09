import { Controller, Get, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayPalClient } from './paypal/paypal.client.js';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller()
export class AppController {
  constructor(
    @Optional() private readonly config?: ConfigService,
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
  getConfigHealth() {
    const demoMode = this.config?.get<string>('DEMO_MODE') === 'true';
    const forceLive = this.config?.get<string>('LLM_FORCE_LIVE') === 'true';
    const provider = this.config?.get<string>('LLM_PROVIDER') || 'anthropic';
    const hasLlmKey = Boolean(
      provider === 'gemini'
        ? this.config?.get<string>('GEMINI_API_KEY')
        : this.config?.get<string>('ANTHROPIC_API_KEY'),
    );
    const simulatorFlag = this.config?.get<string>('ENABLE_WEBHOOK_SIMULATOR');
    const simulatorEnabled =
      (simulatorFlag === 'true' ||
        (simulatorFlag === undefined && demoMode)) &&
      this.config?.get<string>('NODE_ENV') !== 'production';

    return {
      llmMode: !forceLive && demoMode ? 'fixture' : 'live',
      paypalMode: this.paypalClient?.hasValidCredentials() || !demoMode
        ? 'sandbox-live'
        : 'mock',
      simulatorEnabled,
      llmConfigured: hasLlmKey,
    } as const;
  }
}