import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { PayPalClient } from './paypal.client.js';

describe('PayPalClient Security and Signature Verification', () => {
  it('uses the configured PayPal currency consistently', () => {
    const client = new PayPalClient(
      new ConfigService({
        PAYPAL_CURRENCY: 'eur',
      }),
    );

    expect(client.getCurrency()).toBe('EUR');
  });

  it('strictly rejects forged MOCK_SIG header bypass on normal verification', async () => {
    const config = new ConfigService({
      DEMO_MODE: 'true',
      NODE_ENV: 'development',
      PAYPAL_WEBHOOK_ID: 'WH-TEST-ID',
    });
    const client = new PayPalClient(config);

    const result = await client.verifyWebhookSignature({
      authAlgo: 'SHA256withRSA',
      certUrl: 'https://api.sandbox.paypal.com/cert',
      transmissionId: 'trans-123',
      transmissionSig: 'MOCK_SIG',
      transmissionTime: new Date().toISOString(),
      webhookEvent: { id: 'evt-1' },
      // Note: skipVerification is NOT set
    });

    expect(result).toBe(false);
  });

  it('strictly rejects forged SIMULATED_MOCK_SIGNATURE header bypass', async () => {
    const config = new ConfigService({
      DEMO_MODE: 'true',
      NODE_ENV: 'development',
      PAYPAL_WEBHOOK_ID: 'WH-TEST-ID',
    });
    const client = new PayPalClient(config);

    const result = await client.verifyWebhookSignature({
      authAlgo: 'SHA256withRSA',
      certUrl: 'https://api.sandbox.paypal.com/cert',
      transmissionId: 'trans-123',
      transmissionSig: 'SIMULATED_MOCK_SIGNATURE',
      transmissionTime: new Date().toISOString(),
      webhookEvent: { id: 'evt-1' },
    });

    expect(result).toBe(false);
  });

  it('rejects skipVerification if NODE_ENV is production even if DEMO_MODE is true', async () => {
    const config = new ConfigService({
      DEMO_MODE: 'true',
      NODE_ENV: 'production',
      PAYPAL_WEBHOOK_ID: 'WH-TEST-ID',
    });
    const client = new PayPalClient(config);

    const result = await client.verifyWebhookSignature({
      authAlgo: 'SHA256withRSA',
      certUrl: 'https://api.sandbox.paypal.com/cert',
      transmissionId: 'trans-123',
      transmissionSig: 'FORGED_SIG',
      transmissionTime: new Date().toISOString(),
      webhookEvent: { id: 'evt-1' },
      skipVerification: true,
    });

    expect(result).toBe(false);
  });

  it('rejects skipVerification if DEMO_MODE is not strictly "true"', async () => {
    const config = new ConfigService({
      DEMO_MODE: 'false',
      NODE_ENV: 'development',
      PAYPAL_WEBHOOK_ID: 'WH-TEST-ID',
    });
    const client = new PayPalClient(config);

    const result = await client.verifyWebhookSignature({
      authAlgo: 'SHA256withRSA',
      certUrl: 'https://api.sandbox.paypal.com/cert',
      transmissionId: 'trans-123',
      transmissionSig: 'FORGED_SIG',
      transmissionTime: new Date().toISOString(),
      webhookEvent: { id: 'evt-1' },
      skipVerification: true,
    });

    expect(result).toBe(false);
  });

  it('rejects if PAYPAL_WEBHOOK_ID is missing on incoming webhook', async () => {
    const config = new ConfigService({
      DEMO_MODE: 'true',
      NODE_ENV: 'development',
      PAYPAL_CLIENT_ID: 'valid_client_id',
      PAYPAL_CLIENT_SECRET: 'valid_client_secret',
      // No PAYPAL_WEBHOOK_ID
    });
    const client = new PayPalClient(config);

    const result = await client.verifyWebhookSignature({
      authAlgo: 'SHA256withRSA',
      certUrl: 'https://api.sandbox.paypal.com/cert',
      transmissionId: 'trans-123',
      transmissionSig: 'REAL_SIG',
      transmissionTime: new Date().toISOString(),
      webhookEvent: { id: 'evt-1' },
    });

    expect(result).toBe(false);
  });

  it('rejects if PayPal credentials are placeholder or missing on incoming webhook', async () => {
    const config = new ConfigService({
      DEMO_MODE: 'true',
      NODE_ENV: 'development',
      PAYPAL_WEBHOOK_ID: 'WH-TEST-ID',
      PAYPAL_CLIENT_ID: 'your_paypal_sandbox_client_id',
      PAYPAL_CLIENT_SECRET: 'your_paypal_sandbox_client_secret',
    });
    const client = new PayPalClient(config);

    const result = await client.verifyWebhookSignature({
      authAlgo: 'SHA256withRSA',
      certUrl: 'https://api.sandbox.paypal.com/cert',
      transmissionId: 'trans-123',
      transmissionSig: 'REAL_SIG',
      transmissionTime: new Date().toISOString(),
      webhookEvent: { id: 'evt-1' },
    });

    expect(result).toBe(false);
  });

  it('rejects if required transmission headers are missing', async () => {
    const config = new ConfigService({
      DEMO_MODE: 'true',
      NODE_ENV: 'development',
      PAYPAL_WEBHOOK_ID: 'WH-TEST-ID',
      PAYPAL_CLIENT_ID: 'valid_client_id',
      PAYPAL_CLIENT_SECRET: 'valid_client_secret',
    });
    const client = new PayPalClient(config);

    // Missing authAlgo
    const res1 = await client.verifyWebhookSignature({
      authAlgo: '',
      certUrl: 'https://api.sandbox.paypal.com/cert',
      transmissionId: 'trans-123',
      transmissionSig: 'SIG',
      transmissionTime: new Date().toISOString(),
      webhookEvent: { id: 'evt-1' },
    });
    expect(res1).toBe(false);

    // Missing certUrl
    const res2 = await client.verifyWebhookSignature({
      authAlgo: 'SHA256withRSA',
      certUrl: '',
      transmissionId: 'trans-123',
      transmissionSig: 'SIG',
      transmissionTime: new Date().toISOString(),
      webhookEvent: { id: 'evt-1' },
    });
    expect(res2).toBe(false);

    // Missing transmissionSig
    const res3 = await client.verifyWebhookSignature({
      authAlgo: 'SHA256withRSA',
      certUrl: 'https://api.sandbox.paypal.com/cert',
      transmissionId: 'trans-123',
      transmissionSig: '',
      transmissionTime: new Date().toISOString(),
      webhookEvent: { id: 'evt-1' },
    });
    expect(res3).toBe(false);
  });

  it('rejects if webhook event payload is empty or missing', async () => {
    const config = new ConfigService({
      DEMO_MODE: 'true',
      NODE_ENV: 'development',
      PAYPAL_WEBHOOK_ID: 'WH-TEST-ID',
      PAYPAL_CLIENT_ID: 'valid_client_id',
      PAYPAL_CLIENT_SECRET: 'valid_client_secret',
    });
    const client = new PayPalClient(config);

    const result = await client.verifyWebhookSignature({
      authAlgo: 'SHA256withRSA',
      certUrl: 'https://api.sandbox.paypal.com/cert',
      transmissionId: 'trans-123',
      transmissionSig: 'SIG',
      transmissionTime: new Date().toISOString(),
      webhookEvent: {},
    });

    expect(result).toBe(false);
  });

  it('rejects if rawBody is malformed JSON', async () => {
    const config = new ConfigService({
      DEMO_MODE: 'true',
      NODE_ENV: 'development',
      PAYPAL_WEBHOOK_ID: 'WH-TEST-ID',
      PAYPAL_CLIENT_ID: 'valid_client_id',
      PAYPAL_CLIENT_SECRET: 'valid_client_secret',
    });
    const client = new PayPalClient(config);

    const result = await client.verifyWebhookSignature({
      authAlgo: 'SHA256withRSA',
      certUrl: 'https://api.sandbox.paypal.com/cert',
      transmissionId: 'trans-123',
      transmissionSig: 'SIG',
      transmissionTime: new Date().toISOString(),
      webhookEvent: { id: 'evt-1' },
      rawBody: '{malformed_json:',
    });

    expect(result).toBe(false);
  });

  it('calls PayPal verification API and returns true on SUCCESS', async () => {
    const config = new ConfigService({
      DEMO_MODE: 'true',
      NODE_ENV: 'development',
      PAYPAL_WEBHOOK_ID: 'WH-TEST-ID',
      PAYPAL_CLIENT_ID: 'valid_client_id',
      PAYPAL_CLIENT_SECRET: 'valid_client_secret',
    });
    const client = new PayPalClient(config);

    // Mock getAccessToken and fetchWithRetry
    (client as any).getAccessToken = async () => 'mock-token';
    (client as any).fetchWithRetry = async () => ({
      ok: true,
      json: async () => ({ verification_status: 'SUCCESS' }),
      headers: new Headers(),
    });

    const result = await client.verifyWebhookSignature({
      authAlgo: 'SHA256withRSA',
      certUrl: 'https://api.sandbox.paypal.com/cert',
      transmissionId: 'trans-123',
      transmissionSig: 'SIG',
      transmissionTime: new Date().toISOString(),
      webhookEvent: { id: 'evt-1' },
    });

    expect(result).toBe(true);
  });

  it('returns false when PayPal verification API returns FAILURE', async () => {
    const config = new ConfigService({
      DEMO_MODE: 'true',
      NODE_ENV: 'development',
      PAYPAL_WEBHOOK_ID: 'WH-TEST-ID',
      PAYPAL_CLIENT_ID: 'valid_client_id',
      PAYPAL_CLIENT_SECRET: 'valid_client_secret',
    });
    const client = new PayPalClient(config);

    (client as any).getAccessToken = async () => 'mock-token';
    (client as any).fetchWithRetry = async () => ({
      ok: true,
      json: async () => ({ verification_status: 'FAILURE' }),
      headers: new Headers(),
    });

    const result = await client.verifyWebhookSignature({
      authAlgo: 'SHA256withRSA',
      certUrl: 'https://api.sandbox.paypal.com/cert',
      transmissionId: 'trans-123',
      transmissionSig: 'SIG',
      transmissionTime: new Date().toISOString(),
      webhookEvent: { id: 'evt-1' },
    });

    expect(result).toBe(false);
  });

  it('returns false when PayPal verification API is unavailable or returns HTTP error', async () => {
    const config = new ConfigService({
      DEMO_MODE: 'true',
      NODE_ENV: 'development',
      PAYPAL_WEBHOOK_ID: 'WH-TEST-ID',
      PAYPAL_CLIENT_ID: 'valid_client_id',
      PAYPAL_CLIENT_SECRET: 'valid_client_secret',
    });
    const client = new PayPalClient(config);

    (client as any).getAccessToken = async () => 'mock-token';
    (client as any).fetchWithRetry = async () => ({
      ok: false,
      status: 503,
      headers: new Headers(),
    });

    const result = await client.verifyWebhookSignature({
      authAlgo: 'SHA256withRSA',
      certUrl: 'https://api.sandbox.paypal.com/cert',
      transmissionId: 'trans-123',
      transmissionSig: 'SIG',
      transmissionTime: new Date().toISOString(),
      webhookEvent: { id: 'evt-1' },
    });

    expect(result).toBe(false);
  });

  it('allows skipVerification ONLY when DEMO_MODE===true AND NODE_ENV!==production', async () => {
    const config = new ConfigService({
      DEMO_MODE: 'true',
      NODE_ENV: 'development',
    });
    const client = new PayPalClient(config);

    const result = await client.verifyWebhookSignature({
      authAlgo: '',
      certUrl: '',
      transmissionId: 'trans-sim-123',
      transmissionSig: '',
      transmissionTime: new Date().toISOString(),
      webhookEvent: { id: 'evt-1' },
      skipVerification: true,
    });

    expect(result).toBe(true);
  });

  it('mock capture uses the order real amount, not hardcoded 189.99', async () => {
    const config = new ConfigService({
      DEMO_MODE: 'true',
      NODE_ENV: 'development',
    });
    const client = new PayPalClient(config);

    // 1. Create order with specific total ($249.50)
    const order = await client.createOrder({
      idempotencyKey: 'idem-1',
      referenceId: 'ref-dev-1',
      customId: 'custom-dev-1',
      invoiceId: 'inv-dev-1',
      total: 249.5,
      subtotal: 249.5,
      currency: 'USD',
      description: 'Dev monitor test',
      items: [
        {
          name: 'Dev Monitor',
          unitPrice: 249.5,
          quantity: 1,
        },
      ],
    });

    // 2. Capture the created mock order
    const capture = await client.captureOrder(order.id, 'cap-idem-1');
    const captureUnit = capture.purchase_units?.[0]?.payments?.captures?.[0];
    expect(captureUnit).toBeDefined();

    // non-null assertion safe after expect above
    expect(captureUnit!.amount?.value).toBe('249.50');
    expect(captureUnit!.amount?.currency_code).toBe('USD');
    expect(captureUnit!.amount?.value).not.toBe('189.99');
  });
});
