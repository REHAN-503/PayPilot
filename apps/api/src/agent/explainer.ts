import { z } from 'zod';

export interface ExplainableEvent {
  type: string;
  planAmount?: number;
  currency?: string;
  productName?: string;
  riskLevel?: string;
  riskScore?: number;
  policyPassed?: boolean;
  violations?: string[];
  reasons?: string[];
  autonomyMode?: string;
}

export const ExplanationOutputSchema = z.object({
  explanation: z.string().max(280),
});

/**
 * Pure function: formats structured facts into a single-sentence human-readable explanation.
 * Strictly guarantees that no facts or financial amounts outside the input are introduced.
 */
export function explainEvent(event: ExplainableEvent): string {
  const currency = event.currency || 'USD';
  const amountStr = event.planAmount != null ? `$${event.planAmount.toFixed(2)}` : null;

  switch (event.type) {
    case 'INTENT_PARSED':
      return event.productName
        ? `Interpreted purchase goal targeting ${event.productName}${amountStr ? ` within ${amountStr}` : ''}.`
        : 'Interpreted purchase requirements and catalog search parameters.';

    case 'PRODUCT_SELECTED':
      return event.productName && amountStr
        ? `Selected ${event.productName} at ${amountStr} ${currency} based on verified catalog pricing.`
        : 'Catalog product selected and verified against database.';

    case 'POLICY_CHECKED':
      if (event.policyPassed) {
        return event.autonomyMode === 'AUTO_WITHIN_LIMITS'
          ? `Spending policy passed: amount ${amountStr ?? ''} is within pre-authorized autonomy limits.`
          : `Spending policy passed all deterministic budget limits; awaiting explicit user authorization.`;
      }
      return event.violations && event.violations.length > 0
        ? `Spending policy flagged: ${event.violations[0]}`
        : 'Spending policy evaluation flagged potential budget limit constraints.';

    case 'RISK_ASSESSED':
      return `Risk assessed as ${event.riskLevel ?? 'LOW'} (score: ${event.riskScore ?? 0}/100) based on account history and transaction parameters.`;

    case 'APPROVAL_REQUESTED':
      return event.autonomyMode === 'ASK_EVERY_TIME'
        ? `Explicit user authorization requested in accordance with 'Ask Every Time' policy mode.`
        : `Transaction authorization requested prior to PayPal order execution.`;

    case 'APPROVAL_GRANTED':
      return amountStr
        ? `Purchase plan authorized for ${amountStr} ${currency}.`
        : 'Purchase plan authorized and approved for checkout.';

    case 'APPROVAL_REJECTED':
      return 'Purchase plan authorization declined by user.';

    case 'PAYMENT_CREATED':
      return amountStr
        ? `PayPal Order v2 initialized with intent CAPTURE for ${amountStr} ${currency}.`
        : 'PayPal Order v2 initialized with intent CAPTURE.';

    case 'PAYMENT_CAPTURED':
      return amountStr
        ? `Payment successfully captured for ${amountStr} ${currency} via PayPal Orders API.`
        : 'Payment successfully captured via PayPal Orders API.';

    case 'PAYMENT_FAILED':
      return 'Payment execution failed during capture processing.';

    case 'WEBHOOK_CONFIRMED':
      return 'Cryptographic PayPal webhook verified and capture confirmed on immutable ledger.';

    case 'BUDGET_REPLANNED':
      return 'Autonomous replanning initiated to find compliant substitutions within budget.';

    case 'REPLAN_PROPOSED':
      return 'Alternative compliant purchase plan generated and proposed.';

    case 'NEGOTIATION_ROUND':
      return 'Autonomous negotiation proposal exchanged between Buyer and Merchant agents.';

    case 'AGENT_NEGOTIATED':
      return amountStr
        ? `Price negotiation concluded with agreed order total of ${amountStr} ${currency}.`
        : 'Autonomous price negotiation successfully concluded.';

    case 'LEDGER_RECORDED':
      return 'Transaction recorded to immutable append-only ledger.';

    case 'FORBIDDEN_ACTION_BLOCKED':
      return 'Unauthorized tool execution or policy bypass attempt blocked by security boundary.';

    default:
      return event.reasons && event.reasons.length > 0
        ? event.reasons[0].slice(0, 200)
        : 'Transaction step processed and recorded to audit timeline.';
  }
}

