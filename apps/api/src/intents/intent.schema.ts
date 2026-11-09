import { z } from 'zod';

export const createIntentSchema = z.object({
  rawInput: z.string().trim().min(5).max(500),
});

export type CreateIntentInput = z.infer<typeof createIntentSchema>;
