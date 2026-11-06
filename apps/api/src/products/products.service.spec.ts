import { ProductsService } from './products.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: {
    product: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    prisma = {
      product: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn((operations) => Promise.all(operations)),
    };

    service = new ProductsService(prisma as unknown as PrismaService);
  });

  it('returns active products with pagination metadata', async () => {
    const products = [{ id: 'product-1', name: 'Demo headphones' }];
    prisma.product.findMany.mockResolvedValue(products);
    prisma.product.count.mockResolvedValue(21);

    const result = await service.findAll({ page: 2, limit: 10 });

    expect(result).toEqual({
      data: products,
      pagination: {
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
      },
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE' },
        skip: 10,
        take: 10,
      }),
    );
    expect(prisma.product.count).toHaveBeenCalledWith({
      where: { status: 'ACTIVE' },
    });
  });

  it('applies case-insensitive search and category filters', async () => {
    await service.findAll({
      search: 'headphones',
      category: 'Electronics',
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'ACTIVE',
          category: { equals: 'Electronics', mode: 'insensitive' },
          OR: [
            { name: { contains: 'headphones', mode: 'insensitive' } },
            { description: { contains: 'headphones', mode: 'insensitive' } },
            { category: { contains: 'headphones', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });

  it('clamps pagination values to safe limits', async () => {
    await service.findAll({ page: 0, limit: 100 });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 50,
      }),
    );
  });

  it('returns only an active product by ID', async () => {
    const product = { id: 'product-1', name: 'Demo headphones' };
    prisma.product.findFirst.mockResolvedValue(product);

    await expect(service.findOne('product-1')).resolves.toEqual(product);

    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'product-1',
        status: 'ACTIVE',
      },
    });
  });
});
