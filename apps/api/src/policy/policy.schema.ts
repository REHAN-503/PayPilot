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
  negotiationMaxRounds: z.number().int().min(1).max(10).optional(),
  agentPaused: z.boolean().optional(),
  maxDiscountSeekPercent: z.number().min(0).max(50).nullable().optional(),
  allowedCategories: z.array(z.string()).optional(),
  blockedCategories: z.array(z.string()).optional(),
  autoApproveCategories: z.array(z.string()).optional(),
});

export const policySimulationSchema = z.object({
  category: z.string().min(1).max(100),
  amount: z.number().positive(),
  merchant: z.string().min(1).max(200),
});
