import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PayPalOrderPayload {
  planId: string;
  total: number;
  subtotal: number;
  items: Array<{
    name: string;
    sku?: string | null;
    unitPrice: number;
    quantity: number;
  }>;
  idempotencyKey: string;
}

export interface PayPalOrderResult {
  id: string;
  status: string;
  approveUrl?: string;
}

export interface PayPalCaptureResult {
  captureId: string;
  orderId: string;
  status: 'COMPLETED' | 'FAILED' | 'PENDING';
  payerId?: string;
  amount: string;
  currency: string;
}

@Injectable()
export class PayPalService {
  private readonly logger = new Logger(PayPalService.name);
  private readonly baseUrl: string;
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly demoMode: boolean;

  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {
    this.baseUrl =
      this.config.get<string>('PAYPAL_API_BASE_URL') ||
      'https://api-m.sandbox.paypal.com';
    this.clientId = this.config.get<string>('PAYPAL_CLIENT_ID');
    this.clientSecret = this.config.get<string>('PAYPAL_CLIENT_SECRET');
    this.demoMode = this.config.get<string>('DEMO_MODE') !== 'false';
  }

  private hasValidCredentials(): boolean {
    return Boolean(
      this.clientId &&
        this.clientSecret &&
        !this.clientId.includes('your_paypal') &&
        !this.clientSecret.includes('your_paypal'),
    );
  }

  async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.token;
    }

    if (!this.hasValidCredentials()) {
      return 'mock-sandbox-access-token';
    }

    const auth = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(`PayPal OAuth failed: ${response.status} ${errText}`);
      throw new Error(`Failed to obtain PayPal access token: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };

    return this.cachedToken.token;
  }

  async createOrder(payload: PayPalOrderPayload): Promise<PayPalOrderResult> {
    if (this.demoMode || !this.hasValidCredentials()) {
      const mockOrderId = `MOCK-ORDER-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      return {
        id: mockOrderId,
        status: 'CREATED',
        approveUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${mockOrderId}`,
      };
    }

    const token = await this.getAccessToken();

    const body = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: payload.planId,
          description: `PayPilot Purchase Plan #${payload.planId.slice(-6)}`,
          custom_id: payload.planId,
          amount: {
            currency_code: 'USD',
            value: payload.total.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: 'USD',
                value: payload.subtotal.toFixed(2),
              },
            },
          },
          items: payload.items.map((item) => ({
            name: item.name.slice(0, 127),
            sku: (item.sku ?? 'SKU-GEN').slice(0, 127),
            unit_amount: {
              currency_code: 'USD',
              value: item.unitPrice.toFixed(2),
            },
            quantity: item.quantity.toString(),
          })),
        },
      ],
      application_context: {
        brand_name: 'PayPilot Commerce Agent',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: 'http://localhost:3000/dashboard/payment-success',
        cancel_url: 'http://localhost:3000/dashboard/payment-cancel',
      },
    };

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': payload.idempotencyKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`PayPal createOrder failed: ${response.status} ${err}`);
      throw new Error(`PayPal Order creation failed: ${response.statusText}`);
    }

    const order = (await response.json()) as {
      id: string;
      status: string;
      links?: Array<{ rel: string; href: string }>;
    };

    const approveLink = order.links?.find((l) => l.rel === 'approve')?.href;

    return {
      id: order.id,
      status: order.status,
      approveUrl: approveLink,
    };
  }

  async captureOrder(
    orderId: string,
    idempotencyKey: string,
  ): Promise<PayPalCaptureResult> {
    if (this.demoMode || !this.hasValidCredentials() || orderId.startsWith('MOCK-')) {
      const mockCaptureId = `MOCK-CAP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      return {
        captureId: mockCaptureId,
        orderId,
        status: 'COMPLETED',
        payerId: 'MOCK-PAYER-001',
        amount: '0.00',
        currency: 'USD',
      };
    }

    const token = await this.getAccessToken();

    const response = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': idempotencyKey,
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`PayPal capture failed: ${response.status} ${err}`);
      throw new Error(`PayPal capture failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      id: string;
      status: string;
      payer?: { payer_id?: string };
      purchase_units?: Array<{
        payments?: {
          captures?: Array<{
            id: string;
            status: string;
            amount?: { value: string; currency_code: string };
          }>;
        };
      }>;
    };

    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];

    return {
      captureId: capture?.id ?? data.id,
      orderId: data.id,
      status: data.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
      payerId: data.payer?.payer_id,
      amount: capture?.amount?.value ?? '0.00',
      currency: capture?.amount?.currency_code ?? 'USD',
    };
  }
}

