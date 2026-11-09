export interface PlanItem {
  id: string;
  planId: string;
  productId?: string | null;
  productName: string;
  productSku?: string | null;
  unitPrice: string | number;
  quantity: number;
  lineTotal: string | number;
  currency: string;
}

export interface RiskAssessment {
  id: string;
  planId: string;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;
  reasons: string[];
  recommendations?: string[];
  policyPassed: boolean;
  explanation?: string | null;
}

export interface Approval {
  id: string;
  userId: string;
  planId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'REVOKED';
  decisionNote?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  plan?: PurchasePlan;
}

export interface Payment {
  id: string;
  userId: string;
  planId: string;
  status: string;
  amount: string | number;
  currency: string;
  paypalOrderId?: string | null;
  paypalCaptureId?: string | null;
  paypalPayerId?: string | null;
  idempotencyKey: string;
}

export interface PurchasePlan {
  id: string;
  userId: string;
  intentId: string;
  version: number;
  status: string;
  subtotal: string | number;
  tax: string | number;
  shipping: string | number;
  discount: string | number;
  total: string | number;
  currency: string;
  explanation?: string | null;
  items: PlanItem[];
  riskAssessments?: RiskAssessment[];
  approvals?: Approval[];
  payments?: Payment[];
  intent?: PurchaseIntent;
}

export interface AgentActivity {
  id: string;
  userId: string;
  intentId?: string | null;
  planId?: string | null;
  paymentId?: string | null;
  type: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface PurchaseIntent {
  id: string;
  userId: string;
  rawInput: string;
  interpretedGoal?: string | null;
  category?: string | null;
  minBudget?: string | number | null;
  maxBudget?: string | number | null;
  currency: string;
  status: string;
  plans?: PurchasePlan[];
  activities?: AgentActivity[];
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description?: string | null;
  category?: string | null;
  price: string | number;
  currency: string;
  stock: number;
  imageUrl?: string | null;
}

export interface UserPolicy {
  id: string;
  userId: string;
  autonomyMode: 'ASK_EVERY_TIME' | 'AUTO_WITHIN_LIMITS' | 'MANUAL_APPROVAL';
  currency: string;
  maxTransactionAmount?: string | number | null;
  dailySpendingLimit?: string | number | null;
  monthlySpendingLimit?: string | number | null;
  requireApprovalAbove?: string | number | null;
  allowAutoExecute: boolean;
  allowNegotiation: boolean;
  agentPaused?: boolean;
  maxDiscountSeekPercent?: string | number | null;
}

export interface Transaction {
  id: string;
  userId: string;
  paymentId: string;
  type: string;
  amount: string | number;
  currency: string;
  externalReference?: string | null;
  idempotencyKey: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  payment?: Payment & { plan?: PurchasePlan };
}

export interface UserProfile {
  id: string;
  name?: string | null;
  email: string;
  image?: string | null;
}
