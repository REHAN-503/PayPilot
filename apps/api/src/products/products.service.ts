
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

interface FindProductsOptions {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(options: FindProductsOptions = {}) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(50, Math.max(1, options.limit ?? 12));
    const skip = (page - 1) * limit;

    const where = {
      status: 'ACTIVE' as const,
      ...(options.category
        ? { category: { equals: options.category, mode: 'insensitive' as const } }
        : {}),
      ...(options.search
        ? {
            OR: [
              { name: { contains: options.search, mode: 'insensitive' as const } },
              { description: { contains: options.search, mode: 'insensitive' as const } },
              { category: { contains: options.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    return this.prisma.product.findFirst({
      where: {
        id,
        status: 'ACTIVE',
      },
    });
  }
}
