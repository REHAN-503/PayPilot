import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { AppController } from './app.controller.js';
import type { PayPalClient } from './paypal/paypal.client.js';

function controller(values: Record<string, string>) {
  const config = new ConfigService(values);
  const paypal = {
    hasValidCredentials: () => values.PAYPAL_CLIENT_ID === 'valid',
  } as unknown as PayPalClient;
  return new AppController(config, paypal);
}

describe('runtime configuration modes', () => {
  it('uses fixture LLM and mock PayPal in demo mode', () => {
    expect(controller({ DEMO_MODE: 'true' }).getConfigHealth()).toMatchObject({
      llmMode: 'fixture',
      paypalMode: 'mock',
    });
  });

  it('forces live LLM while retaining mock PayPal without credentials', () => {
    expect(
      controller({ DEMO_MODE: 'true', LLM_FORCE_LIVE: 'true' }).getConfigHealth(),
    ).toMatchObject({ llmMode: 'live', paypalMode: 'mock' });
  });

  it('uses live PayPal mode whenever credentials are valid', () => {
    expect(
      controller({ DEMO_MODE: 'true', PAYPAL_CLIENT_ID: 'valid' }).getConfigHealth(),
    ).toMatchObject({ paypalMode: 'sandbox-live' });
  });

  it('keeps the simulator independent from fixture mode', () => {
    expect(
      controller({ DEMO_MODE: 'false', ENABLE_WEBHOOK_SIMULATOR: 'true' }).getConfigHealth(),
    ).toMatchObject({ llmMode: 'live', simulatorEnabled: true });
    expect(
      controller({ DEMO_MODE: 'true', ENABLE_WEBHOOK_SIMULATOR: 'false' }).getConfigHealth(),
    ).toMatchObject({ llmMode: 'fixture', simulatorEnabled: false });
  });
});
