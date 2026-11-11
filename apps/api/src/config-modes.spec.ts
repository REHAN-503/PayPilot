import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { AppController } from './app.controller.js';

function controller(values: Record<string, string>) {
  const config = new ConfigService(values);
  return new AppController(config);
}

describe('runtime configuration modes', () => {
  it('uses fixture LLM and mock PayPal in demo mode', () => {
    expect(controller({ DEMO_MODE: 'true' }).getConfigHealth()).toMatchObject({
      llmMode: 'fixture',
      paypalMode: 'mock',
      simulatorEnabled: false,
    });
  });

  it('forces live LLM while retaining mock PayPal without credentials', () => {
    expect(
      controller({ DEMO_MODE: 'true', LLM_FORCE_LIVE: 'true' }).getConfigHealth(),
    ).toMatchObject({ llmMode: 'live', paypalMode: 'mock', simulatorEnabled: false });
  });

  it('does not expose credential presence or simulator state publicly', () => {
    const result = controller({
      DEMO_MODE: 'true',
      PAYPAL_CLIENT_ID: 'valid',
      ENABLE_WEBHOOK_SIMULATOR: 'true',
    }).getConfigHealth();
    expect(result.simulatorEnabled).toBe(false);
    expect(result.paypalMode).not.toBe('sandbox-live');
  });

  it('reports environment', () => {
    const result = controller({
      DEMO_MODE: 'true',
      NODE_ENV: 'production',
    }).getConfigHealth();
    expect(result.environment).toBe('production');
  });
});
