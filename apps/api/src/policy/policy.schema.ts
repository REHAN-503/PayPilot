import { z } from 'zod';

export const updatePolicySchema = z.object({
  autonomyMode: z.enum(['MANUAL_APPROVAL', 'ASK_EVERY_TIME', 'AUTO_WITHIN_LIMITS']).optional(),
  currency: z.string().length(3).optional(),
  maxTransactionAmount: z.number().positive().nullable().optional(),
  dailySpendingLimit: z.number().positive().nullable().optional(),
  monthlySpendingLimit: z.number().positive().nullable().optional(),
  requireApprovalAbove: z.number().positive().nullable().optional(),
  allowAutoExecute: z.boolean().optional(),
  allowNegotiation: z.boolean().optional(),
  allowedCategories: z.array(z.string()).optional(),
  blockedCategories: z.array(z.string()).optional(),
  autoApproveCategories: z.array(z.string()).optional(),
});

