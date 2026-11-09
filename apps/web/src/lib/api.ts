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
  PurchasePlanSchema,
  UserPolicySchema,
} from './schemas';

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
    request<PurchasePlan>(`/api/plans/${id}/select-alternative`, {
      method: 'POST',
      body: JSON.stringify({ productId }),
    }),

  // Negotiation
  startNegotiation: (planId: string) =>
    request<Negotiation>(`/api/plans/${planId}/negotiate`, {
      method: 'POST',
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

  // Policy
  getPolicy: () =>
    request<{ policy: UserPolicy; spendMetrics: SpendMetrics }>('/api/policies/me', {
      method: 'GET',
    }),

  updatePolicy: (policy: Partial<UserPolicy>) =>
    request<UserPolicy>('/api/policies/me', {
      method: 'PATCH',
      body: JSON.stringify(policy),
    }, UserPolicySchema),

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
};
