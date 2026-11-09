import { ForbiddenActionError } from '../llm/llm-errors.js';

export const ALLOWED_TOOLS = [
  'searchProducts',
  'compareProducts',
  'calculateBudget',
  'checkPolicy',
  'requestApproval',
  'getPaymentStatus',
] as const;

export type AllowedToolName = (typeof ALLOWED_TOOLS)[number];

export interface ToolDefinition {
  name: AllowedToolName;
  description: string;
  parameters: Record<string, unknown>;
  readOnly: boolean;
}

export const TOOL_REGISTRY: Record<AllowedToolName, ToolDefinition> = {
  searchProducts: {
    name: 'searchProducts',
    description: 'Search catalog products by query string, category, and budget parameters.',
    parameters: {
      query: 'string (optional)',
      category: 'string (optional)',
      maxBudget: 'number (optional)',
    },
    readOnly: true,
  },
  compareProducts: {
    name: 'compareProducts',
    description: 'Compare multiple product specifications, prices, and feature trade-offs.',
    parameters: {
      productIds: 'array of string (required)',
    },
    readOnly: true,
  },
  calculateBudget: {
    name: 'calculateBudget',
    description: 'Calculate subtotal, tax, and total based on verified unit prices and quantities.',
    parameters: {
      unitPrice: 'number (required)',
      quantity: 'number (required)',
    },
    readOnly: true,
  },
  checkPolicy: {
    name: 'checkPolicy',
    description: 'Simulate policy checks against per-transaction, daily, and monthly budget limits.',
    parameters: {
      amount: 'number (required)',
    },
    readOnly: true,
  },
  requestApproval: {
    name: 'requestApproval',
    description: 'Queue an approval request for explicit user review.',
    parameters: {
      planId: 'string (required)',
      reason: 'string (required)',
    },
    readOnly: false,
  },
  getPaymentStatus: {
    name: 'getPaymentStatus',
    description: 'Query the read-only settlement status of a payment order.',
    parameters: {
      paymentId: 'string (required)',
    },
    readOnly: true,
  },
};

export function isAllowedTool(toolName: string): toolName is AllowedToolName {
  return (ALLOWED_TOOLS as readonly string[]).includes(toolName);
}

export function validateToolCall(toolName: string): ToolDefinition {
  if (!isAllowedTool(toolName)) {
    throw new ForbiddenActionError(
      `Execution of tool '${toolName}' is forbidden. The AI agent only has access to allowed read-only planning tools. Payment execution tools are strictly isolated to backend services.`,
      toolName,
    );
  }
  return TOOL_REGISTRY[toolName];
}

