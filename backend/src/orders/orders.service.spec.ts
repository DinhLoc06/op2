import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Product } from '../products/entities/product.entity.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { IdempotencyKey } from './entities/idempotency-key.entity.js';
import { Order, OrderStatus } from './entities/order.entity.js';
import { OrdersService } from './orders.service.js';
import { User, UserRole } from '../users/entities/user.entity.js';

describe('OrdersService', () => {
  let service: OrdersService;

  const firstProduct = Object.assign(new Product(), {
    id: 1,
    name: 'Laptop',
    price: 1000,
    quantity: 5,
  });
  const secondProduct = Object.assign(new Product(), {
    id: 2,
    name: 'Mouse',
    price: 250,
    quantity: 4,
  });
  const shippingAddress = {
    id: 12,
    receiverName: 'Nguyen Van A',
    receiverPhone: '0901234567',
    addressLine: '12 Le Loi',
    ward: 'Hai Chau 1',
    district: 'Hai Chau',
    province: 'Da Nang',
  };
  const testUser = Object.assign(new User(), {
    id: 7,
    role: UserRole.CUSTOMER,
  });
  const queryRunner = {
    connect: vi.fn(),
    startTransaction: vi.fn(),
    manager: {
      findOne: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
    },
    commitTransaction: vi.fn(),
    rollbackTransaction: vi.fn(),
    release: vi.fn(),
  };
  const ordersRepository = {
    findAndCount: vi.fn(),
    findOne: vi.fn(),
    save: vi.fn(),
    count: vi.fn(),
  };
  const dataSource = {
    createQueryRunner: vi.fn(() => queryRunner),
  };

  const createOrderDto: CreateOrderDto = {
    addressId: shippingAddress.id,
    customerName: 'Nguyen Van A',
    customerPhone: '0901234567',
    shippingAddress: 'Da Nang',
    items: [
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 },
    ],
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    queryRunner.manager.findOne
      .mockResolvedValueOnce(shippingAddress)
      .mockResolvedValueOnce(firstProduct)
      .mockResolvedValueOnce(secondProduct);
    queryRunner.manager.save.mockImplementation(
      async (value: Product | Order) => value,
    );
    queryRunner.manager.create.mockImplementation(
      (_entity: typeof Order | Function, data: Partial<Order>) => data,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: ordersRepository,
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('creates an order, snapshots unit prices, and deducts stock in one transaction', async () => {
    const result = await service.create(createOrderDto, undefined, testUser);

    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, quantity: 3 }),
    );
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, quantity: 3 }),
    );
    expect(queryRunner.manager.create).toHaveBeenNthCalledWith(
      3,
      Order,
      expect.objectContaining({
        status: OrderStatus.PENDING,
        userId: testUser.id,
        addressId: shippingAddress.id,
        shippingAddressSnapshot:
          'Nguyen Van A, 0901234567, 12 Le Loi, Hai Chau 1, Hai Chau, Da Nang',
        subtotal: 2250,
        discountAmount: 0,
        shippingFee: 30000,
        grandTotal: 32250,
        totalAmount: 32250,
      }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalledOnce();
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      status: OrderStatus.PENDING,
      subtotal: 2250,
      grandTotal: 32250,
    });
  });

  it('rolls back the whole order when a later product has insufficient stock', async () => {
    queryRunner.manager.findOne
      .mockReset()
      .mockResolvedValueOnce(shippingAddress)
      .mockResolvedValueOnce(firstProduct)
      .mockResolvedValueOnce(
        Object.assign(new Product(), secondProduct, { quantity: 0 }),
      );

    await expect(
      service.create(createOrderDto, undefined, testUser),
    ).rejects.toThrow(BadRequestException);
    expect(queryRunner.manager.save).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledOnce();
    expect(queryRunner.release).toHaveBeenCalledOnce();
  });

  it('rejects duplicate products before opening a transaction', async () => {
    await expect(
      service.create({
        addressId: shippingAddress.id,
        customerName: createOrderDto.customerName,
        customerPhone: createOrderDto.customerPhone,
        shippingAddress: createOrderDto.shippingAddress,
        items: [
          { productId: 1, quantity: 1 },
          { productId: 1, quantity: 2 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('returns the existing order when an idempotency key is replayed', async () => {
    const existingOrder = Object.assign(new Order(), {
      id: 45,
      status: OrderStatus.PENDING,
      userId: testUser.id,
    });
    queryRunner.manager.findOne.mockReset();
    queryRunner.manager.findOne.mockImplementation(async (entity: Function) => {
      if (entity === IdempotencyKey) {
        return Object.assign(new IdempotencyKey(), {
          key: 'retry-key',
          orderId: existingOrder.id,
        });
      }
      if (entity === Order) {
        return existingOrder;
      }
      return null;
    });

    await expect(
      service.create(createOrderDto, 'retry-key', testUser),
    ).resolves.toBe(existingOrder);
    expect(queryRunner.manager.save).not.toHaveBeenCalled();
    expect(queryRunner.commitTransaction).toHaveBeenCalledOnce();
  });

});
