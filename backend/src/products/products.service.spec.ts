import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Category } from '../categories/entities/category.entity.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { FindProductsQueryDto } from './dto/find-products-query.dto.js';
import { StockDto } from './dto/stock.dto.js';
import { Product } from './entities/product.entity.js';
import { ProductsService } from './products.service.js';

describe('ProductsService', () => {
  let service: ProductsService;

  const product = Object.assign(new Product(), {
    id: 1,
    name: 'Laptop Dell',
    price: 15000000,
    description: 'Laptop phục vụ học tập',
    categoryId: 1,
    category: Object.assign(new Category(), { id: 1, name: 'Laptop' }),
    quantity: 10,
    deletedAt: null,
  });
  const repository = {
    findAndCount: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    softDelete: vi.fn(),
    restore: vi.fn(),
  };
  const categoriesRepository = {
    findOne: vi.fn(),
  };
  const queryRunner = {
    connect: vi.fn(),
    startTransaction: vi.fn(),
    manager: {
      findOne: vi.fn(),
      save: vi.fn(),
    },
    commitTransaction: vi.fn(),
    rollbackTransaction: vi.fn(),
    release: vi.fn(),
  };
  const dataSource = {
    createQueryRunner: vi.fn(() => queryRunner),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    repository.findAndCount.mockResolvedValue([[product], 1]);
    repository.findOne.mockResolvedValue(product);
    repository.create.mockImplementation(
      (data?: Partial<Product>) => Object.assign(new Product(), data),
    );
    repository.save.mockImplementation(async (value: Product) => value);
    repository.softDelete.mockResolvedValue({ affected: 1 });
    repository.restore.mockResolvedValue({ affected: 1 });
    categoriesRepository.findOne.mockResolvedValue(product.category);
    queryRunner.manager.findOne.mockResolvedValue(product);
    queryRunner.manager.save.mockImplementation(async (value: Product) => value);
    queryRunner.commitTransaction.mockResolvedValue(undefined);
    queryRunner.rollbackTransaction.mockResolvedValue(undefined);
    queryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: repository,
        },
        {
          provide: getRepositoryToken(Category),
          useValue: categoriesRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('returns paginated products with default pagination and ordering', async () => {
    await expect(service.findAll({})).resolves.toEqual({
      data: [product],
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
    expect(repository.findAndCount).toHaveBeenCalledWith({
      where: {},
      relations: { category: true },
      order: { id: 'ASC' },
      skip: 0,
      take: 10,
    });
  });

  it('combines name, price range, sorting, and pagination filters', async () => {
    const query: FindProductsQueryDto = {
      page: 2,
      limit: 5,
      name: 'laptop',
      minPrice: 100,
      maxPrice: 200,
      sort: 'price',
      order: 'DESC',
    };

    await service.findAll(query);

    expect(repository.findAndCount).toHaveBeenCalledWith({
      where: {
        name: expect.anything(),
        price: expect.anything(),
      },
      relations: { category: true },
      order: { price: 'DESC' },
      skip: 5,
      take: 5,
    });
  });

  it('returns a product by id and reports missing products', async () => {
    await expect(service.findOne(1)).resolves.toBe(product);
    repository.findOne.mockResolvedValueOnce(null);
    await expect(service.findOne(2)).rejects.toThrow(NotFoundException);
  });

  it('creates and saves a product', async () => {
    const input: CreateProductDto = {
      name: product.name,
      price: product.price,
      description: product.description,
      categoryId: product.categoryId,
      quantity: product.quantity,
    };

    await expect(service.create(input)).resolves.toMatchObject(input);
    expect(repository.create).toHaveBeenCalledWith();
    expect(repository.save).toHaveBeenCalledOnce();
  });

  it('updates only supplied fields', async () => {
    const updatedProduct = Object.assign(new Product(), product);
    repository.findOne.mockResolvedValueOnce(updatedProduct);

    await expect(
      service.update(1, { price: 16000000, quantity: 5 }),
    ).resolves.toMatchObject({
      id: 1,
      name: 'Laptop Dell',
      price: 16000000,
      description: 'Laptop phục vụ học tập',
      categoryId: 1,
      category: product.category,
      quantity: 5,
    });
    expect(repository.save).toHaveBeenCalledWith(updatedProduct);
  });

  it('soft deletes an existing product', async () => {
    await expect(service.remove(1)).resolves.toBeUndefined();
    expect(repository.softDelete).toHaveBeenCalledWith(1);
  });

  it('restores a soft-deleted product', async () => {
    repository.findOne
      .mockResolvedValueOnce(Object.assign(new Product(), product, {
        deletedAt: new Date(),
      }))
      .mockResolvedValueOnce(product);

    await expect(service.restore(1)).resolves.toBe(product);
    expect(repository.restore).toHaveBeenCalledWith(1);
  });

  it('commits stock changes in a transaction', async () => {
    const stock: StockDto = { quantity: 3 };

    await expect(service.stockOut(1, stock)).resolves.toMatchObject({
      quantity: 7,
    });
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 7 }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalledOnce();
    expect(queryRunner.release).toHaveBeenCalledOnce();
  });

  it('rolls back a stock withdrawal when inventory is insufficient', async () => {
    queryRunner.manager.findOne.mockResolvedValueOnce(
      Object.assign(new Product(), product, { quantity: 2 }),
    );

    await expect(service.stockOut(1, { quantity: 3 })).rejects.toThrow(
      'Không đủ số lượng tồn kho để xuất',
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledOnce();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledOnce();
  });
});
