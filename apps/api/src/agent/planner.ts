import { z } from 'zod';
import { LlmService, type LlmCallMeta } from './llm/llm.service.js';
import { HallucinatedProductIdError } from './llm/llm-errors.js';
import type { ParsedIntent } from './intent-parser.js';
import { toCents, fromCents } from '../common/money.js';

export interface CandidateProduct {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  price: string | number | { toString(): string };
  description?: string | null;
  imageUrl?: string | null;
}

export const PlanRankingSchema = z.object({
  pickedProductId: z.string().optional(),
  pickedProductSku: z.string().optional(),
  alternatives: z
    .array(
      z.object({
        productId: z.string().optional(),
        productSku: z.string().optional(),
        reason: z.string(),
      }),
    )
    .default([]),
  reasoning: z.string().default('Candidate products evaluated based on intent constraints.'),
  tradeoffs: z.array(z.string()).default([]),
});

export type RawPlanRanking = z.infer<typeof PlanRankingSchema>;

export interface VerifiedPlanExecution {
  pickedProduct: CandidateProduct;
  alternatives: Array<{
    product: CandidateProduct;
    reason: string;
  }>;
  reasoning: string;
  tradeoffs: string[];
  unitPrice: number;
  quantity: number;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  llm: LlmCallMeta | null;
}

export const PLANNER_SYSTEM_PROMPT = `You are PayPilot's intelligent product planner and ranking engine.
Given the user's validated purchase intent and a candidate list of database-verified products, select:
1. One primary picked product that best optimizes user requirements and constraints.
2. Two alternative products with clear comparative trade-offs.

CRITICAL SECURITY AND ACCURACY RULES:
1. You may ONLY select products from the provided Candidate Products list.
2. NEVER hallucinate, invent, or output any productId or SKU not present in the candidate list. Any non-existent ID will be rejected by the server.
3. Financial totals and prices are strictly recomputed server-side from authoritative database rows. Do not attempt to calculate or adjust final pricing.
4. If candidate products exceed the user's requested budget, explain the over-budget trade-off in the "tradeoffs" array.`;

export function resolveAndVerifyProductId(
  idOrSku: string | undefined,
  candidates: CandidateProduct[],
): CandidateProduct {
  if (!idOrSku) {
    throw new HallucinatedProductIdError('LLM response did not specify a picked product ID or SKU');
  }

  const byId = candidates.find((c) => c.id === idOrSku);
  if (byId) return byId;

  const bySku = candidates.find((c) => c.sku.toLowerCase() === idOrSku.toLowerCase());
  if (bySku) return bySku;

  throw new HallucinatedProductIdError(
    `Product '${idOrSku}' does not exist in the candidate list. Hallucinated product IDs are rejected.`,
    idOrSku,
  );
}

export async function rankAndPlanWithLlm(
  llmService: LlmService,
  intent: ParsedIntent,
  candidates: CandidateProduct[],
  rawInput: string,
): Promise<VerifiedPlanExecution> {
  if (candidates.length === 0) {
    throw new Error('Cannot plan purchase: candidate products list is empty');
  }

  const candidateSummary = candidates.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    price: Number(p.price.toString()),
    description: p.description,
  }));

  const userPrompt = `User Request: "${rawInput}"
Parsed Intent: ${JSON.stringify(intent, null, 2)}

Candidate Products from Database:
${JSON.stringify(candidateSummary, null, 2)}

Select the primary product and 2 alternatives from the candidate products above.`;

  const llmResult = await llmService.generateJsonWithMeta(
    PlanRankingSchema,
    PLANNER_SYSTEM_PROMPT,
    userPrompt,
    'planRanking',
  );
  const ranking = llmResult.data;

  const targetIdOrSku = ranking.pickedProductId || ranking.pickedProductSku || candidates[0].id;
  const pickedProduct = resolveAndVerifyProductId(targetIdOrSku, candidates);

  const resolvedAlternatives: Array<{ product: CandidateProduct; reason: string }> = [];
  for (const alt of ranking.alternatives) {
    const altIdentifier = alt.productId || alt.productSku;
    if (!altIdentifier) continue;
    try {
      const altProd = resolveAndVerifyProductId(altIdentifier, candidates);
      if (altProd.id !== pickedProduct.id && !resolvedAlternatives.some((a) => a.product.id === altProd.id)) {
        resolvedAlternatives.push({ product: altProd, reason: alt.reason });
      }
    } catch {
      // skip hallucinated alternative
    }
  }

  if (resolvedAlternatives.length < 2) {
    for (const cand of candidates) {
      if (cand.id !== pickedProduct.id && !resolvedAlternatives.some((a) => a.product.id === cand.id)) {
        resolvedAlternatives.push({
          product: cand,
          reason: `Alternative catalog option in ${cand.category ?? 'catalog'}.`,
        });
      }
      if (resolvedAlternatives.length >= 2) break;
    }
  }

  const unitPriceCents = toCents(pickedProduct.price.toString());
  const quantity = intent.quantity > 0 ? intent.quantity : 1;
  const subtotalCents = unitPriceCents * quantity;
  const taxCents = 0;
  const shippingCents = 0;
  const discountCents = 0;
  const totalCents = subtotalCents + taxCents + shippingCents - discountCents;

  return {
    pickedProduct,
    alternatives: resolvedAlternatives,
    reasoning: ranking.reasoning,
    tradeoffs: ranking.tradeoffs,
    unitPrice: Number(fromCents(unitPriceCents)),
    quantity,
    subtotal: Number(fromCents(subtotalCents)),
    tax: Number(fromCents(taxCents)),
    shipping: Number(fromCents(shippingCents)),
    discount: Number(fromCents(discountCents)),
    total: Number(fromCents(totalCents)),
    llm: llmResult.meta,
  };
}

