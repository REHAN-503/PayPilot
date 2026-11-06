import { NotFoundException } from '@nestjs/common';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

describe('ProductsController', () => {
  let controller: ProductsController;
  let productsService: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    productsService = {
      findAll: vi.fn(),
      findOne: vi.fn(),
    };

    controller = new ProductsController(
      productsService as unknown as ProductsService,
    );
  });

  it('forwards product search and pagination filters', async () => {
    const expected = {
      data: [],
      pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
    };

    productsService.findAll.mockResolvedValue(expected);

    await expect(
      controller.findAll('  headphones  ', '  Electronics  ', '2', '10'),
    ).resolves.toEqual(expected);

    expect(productsService.findAll).toHaveBeenCalledWith({
      search: 'headphones',
      category: 'Electronics',
      page: 2,
      limit: 10,
    });
  });

  it('uses safe defaults for invalid pagination values', async () => {
    productsService.findAll.mockResolvedValue({ data: [], pagination: {} });

    await controller.findAll(undefined, undefined, '-1', '999');

    expect(productsService.findAll).toHaveBeenCalledWith({
      search: undefined,
      category: undefined,
      page: 1,
      limit: 50,
    });
  });

  it('returns a product by ID', async () => {
    const product = { id: 'product-1', name: 'Demo headphones' };
    productsService.findOne.mockResolvedValue(product);

    await expect(controller.findOne('product-1')).resolves.toEqual(product);
    expect(productsService.findOne).toHaveBeenCalledWith('product-1');
  });

  it('returns 404 when a product does not exist', async () => {
    productsService.findOne.mockResolvedValue(null);

    await expect(controller.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
