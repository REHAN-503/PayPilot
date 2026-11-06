import { z } from 'zod';

export const createIntentSchema = z.object({
  rawInput: z.string().trim().min(5).max(1000),
});

export type CreateIntentInput = z.infer<typeof createIntentSchema>;
