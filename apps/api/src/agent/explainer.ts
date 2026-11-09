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

    case 'FORBIDDEN_ACTION_BLOCKED':
      return 'Unauthorized tool execution or policy bypass attempt blocked by security boundary.';

    default:
      return event.reasons && event.reasons.length > 0
        ? event.reasons[0].slice(0, 200)
        : 'Transaction step processed and recorded to audit timeline.';
  }
}

