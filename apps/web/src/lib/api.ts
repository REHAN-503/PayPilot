import type {
  Product,
  PurchaseIntent,
  PurchasePlan,
  Approval,
  Payment,
  UserPolicy,
  Transaction,
} from '../types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    let errMessage = `HTTP error ${response.status}: ${response.statusText}`;
    let errDetails: unknown;
    try {
      const data = (await response.json()) as { message?: string; errors?: unknown };
      errMessage = data.message || errMessage;
      errDetails = data.errors || data;
    } catch {
      // not json
    }
    throw new ApiError(response.status, errMessage, errDetails);
  }

  return response.json() as Promise<T>;
}

export interface IntentResponse {
  intent: PurchaseIntent;
  plan: PurchasePlan | null;
  policyEvaluation: Record<string, unknown> | null;
  riskAssessment: Record<string, unknown> | null;
  alternatives: Product[];
  message: string;
}

export interface LedgerResponse {
  transactions: Transaction[];
  summary: {
    count: number;
    totalCaptured: number;
    totalRefunded: number;
    netSpend: number;
    currency: string;
  };
}

export interface PolicyResponse {
  policy: UserPolicy;
  spendMetrics: {
    dailySpent: number;
    dailyLimit: number | null;
    dailyRemaining: number | null;
    monthlySpent: number;
    monthlyLimit: number | null;
    monthlyRemaining: number | null;
  };
}

export const api = {
  // Products
  getProducts: (params?: { search?: string; category?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.category) q.set('category', params.category);
    if (params?.page) q.set('page', params.page.toString());
    if (params?.limit) q.set('limit', params.limit.toString());
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return request<{ data: Product[]; pagination: { total: number } }>(`/products${queryStr}`);
  },

  getProduct: (id: string) => request<Product>(`/products/${id}`),

  // Intents
  createIntent: (rawInput: string) =>
    request<IntentResponse>('/intents', {
      method: 'POST',
      body: JSON.stringify({ rawInput }),
    }),

  getIntents: () => request<PurchaseIntent[]>('/intents'),

  getIntent: (id: string) => request<PurchaseIntent>(`/intents/${id}`),

  // Plans
  getPlan: (id: string) => request<PurchasePlan>(`/plans/${id}`),

  selectAlternative: (planId: string, productId: string) =>
    request<PurchasePlan>(`/plans/${planId}/alternative`, {
      method: 'PATCH',
      body: JSON.stringify({ productId }),
    }),

  cancelPlan: (planId: string) =>
    request<PurchasePlan>(`/plans/${planId}/cancel`, {
      method: 'POST',
    }),

  // Policies
  getPolicy: () => request<PolicyResponse>('/policies/me'),

  updatePolicy: (data: {
    autonomyMode?: 'ASK_EVERY_TIME' | 'AUTO_WITHIN_LIMITS' | 'MANUAL_APPROVAL';
    maxTransactionAmount?: number | null;
    dailySpendingLimit?: number | null;
    monthlySpendingLimit?: number | null;
    requireApprovalAbove?: number | null;
    allowAutoExecute?: boolean;
    allowNegotiation?: boolean;
  }) =>
    request<UserPolicy>('/policies/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Approvals
  getPendingApprovals: () => request<Approval[]>('/approvals/pending'),

  submitDecision: (approvalId: string, decision: 'APPROVED' | 'REJECTED', note?: string) =>
    request<Approval>(`/approvals/${approvalId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, note }),
    }),

  // Payments
  createOrder: (planId: string) =>
    request<{ payment: Payment; orderId: string; approveUrl?: string }>('/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    }),

  capturePayment: (paymentId: string) =>
    request<{ payment: Payment; captureId: string; message: string }>(`/payments/${paymentId}/capture`, {
      method: 'POST',
    }),

  getPayment: (id: string) => request<Payment>(`/payments/${id}`),

  // Ledger
  getLedger: () => request<LedgerResponse>('/ledger'),
};
