import { toast } from 'sonner';
import {
  type AnalyticsSummary,
  type AnalyticsTransactionRow,
  type Negotiation,
  type Payment,
  type PurchasePlan,
  type TimelineEvent,
  type UserPolicy,
  type RiskAssessment,
  type SpendMetrics,
  type WhatIfResult,
  AnalyticsSummarySchema,
  NegotiationSchema,
  PaymentSchema,
  ProductSchema,
  PurchasePlanSchema,
  UserPolicySchema,
} from './schemas';
import type { Product } from './schemas';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  schema?: { parse: (val: unknown) => T },
): Promise<T> {
  // Always use relative /api path so Next.js rewrites route it cleanly on same origin
  const url = path.startsWith('/api') ? path : `/api${path}`;

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });

    if (!response.ok) {
      let errMessage = `Error ${response.status}: ${response.statusText}`;
      let errDetails: unknown;
      try {
        const data = (await response.json()) as { message?: string; errors?: unknown };
        errMessage = data.message || errMessage;
        errDetails = data.errors || data;
      } catch {
        // Not JSON
      }

      toast.error('API Request Failed', {
        description: errMessage,
      });

      throw new ApiError(response.status, errMessage, errDetails);
    }

    const data = (await response.json()) as unknown;
    if (schema) {
      return schema.parse(data);
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const msg = error instanceof Error ? error.message : 'Network request failed';
    toast.error('Connection Error', { description: msg });
    throw new ApiError(0, msg);
  }
}

export const api = {
  // Catalog
  getProducts: (params?: { search?: string; category?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.category) query.set('category', params.category);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const queryString = query.toString() ? `?${query.toString()}` : '';

    return request<{
      data: Product[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/products${queryString}`, { method: 'GET' }, {
      parse: (value) => {
        const response = value as {
          data?: unknown;
          pagination?: unknown;
        };
        if (!Array.isArray(response.data) || !response.pagination) {
          throw new Error('Invalid product catalog response');
        }
        return {
          data: response.data.map((product) => ProductSchema.parse(product)),
          pagination: response.pagination as {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
          },
        };
      },
    });
  },

  // Intents & Planning
  createIntent: (rawInput: string) =>
    request<{
      intent: unknown;
      plan?: PurchasePlan;
      policyEvaluation?: {
        decision: 'ALLOW_AUTO' | 'REQUIRE_APPROVAL' | 'BLOCK';
        violations: string[];
        reasons: string[];
      };
      riskAssessment?: RiskAssessment;
      alternatives?: unknown[];
      tradeoffs?: unknown;
      message?: string;
    }>('/api/intents', {
      method: 'POST',
      body: JSON.stringify({ rawInput }),
    }),

  getPlans: () =>
    request<PurchasePlan[]>('/api/plans', { method: 'GET' }),

  getPlan: (id: string) =>
    request<PurchasePlan>(`/api/plans/${id}`, { method: 'GET' }, PurchasePlanSchema),

  evaluatePlan: (id: string) =>
    request<{
      decision: 'ALLOW_AUTO' | 'REQUIRE_APPROVAL' | 'BLOCK';
      violations: string[];
      reasons: string[];
      risk: RiskAssessment;
    }>(`/api/plans/${id}/evaluate`, { method: 'POST' }),

  getConfigHealth: () =>
    request<{
      llmMode: 'fixture' | 'live' | 'live+fallback';
      llmProvider?: string;
      llmModel?: string;
      llmConfigured?: boolean;
      paypalMode: 'sandbox' | 'live' | 'mock';
      simulatorEnabled: boolean;
      environment?: string;
    }>('/api/health/config', { method: 'GET' }),

  approvePlan: (id: string, note?: string) =>
    request<PurchasePlan>(`/api/plans/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }, PurchasePlanSchema),

  rejectPlan: (id: string, note?: string) =>
    request<PurchasePlan>(`/api/plans/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  whatIf: (id: string, params: { maxBudget?: number; quantity?: number }) =>
    request<WhatIfResult>(`/api/plans/${id}/what-if`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  selectAlternative: (id: string, productId: string) =>
    request<PurchasePlan>(`/api/plans/${id}/alternative`, {
      method: 'PATCH',
      body: JSON.stringify({ productId }),
    }, PurchasePlanSchema),

  // Negotiation
  startNegotiation: (planId: string, targetDiscountPercent?: number) =>
    request<Negotiation>(`/api/plans/${planId}/negotiate`, {
      method: 'POST',
      body: JSON.stringify({ targetDiscountPercent }),
    }, NegotiationSchema),

  getNegotiation: (id: string) =>
    request<Negotiation>(`/api/negotiations/${id}`, { method: 'GET' }, NegotiationSchema),

  // Payments
  createPayment: (planId: string) =>
    request<{ payment: Payment; orderId: string; approveUrl?: string }>(
      `/api/plans/${planId}/pay`,
      { method: 'POST' },
    ),

  capturePayment: (paymentId: string, orderId: string) =>
    request<{ payment: Payment; captureId: string; status: string; webhookConfirmed: boolean; message: string }>(
      `/api/payments/${paymentId}/capture`,
      {
        method: 'POST',
        body: JSON.stringify({ orderId }),
      },
    ),

  cancelPayment: (paymentId: string) =>
    request<Payment>(`/api/payments/${paymentId}/cancel`, { method: 'POST' }),

  getPayment: (paymentId: string) =>
    request<Payment>(`/api/payments/${paymentId}`, { method: 'GET' }, PaymentSchema),

  // Timeline
  getTimeline: (query?: { intentId?: string; planId?: string; paymentId?: string }) => {
    const q = new URLSearchParams();
    if (query?.intentId) q.set('intentId', query.intentId);
    if (query?.planId) q.set('planId', query.planId);
    if (query?.paymentId) q.set('paymentId', query.paymentId);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{ events: TimelineEvent[]; count: number }>(`/api/timeline${qs}`, {
      method: 'GET',
    });
  },
  exportLedger: async (format: 'csv' | 'json') => {
    const res = await fetch(`/api/ledger/export?format=${format}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new ApiError(res.status, 'Ledger export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paypilot-ledger.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  },
  exportTimeline: async (format: 'csv' | 'json', planId?: string) => {
    const qs = planId ? `?planId=${planId}` : '';
    const res = await fetch(`/api/timeline/export?format=${format}${qs}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new ApiError(res.status, 'Timeline export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paypilot-timeline.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Policy
  getPolicy: () =>
    request<{ policy: UserPolicy; spendMetrics: SpendMetrics }>('/api/policies/me', {
      method: 'GET',
    }),

  updatePolicy: (policy: Partial<UserPolicy>) =>
    request<UserPolicy>('/api/policies/me', {
      method: 'PUT',
      body: JSON.stringify(policy),
    }, UserPolicySchema),
  simulatePolicy: (input: { category: string; amount: number; merchant: string }) =>
    request<{ decision: string; violations: string[]; reasons: string[]; merchant: string; amount: number; category: string }>(
      '/api/policies/simulate',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  getReceipt: (paymentId: string) => request<Record<string, unknown>>(`/api/receipts/${paymentId}`, { method: 'GET' }),
  verifyReceipt: (paymentId: string) =>
    request<{ valid: boolean; brokenAtEventId: string | null; events: number }>(
      `/api/receipts/${paymentId}/verify`,
      { method: 'GET' },
    ),

  // Analytics
  getAnalyticsSummary: () =>
    request<AnalyticsSummary>('/api/analytics/summary', { method: 'GET' }, AnalyticsSummarySchema),

  getAnalyticsTransactions: () =>
    request<AnalyticsTransactionRow[]>(
      '/api/analytics/transactions',
      { method: 'GET' },
    ),

  getAnalyticsAgentActivity: () =>
    request<Array<{ id: string; type: string; actor: string; title: string; description: string; createdAt: string }>>('/api/analytics/agent-activity', { method: 'GET' }),

  // Dev Webhook Simulator
  simulateWebhook: (eventType: string, orderId?: string, captureId?: string) =>
    request<{ success: boolean; eventId?: string; result?: { status?: string } }>('/api/dev/webhooks/simulate', {
      method: 'POST',
      body: JSON.stringify({ eventType, orderId, captureId }),
    }),

  // ── NEW ADDITIVE ENDPOINTS ──────────────────────────────────
  // These are new API calls for new features added in v2.
  // They do NOT modify any existing bindings.

  // Product search with extended params (store page)
  searchProducts: (params: { query?: string; category?: string; sort?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params.query) query.set('search', params.query);
    if (params.category && params.category !== 'All') query.set('category', params.category);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<{
      data: Product[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/products${qs}`, { method: 'GET' }, {
      parse: (value) => {
        const response = value as { data?: unknown; pagination?: unknown };
        if (!Array.isArray(response.data) || !response.pagination) {
          throw new Error('Invalid product catalog response');
        }
        return {
          data: (response.data as unknown[]).map((product) => ProductSchema.parse(product)),
          pagination: response.pagination as { page: number; limit: number; total: number; totalPages: number },
        };
      },
    });
  },
};
