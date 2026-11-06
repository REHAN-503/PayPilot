import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

interface InterpretedIntent {
  category?: string;
  minBudget?: number;
  maxBudget?: number;
  keywords: string[];
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'the', 'for', 'to', 'of', 'with', 'in',
  'on', 'me', 'my', 'i', 'need', 'want', 'find', 'buy',
  'get', 'looking', 'something', 'please', 'under', 'below',
  'less', 'than', 'up', 'within', 'budget', 'maximum', 'max',
  'minimum', 'at', 'least', 'above', 'over', 'dollars', 'usd',
]);

function extractAmount(input: string, pattern: RegExp): number | undefined {
  const match = input.match(pattern);

  if (!match?.[1]) {
    return undefined;
  }

  const amount = Number(match[1].replaceAll(',', ''));

  return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000
    ? amount
    : undefined;
}

function interpretInput(input: string): InterpretedIntent {
  const normalized = input.toLowerCase();

  const maxBudget =
    extractAmount(
      normalized,
      /(?:under|below|less than|up to|upto|within|maximum|max(?:imum)?(?: of)?|budget(?: of)?)\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i,
    ) ??
    extractAmount(normalized, /\$\s*([\d,]+(?:\.\d{1,2})?)/);

  const minBudget = extractAmount(
    normalized,
    /(?:at least|above|over|minimum|min(?:imum)?(?: of)?)\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i,
  );

  const categoryRules: Array<[RegExp, string]> = [
    [/\b(headphones?|earbuds?|earphones?|monitor|keyboard|mouse|laptop|computer|electronics?)\b/i, 'Electronics'],
    [/\b(speaker|speakers|fitness|fitbit|wearable|lifestyle)\b/i, 'Lifestyle'],
    [/\b(bulb|lighting|air purifier|home|echo dot)\b/i, 'Home'],
    [/\b(accessories|usb hub|power bank|charger)\b/i, 'Accessories'],
    [/\b(webcam|microphone|work)\b/i, 'Work'],
  ];

  const category = categoryRules.find(([pattern]) => pattern.test(normalized))?.[1];

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

  return { category, minBudget, maxBudget, keywords };
}

@Injectable()
export class IntentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, rawInput: string) {
    const interpreted = interpretInput(rawInput);

    return this.prisma.$transaction(async (tx) => {
      const policy = await tx.userPolicy.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });

      const intent = await tx.purchaseIntent.create({
        data: {
          userId,
          rawInput,
          interpretedGoal: interpreted.category
            ? `Find a suitable ${interpreted.category.toLowerCase()} product`
            : "Find a suitable product matching the user's request",
          category: interpreted.category,
          minBudget: interpreted.minBudget ?? null,
          maxBudget: interpreted.maxBudget ?? null,
          currency: policy.currency,
          preferences: interpreted.keywords,
          constraints: {
            minBudget: interpreted.minBudget ?? null,
            maxBudget: interpreted.maxBudget ?? null,
          },
          status: 'PROCESSING',
        },
      });

      await tx.agentActivity.create({
        data: {
          userId,
          intentId: intent.id,
          type: 'INTENT_CREATED',
          title: 'Purchase request received',
          description: 'PayPilot saved your purchase request.',
        },
      });

      await tx.agentActivity.create({
        data: {
          userId,
          intentId: intent.id,
          type: 'INTENT_ANALYZED',
          title: 'Purchase intent interpreted',
          description: 'PayPilot extracted the category, budget and search terms.',
          metadata: {
            category: interpreted.category ?? null,
            keywords: interpreted.keywords,
            minBudget: interpreted.minBudget ?? null,
            maxBudget: interpreted.maxBudget ?? null,
          },
        },
      });

      const products = await tx.product.findMany({
        where: {
          status: 'ACTIVE',
          ...(interpreted.category
            ? {
                category: {
                  equals: interpreted.category,
                  mode: 'insensitive',
                },
              }
            : {}),
          ...(interpreted.keywords.length
            ? {
                OR: interpreted.keywords.flatMap((keyword) => [
                  { name: { contains: keyword, mode: 'insensitive' as const } },
                  { description: { contains: keyword, mode: 'insensitive' as const } },
                ]),
              }
            : {}),
        },
        take: 50,
      });

      await tx.agentActivity.create({
        data: {
          userId,
          intentId: intent.id,
          type: 'PRODUCT_SEARCHED',
          title: 'Product catalog searched',
          description: `PayPilot checked ${products.length} matching catalog products.`,
          metadata: { resultCount: products.length },
        },
      });

      const rankedProducts = products
        .map((product) => {
          const searchableText =
            `${product.name} ${product.description ?? ''} ${product.category}`.toLowerCase();

          const score = interpreted.keywords.reduce(
            (total, keyword) => total + (searchableText.includes(keyword) ? 1 : 0),
            0,
          );

          return { product, score };
        })
        .sort(
          (a, b) =>
            b.score - a.score ||
            Number(a.product.price) - Number(b.product.price),
        );

      const eligibleProducts = rankedProducts.filter(({ product }) => {
        const price = Number(product.price);

        return (
          (interpreted.minBudget === undefined || price >= interpreted.minBudget) &&
          (interpreted.maxBudget === undefined || price <= interpreted.maxBudget)
        );
      });

      const selected = eligibleProducts[0]?.product;
      let plan = null;

      if (selected) {
        plan = await tx.purchasePlan.create({
          data: {
            userId,
            intentId: intent.id,
            version: 1,
            status: 'READY',
            subtotal: selected.price,
            tax: 0,
            shipping: 0,
            discount: 0,
            total: selected.price,
            currency: selected.currency,
            explanation:
              'Selected from the active catalog using keyword relevance and the requested budget. Taxes and shipping are not included.',
            items: {
              create: {
                productId: selected.id,
                productName: selected.name,
                productSku: selected.sku,
                unitPrice: selected.price,
                quantity: 1,
                lineTotal: selected.price,
                currency: selected.currency,
              },
            },
          },
          include: { items: true },
        });

        await tx.agentActivity.create({
          data: {
            userId,
            intentId: intent.id,
            planId: plan.id,
            type: 'PRODUCT_SELECTED',
            title: 'Product selected',
            description: `${selected.name} was selected as the best catalog match.`,
            metadata: {
              productId: selected.id,
              price: selected.price.toString(),
              currency: selected.currency,
            },
          },
        });

        await tx.agentActivity.create({
          data: {
            userId,
            intentId: intent.id,
            planId: plan.id,
            type: 'PLAN_CREATED',
            title: 'Purchase plan created',
            description: 'A draft purchase plan is ready for review.',
          },
        });
      }

      const updatedIntent = await tx.purchaseIntent.update({
        where: { id: intent.id },
        data: { status: plan ? 'PLANNED' : 'DRAFT' },
      });

      return {
        intent: updatedIntent,
        plan,
        alternatives: rankedProducts
          .filter(({ product }) => product.id !== selected?.id)
          .slice(0, 4)
          .map(({ product }) => ({
            id: product.id,
            name: product.name,
            category: product.category,
            price: product.price,
            currency: product.currency,
            imageUrl: product.imageUrl,
          })),
        message: plan
          ? 'Your purchase intent has been analyzed and a plan is ready for review.'
          : 'Your intent was saved, but no catalog product matched all extracted constraints.',
      };
    });
  }

  async findAll(userId: string) {
    return this.prisma.purchaseIntent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        plans: {
          orderBy: { createdAt: 'desc' },
          include: { items: true },
        },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const intent = await this.prisma.purchaseIntent.findFirst({
      where: { id, userId },
      include: {
        plans: {
          orderBy: { createdAt: 'desc' },
          include: { items: true },
        },
        activities: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!intent) {
      throw new NotFoundException('Purchase intent not found');
    }

    return intent;
  }
}
