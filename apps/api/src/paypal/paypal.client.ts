import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class PayPalApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly debugId?: string,
    public readonly paypalName?: string,
    public readonly details?: unknown[],
  ) {
    super(message);
    this.name = 'PayPalApiError';
  }
}

export interface CreateOrderParams {
  idempotencyKey: string;
  referenceId: string;
  customId: string;
  invoiceId: string;
  description: string;
  currency: string;
  total: number;
  subtotal: number;
  items: Array<{
    name: string;
    sku?: string | null;
    unitPrice: number;
    quantity: number;
  }>;
}

export interface PayPalOrderResponse {
  id: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  links?: Array<{ rel: string; href: string; method?: string }>;
  purchase_units?: Array<{
    reference_id?: string;
    amount?: { currency_code: string; value: string };
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount?: { currency_code: string; value: string };
      }>;
    };
  }>;
  payer?: {
    payer_id?: string;
    email_address?: string;
  };
}

export interface PayPalCaptureResponse {
  id: string; // Order ID
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  payer?: {
    payer_id?: string;
    email_address?: string;
  };
  purchase_units?: Array<{
    reference_id?: string;
    payments?: {
      captures?: Array<{
        id: string;
        status: 'COMPLETED' | 'DECLINED' | 'FAILED' | 'PENDING';
        amount?: { currency_code: string; value: string };
        seller_receivable_breakdown?: unknown;
      }>;
    };
  }>;
}

export interface VerifyWebhookParams {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
  webhookId?: string;
  webhookEvent: Record<string, unknown>;
  rawBody?: string;
  skipVerification?: boolean;
}

export interface WebhookVerificationResult {
  verification_status: 'SUCCESS' | 'FAILURE';
}

@Injectable()
export class PayPalClient {
  private readonly logger = new Logger(PayPalClient.name);
  private readonly baseUrl: string;
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly webhookId?: string;
  private readonly demoMode: boolean;

  private cachedToken: { token: string; expiresAt: number } | null = null;
  private readonly mockOrders = new Map<string, { total: string; currency: string }>();

  constructor(private readonly config: ConfigService) {
    this.baseUrl =
      this.config.get<string>('PAYPAL_API_BASE_URL') ||
      'https://api-m.sandbox.paypal.com';
    this.clientId = this.config.get<string>('PAYPAL_CLIENT_ID');
    this.clientSecret = this.config.get<string>('PAYPAL_CLIENT_SECRET');
    this.webhookId = this.config.get<string>('PAYPAL_WEBHOOK_ID');
    this.demoMode = this.config.get<string>('DEMO_MODE') === 'true';
  }

  hasValidCredentials(): boolean {
    return Boolean(
      this.clientId &&
        this.clientSecret &&
        !this.clientId.includes('your_paypal') &&
        !this.clientSecret.includes('your_paypal'),
    );
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    // Early refresh buffer: 60 seconds before expiration
    if (this.cachedToken && now < this.cachedToken.expiresAt - 60000) {
      return this.cachedToken.token;
    }

    if (!this.hasValidCredentials()) {
      if (this.demoMode) {
        return 'mock-sandbox-access-token';
      }
      throw new PayPalApiError(
        'Missing PayPal client credentials. Configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.',
        401,
      );
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(15000),
    });

    const debugId = res.headers.get('paypal-debug-id') || undefined;

    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(
        `[PayPalClient] OAuth token request failed with HTTP ${res.status}. DebugId: ${debugId || 'N/A'}. Error: ${errText}`,
      );
      throw new PayPalApiError(
        `Failed to obtain PayPal OAuth token (${res.statusText})`,
        res.status,
        debugId,
      );
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.cachedToken = {
      token: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    };

    return this.cachedToken.token;
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit & { headers: Record<string, string> },
    maxRetries = 1,
  ): Promise<Response> {
    let attempt = 0;
    while (attempt <= maxRetries) {
      attempt++;
      try {
        const res = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(15000),
        });

        // Retry on 5xx server errors with same Request-ID
        if (res.status >= 500 && attempt <= maxRetries) {
          const debugId = res.headers.get('paypal-debug-id');
          this.logger.warn(
            `[PayPalClient] PayPal 5xx error (${res.status}) on attempt ${attempt}. DebugId: ${debugId}. Retrying...`,
          );
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        return res;
      } catch (err: any) {
        if (attempt <= maxRetries) {
          this.logger.warn(
            `[PayPalClient] Network error on attempt ${attempt} (${err.message}). Retrying...`,
          );
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        throw err;
      }
    }
    throw new Error('[PayPalClient] Unexpected retry loop exit');
  }

  async createOrder(params: CreateOrderParams): Promise<PayPalOrderResponse> {
    if (!this.hasValidCredentials() && this.demoMode) {
      const mockId = `MOCK-ORD-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      this.mockOrders.set(mockId, {
        total: params.total.toFixed(2),
        currency: params.currency || 'USD',
      });
      return {
        id: mockId,
        status: 'CREATED',
        links: [
          { rel: 'approve', href: `https://www.sandbox.paypal.com/checkoutnow?token=${mockId}` },
        ],
      };
    }

    const token = await this.getAccessToken();

    const body = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: params.referenceId,
          custom_id: params.customId,
          invoice_id: params.invoiceId,
          description: params.description.slice(0, 127),
          amount: {
            currency_code: params.currency,
            value: params.total.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: params.currency,
                value: params.subtotal.toFixed(2),
              },
            },
          },
          items: params.items.map((item) => ({
            name: item.name.slice(0, 127),
            sku: (item.sku ?? 'SKU-GEN').slice(0, 127),
            unit_amount: {
              currency_code: params.currency,
              value: item.unitPrice.toFixed(2),
            },
            quantity: item.quantity.toString(),
          })),
        },
      ],
    };

    const res = await this.fetchWithRetry(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': params.idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    const debugId = res.headers.get('paypal-debug-id') || undefined;

    if (!res.ok) {
      const errJson = (await res.json().catch(() => ({}))) as any;
      this.logger.error(
        `[PayPalClient] createOrder failed with HTTP ${res.status}. DebugId: ${debugId || 'N/A'}. Details: ${JSON.stringify(errJson)}`,
      );
      throw new PayPalApiError(
        errJson.message || `PayPal order creation failed (${res.statusText})`,
        res.status,
        debugId,
        errJson.name,
        errJson.details,
      );
    }

    return (await res.json()) as PayPalOrderResponse;
  }

  async captureOrder(
    orderId: string,
    idempotencyKey: string,
    expectedAmount?: { total: number | string; currency?: string },
  ): Promise<PayPalCaptureResponse> {
    if ((!this.hasValidCredentials() && this.demoMode) || orderId.startsWith('MOCK-')) {
      const mockCapId = `MOCK-CAP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const savedMock = this.mockOrders.get(orderId);
      const value =
        savedMock?.total ??
        (expectedAmount ? Number(expectedAmount.total).toFixed(2) : '100.00');
      const currency = savedMock?.currency ?? (expectedAmount?.currency || 'USD');

      return {
        id: orderId,
        status: 'COMPLETED',
        payer: { payer_id: 'MOCK-PAYER-123', email_address: 'buyer@sandbox.paypal.com' },
        purchase_units: [
          {
            reference_id: 'default',
            payments: {
              captures: [
                {
                  id: mockCapId,
                  status: 'COMPLETED',
                  amount: { currency_code: currency, value },
                },
              ],
            },
          },
        ],
      };
    }

    const token = await this.getAccessToken();

    const res = await this.fetchWithRetry(
      `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': idempotencyKey,
        },
        body: JSON.stringify({}),
      },
    );

    const debugId = res.headers.get('paypal-debug-id') || undefined;

    if (!res.ok) {
      const errJson = (await res.json().catch(() => ({}))) as any;
      this.logger.error(
        `[PayPalClient] captureOrder failed with HTTP ${res.status}. DebugId: ${debugId || 'N/A'}. Details: ${JSON.stringify(errJson)}`,
      );
      throw new PayPalApiError(
        errJson.message || `PayPal order capture failed (${res.statusText})`,
        res.status,
        debugId,
        errJson.name,
        errJson.details,
      );
    }

    return (await res.json()) as PayPalCaptureResponse;
  }

  async getOrder(orderId: string): Promise<PayPalOrderResponse> {
    if ((!this.hasValidCredentials() && this.demoMode) || orderId.startsWith('MOCK-')) {
      return {
        id: orderId,
        status: 'APPROVED',
      };
    }

    const token = await this.getAccessToken();

    const res = await this.fetchWithRetry(
      `${this.baseUrl}/v2/checkout/orders/${orderId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const debugId = res.headers.get('paypal-debug-id') || undefined;

    if (!res.ok) {
      const errJson = (await res.json().catch(() => ({}))) as any;
      this.logger.error(
        `[PayPalClient] getOrder failed with HTTP ${res.status}. DebugId: ${debugId || 'N/A'}. Details: ${JSON.stringify(errJson)}`,
      );
      throw new PayPalApiError(
        errJson.message || `PayPal getOrder failed (${res.statusText})`,
        res.status,
        debugId,
        errJson.name,
        errJson.details,
      );
    }

    return (await res.json()) as PayPalOrderResponse;
  }

  async verifyWebhookSignature(params: VerifyWebhookParams): Promise<boolean> {
    const isDevDemo =
      this.demoMode &&
      this.config.get<string>('NODE_ENV') !== 'production';

    // Explicit skipVerification option can ONLY be honored in dev/demo environments
    if (params.skipVerification) {
      if (isDevDemo) {
        this.logger.log(
          '[PayPalClient] Webhook verification skipped via dev-authorized skipVerification in DEMO_MODE',
        );
        return true;
      }
      this.logger.warn(
        '[PayPalClient] Rejected webhook: skipVerification flag is forbidden in production or non-demo mode',
      );
      return false;
    }

    const webhookId = params.webhookId || this.webhookId;
    if (!webhookId) {
      this.logger.warn(
        '[PayPalClient] No PAYPAL_WEBHOOK_ID configured; rejecting unverified webhook',
      );
      return false;
    }

    if (!this.hasValidCredentials()) {
      this.logger.warn(
        '[PayPalClient] Missing valid PayPal credentials for webhook signature verification',
      );
      return false;
    }

    // Require all necessary PayPal transmission headers
    if (
      !params.authAlgo ||
      !params.certUrl ||
      !params.transmissionId ||
      !params.transmissionSig ||
      !params.transmissionTime
    ) {
      this.logger.warn(
        `[PayPalClient] Missing required PayPal transmission headers (authAlgo=${Boolean(params.authAlgo)}, certUrl=${Boolean(params.certUrl)}, transmissionId=${Boolean(params.transmissionId)}, transmissionSig=${Boolean(params.transmissionSig)}, transmissionTime=${Boolean(params.transmissionTime)}); rejecting unverified webhook`,
      );
      return false;
    }

    // Require valid, non-empty event payload
    if (
      !params.webhookEvent ||
      typeof params.webhookEvent !== 'object' ||
      Object.keys(params.webhookEvent).length === 0
    ) {
      this.logger.warn(
        '[PayPalClient] Missing or empty webhook event payload; rejecting unverified webhook',
      );
      return false;
    }

    // Validate rawBody if provided before making any network calls
    let eventPayload: Record<string, unknown> = params.webhookEvent;
    if (params.rawBody) {
      try {
        eventPayload = JSON.parse(params.rawBody);
      } catch {
        this.logger.warn(
          '[PayPalClient] Malformed rawBody JSON; rejecting unverified webhook',
        );
        return false;
      }
    }

    try {
      const token = await this.getAccessToken();

      const body = {
        auth_algo: params.authAlgo,
        cert_url: params.certUrl,
        transmission_id: params.transmissionId,
        transmission_sig: params.transmissionSig,
        transmission_time: params.transmissionTime,
        webhook_id: webhookId,
        webhook_event: eventPayload,
      };

      const res = await this.fetchWithRetry(
        `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const debugId = res.headers.get('paypal-debug-id') || undefined;
        this.logger.warn(
          `[PayPalClient] Webhook verification returned HTTP ${res.status}. DebugId: ${debugId}`,
        );
        return false;
      }

      const data = (await res.json()) as WebhookVerificationResult;
      return data.verification_status === 'SUCCESS';
    } catch (err: any) {
      this.logger.error(`[PayPalClient] Failed to verify webhook signature: ${err.message}`);
      return false;
    }
  }
}

