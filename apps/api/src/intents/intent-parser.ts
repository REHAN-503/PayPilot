import { z } from 'zod';

export const ParsedIntentSchema = z.object({
  category: z.string().max(50).optional(),
  productQuery: z.string().min(1).max(200),
  minBudget: z.number().positive().max(100000).optional(),
  maxBudget: z.number().positive().max(100000).optional(),
  currency: z.literal('USD').default('USD'),
  keywords: z.array(z.string().max(50)).default([]),
  quantity: z.number().int().min(1).max(20).default(1),
  explanation: z.string().max(500),
});

export type ParsedIntent = z.infer<typeof ParsedIntentSchema>;

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'the', 'for', 'to', 'of', 'with', 'in',
  'on', 'me', 'my', 'i', 'need', 'want', 'find', 'buy',
  'get', 'looking', 'something', 'please', 'under', 'below',
  'less', 'than', 'up', 'within', 'budget', 'maximum', 'max',
  'minimum', 'at', 'least', 'above', 'over', 'dollars', 'usd',
]);

const CATEGORY_MAP: Array<[RegExp, string]> = [
  [/\b(headphones?|earbuds?|earphones?|audio|sound|monitor|screen|display|keyboard|mouse|power bank|charger|electronics?)\b/i, 'Electronics'],
  [/\b(usb[- ]?c? hub|adapter|cable|accessories?)\b/i, 'Accessories'],
  [/\b(bulb|lighting|purifier|air purifier|smart home|home)\b/i, 'Home'],
  [/\b(fitness|health|tracker|band|speaker|speakers|lifestyle)\b/i, 'Lifestyle'],
  [/\b(webcam|camera|mic|microphone|streaming|work|office)\b/i, 'Work'],
];

function sanitizePrompt(input: string): string {
  // Strip non-printable control characters and neutralize potential prompt injection instructions
  const printable = Array.from(input)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return (code >= 32 && code <= 126) || code > 159 || code === 10 || code === 13;
    })
    .join('');

  return printable
    .replace(/(?:system(?:\s+prompt)?|ignore\s+(?:all\s+)?previous\s+instructions?|override\s+policy)/gi, '')
    .trim();
}

function extractAmount(input: string, pattern: RegExp): number | undefined {
  const match = input.match(pattern);
  if (!match?.[1]) return undefined;
  const num = Number(match[1].replaceAll(',', ''));
  return Number.isFinite(num) && num > 0 && num <= 100000 ? num : undefined;
}

export function parseIntentDeterministic(rawInput: string): ParsedIntent {
  const clean = sanitizePrompt(rawInput);
  const normalized = clean.toLowerCase();

  const maxBudget =
    extractAmount(
      normalized,
      /(?:under|below|less than|up to|upto|within|max(?:imum)?(?: of)?|budget(?: of)?)\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i,
    ) ?? extractAmount(normalized, /\$\s*([\d,]+(?:\.\d{1,2})?)/);

  const minBudget = extractAmount(
    normalized,
    /(?:at least|above|over|min(?:imum)?(?: of)?)\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i,
  );

  const category = CATEGORY_MAP.find(([pattern]) => pattern.test(normalized))?.[1];

  const keywords = [
    ...new Set(
      normalized
        .replace(/\$?\d[\d,.]*/g, ' ')
        .replace(/[^a-z\s-]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
        .slice(0, 8),
    ),
  ];

  let explanation = `Interpreted goal: search catalog for ${category ? category.toLowerCase() : 'suitable'} items matching '${keywords.slice(0, 3).join(', ')}'`;
  if (maxBudget) {
    explanation += ` under budget of $${maxBudget.toFixed(2)}`;
  }
  explanation += '.';

  return ParsedIntentSchema.parse({
    category,
    productQuery: keywords.slice(0, 4).join(' ') || clean.slice(0, 50),
    minBudget,
    maxBudget,
    currency: 'USD',
    keywords,
    quantity: 1,
    explanation,
  });
}

export async function parseIntent(
  rawInput: string,
  options: { demoMode?: boolean; apiKey?: string } = {},
): Promise<ParsedIntent> {
  const { demoMode = true, apiKey } = options;

  // Rule 13: DEMO_MODE=true uses cached deterministic responses so demo works offline/without key
  if (demoMode || !apiKey) {
    return parseIntentDeterministic(rawInput);
  }

  // Attempt real LLM with Gemini if API key provided
  try {
    const prompt = `You are the intent extraction engine for PayPilot, a permissioned commerce agent.
Extract structured product purchase requirements from the user's natural language goal.
Return ONLY valid JSON matching this schema:
{
  "category": string (optional, one of "Electronics", "Accessories", "Home", "Lifestyle", "Work"),
  "productQuery": string (concise search terms),
  "minBudget": number (optional positive number),
  "maxBudget": number (optional positive number),
  "currency": "USD",
  "keywords": string[] (up to 6 core keywords),
  "quantity": number (default 1),
  "explanation": string (brief explanation of extracted intent)
}

User goal: "${sanitizePrompt(rawInput)}"`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
        }),
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!res.ok) {
      return parseIntentDeterministic(rawInput);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return parseIntentDeterministic(rawInput);
    }

    const parsedJson = JSON.parse(text) as unknown;
    return ParsedIntentSchema.parse({
      ...(typeof parsedJson === 'object' && parsedJson !== null ? parsedJson : {}),
      currency: 'USD',
    });
  } catch {
    // Graceful fallback to deterministic parsing on any network/API failure
    return parseIntentDeterministic(rawInput);
  }
}
