import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { CouponUsage } from '../coupons/entities/coupon-usage.entity.js';
import { Coupon, DiscountType } from '../coupons/entities/coupon.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { FindOrdersQueryDto } from './dto/find-orders-query.dto.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { RefundPaymentDto } from './dto/refund-payment.dto.js';
import { RevenueQueryDto } from './dto/revenue-query.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { IdempotencyKey } from './entities/idempotency-key.entity.js';
import { Order, OrderStatus } from './entities/order.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import { OrderStatusHistory } from './entities/order-status-history.entity.js';
import { Payment, PaymentStatus } from './entities/payment.entity.js';
import { Address } from '../addresses/entities/address.entity.js';
import { User, UserRole } from '../users/entities/user.entity.js';
import { AuditLog } from '../audit-logs/entities/audit-log.entity.js';

export interface OrderListResponse {
  data: Order[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    createOrderDto: CreateOrderDto,
    idempotencyKey: string | undefined,
    user: User,
  ): Promise<Order> {
    const productIds = createOrderDto.items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException(
        'Không được lặp lại sản phẩm trong cùng một đơn hàng',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (idempotencyKey) {
        const existingKey = await queryRunner.manager.findOne(IdempotencyKey, {
          where: { key: idempotencyKey },
          lock: { mode: 'pessimistic_write' },
        });
        if (existingKey) {
          const existingOrder = await queryRunner.manager.findOne(Order, {
            where: { id: existingKey.orderId },
            relations: { items: { product: true } },
          });
          if (!existingOrder) {
            throw new NotFoundException(
              'Đơn hàng của Idempotency-Key không tồn tại',
            );
          }
          if (existingOrder.userId !== user.id) {
            throw new ForbiddenException(
              'Idempotency-Key đã được dùng cho tài khoản khác',
            );
          }
          await queryRunner.commitTransaction();
          return existingOrder;
        }
      }
      const address = await queryRunner.manager.findOne(Address, {
        where: { id: createOrderDto.addressId, userId: user.id },
        lock: { mode: 'pessimistic_read' },
      });
      if (!address) {
        throw new NotFoundException(
          'Không tìm thấy địa chỉ giao hàng của tài khoản',
        );
      }
      const addressSnapshot = [
        address.receiverName,
        address.receiverPhone,
        address.addressLine,
        address.ward,
        address.district,
        address.province,
      ].join(', ');

      const items: OrderItem[] = [];
      let subtotal = 0;

      const sortedItems = [...createOrderDto.items].sort(
        (left, right) => left.productId - right.productId,
      );
      for (const requestedItem of sortedItems) {
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: requestedItem.productId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!product) {
          throw new NotFoundException(
            `Không tìm thấy sản phẩm có ID ${requestedItem.productId}`,
          );
        }
        if (product.quantity < requestedItem.quantity) {
          throw new BadRequestException(
            `Sản phẩm "${product.name}" không đủ tồn kho`,
          );
        }

        product.quantity -= requestedItem.quantity;
        await queryRunner.manager.save(product);

        const unitPrice = Number(product.price);
        subtotal += unitPrice * requestedItem.quantity;
        items.push(
          queryRunner.manager.create(OrderItem, {
            product,
            productId: product.id,
            quantity: requestedItem.quantity,
            unitPrice,
          }),
        );
      }

      let coupon: Coupon | null = null;
      let discountAmount = 0;
      if (createOrderDto.couponCode) {
        coupon = await queryRunner.manager.findOne(Coupon, {
          where: { code: createOrderDto.couponCode.trim().toUpperCase() },
          lock: { mode: 'pessimistic_write' },
        });
        if (!coupon) {
          throw new BadRequestException('Mã giảm giá không tồn tại');
        }
        const now = new Date();
        if (
          !coupon.isActive ||
          now < coupon.startAt ||
          now > coupon.endAt ||
          coupon.usedCount >= coupon.usageLimit ||
          subtotal < Number(coupon.minOrderValue)
        ) {
          throw new BadRequestException(
            'Mã giảm giá không hợp lệ, hết lượt hoặc chưa đạt giá trị đơn tối thiểu',
          );
        }
        const couponCategoryId = coupon.categoryId;
        if (
          couponCategoryId !== null &&
          !items.every((item) => item.product.categoryId === couponCategoryId)
        ) {
          throw new BadRequestException(
            'Mã giảm giá không áp dụng cho danh mục sản phẩm trong đơn',
          );
        }
        const previousUsage = await queryRunner.manager.findOne(CouponUsage, {
          where: {
            couponId: coupon.id,
            customerPhone: address.receiverPhone,
          },
        });
        if (previousUsage) {
          throw new BadRequestException(
            'Số điện thoại này đã sử dụng mã giảm giá',
          );
        }

        const discount =
          coupon.discountType === DiscountType.PERCENT
            ? (subtotal * Number(coupon.discountValue)) / 100
            : Number(coupon.discountValue);
        discountAmount = Math.min(Math.round(discount * 100) / 100, subtotal);
      }

      const shippingFee =
        subtotal < 500_000 ? 30_000 : subtotal < 1_000_000 ? 15_000 : 0;
      const grandTotal = Math.max(0, subtotal - discountAmount + shippingFee);
      const order = queryRunner.manager.create(Order, {
        customerName: address.receiverName,
        customerPhone: address.receiverPhone,
        shippingAddress: addressSnapshot,
        shippingAddressSnapshot: addressSnapshot,
        addressId: address.id,
        userId: user.id,
        status: OrderStatus.PENDING,
        subtotal,
        discountAmount,
        shippingFee,
        grandTotal,
        totalAmount: grandTotal,
        coupon,
        items,
      });
      const savedOrder = await queryRunner.manager.save(order);

      await queryRunner.manager.save(
        queryRunner.manager.create(OrderStatusHistory, {
          orderId: savedOrder.id,
          fromStatus: 'NEW',
          toStatus: OrderStatus.PENDING,
          note: 'Order created',
        }),
      );
      if (coupon) {
        coupon.usedCount += 1;
        await queryRunner.manager.save(coupon);
        await queryRunner.manager.save(
          queryRunner.manager.create(CouponUsage, {
            couponId: coupon.id,
            customerPhone: address.receiverPhone,
          }),
        );
      }
      if (idempotencyKey) {
        await queryRunner.manager.save(
          queryRunner.manager.create(IdempotencyKey, {
            key: idempotencyKey,
            orderId: savedOrder.id,
          }),
        );
      }
      await queryRunner.manager.save(
        queryRunner.manager.create(AuditLog, {
          userId: user.id,
          action: 'CREATE_ORDER',
          entity: 'Order',
          entityId: String(savedOrder.id),
        }),
      );

      await queryRunner.commitTransaction();
      return savedOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (idempotencyKey && this.isDuplicateKeyError(error)) {
        const existingKey = await this.dataSource
          .getRepository(IdempotencyKey)
          .findOne({ where: { key: idempotencyKey } });
        if (existingKey) {
          const existingOrder = await this.findOne(existingKey.orderId);
          if (existingOrder.userId !== user.id) {
            throw new ForbiddenException(
              'Idempotency-Key đã được dùng cho tài khoản khác',
            );
          }
          return existingOrder;
        }
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findMine(userId: number, query: FindOrdersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [data, total] = await this.ordersRepository.findAndCount({
      where: { userId },
      relations: { items: { product: true }, statusHistory: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async assertCanAccess(orderId: number, user: User): Promise<void> {
    if (user.role === UserRole.ADMIN || user.role === UserRole.STAFF) return;
    const order = await this.ordersRepository.findOne({
      where: { id: orderId, userId: user.id },
      select: { id: true },
    });
    if (!order) {
      throw new ForbiddenException('Bạn không có quyền truy cập đơn hàng này');
    }
  }

  async findAll(query: FindOrdersQueryDto): Promise<OrderListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: FindOptionsWhere<Order> = {};

    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await this.ordersRepository.findAndCount({
      where,
      relations: { items: { product: true }, coupon: true },
      order: { [query.sort ?? 'createdAt']: query.order ?? 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: {
        items: { product: { category: true } },
        coupon: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng có ID ${id}`);
    }

    return order;
  }

  async updateStatus(
    id: number,
    updateOrderStatusDto: UpdateOrderStatusDto,
  ): Promise<Order> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const order = await queryRunner.manager.findOne(Order, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        throw new NotFoundException(`Không tìm thấy đơn hàng có ID ${id}`);
      }
      const nextStatus = updateOrderStatusDto.status;
      const allowedTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
        [OrderStatus.PENDING]: [OrderStatus.CONFIRMED],
        [OrderStatus.CONFIRMED]: [OrderStatus.COMPLETED],
      };
      if (!allowedTransitions[order.status]?.includes(nextStatus)) {
        throw new BadRequestException(
          `Không thể chuyển đơn từ ${order.status} sang ${nextStatus}`,
        );
      }
      const previousStatus = order.status;
      order.status = nextStatus;
      await queryRunner.manager.save(order);
      await queryRunner.manager.save(
        queryRunner.manager.create(OrderStatusHistory, {
          orderId: id,
          fromStatus: previousStatus,
          toStatus: nextStatus,
        }),
      );
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
    return this.findOne(id);
  }

  async findHistory(id: number): Promise<OrderStatusHistory[]> {
    await this.findOne(id);
    return this.dataSource.getRepository(OrderStatusHistory).find({
      where: { orderId: id },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  async findPayment(id: number): Promise<Payment> {
    await this.findOne(id);
    const payment = await this.dataSource.getRepository(Payment).findOne({
      where: { orderId: id },
    });
    if (!payment) {
      throw new NotFoundException(`Đơn hàng ${id} chưa có thanh toán`);
    }
    return payment;
  }

  async pay(id: number, createPaymentDto: CreatePaymentDto): Promise<Payment> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const order = await queryRunner.manager.findOne(Order, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        throw new NotFoundException(`Không tìm thấy đơn hàng có ID ${id}`);
      }
      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Không thể thanh toán đơn đã hủy');
      }
      if (order.status === OrderStatus.COMPLETED) {
        throw new BadRequestException('Không thể thanh toán đơn đã hoàn thành');
      }
      const existingPayment = await queryRunner.manager.findOne(Payment, {
        where: { orderId: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (existingPayment?.status === PaymentStatus.PAID) {
        throw new ConflictException('Đơn hàng đã được thanh toán');
      }
      if (existingPayment) {
        throw new ConflictException('Đơn hàng đã có giao dịch thanh toán');
      }

      const previousStatus = order.status;
      const paymentAmount =
        order.grandTotal === 0 && order.totalAmount > 0
          ? order.totalAmount
          : order.grandTotal;
      const payment = queryRunner.manager.create(Payment, {
        order,
        orderId: id,
        method: createPaymentDto.method,
        status: PaymentStatus.PAID,
        amount: paymentAmount,
        transactionCode: randomUUID(),
      });
      const savedPayment = await queryRunner.manager.save(payment);
      order.status = OrderStatus.CONFIRMED;
      await queryRunner.manager.save(order);
      await queryRunner.manager.save(
        queryRunner.manager.create(OrderStatusHistory, {
          orderId: id,
          fromStatus: previousStatus,
          toStatus: OrderStatus.CONFIRMED,
          note: 'Payment completed',
        }),
      );
      await queryRunner.commitTransaction();
      return savedPayment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async refund(
    id: number,
    refundPaymentDto: RefundPaymentDto,
  ): Promise<Payment> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const order = await queryRunner.manager.findOne(Order, {
        where: { id },
        relations: { items: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        throw new NotFoundException(`Không tìm thấy đơn hàng có ID ${id}`);
      }
      if (order.status === OrderStatus.COMPLETED) {
        throw new ConflictException('Không thể hoàn tiền đơn đã hoàn thành');
      }
      if (order.status !== OrderStatus.CONFIRMED) {
        throw new BadRequestException(
          'Chỉ có thể hoàn tiền đơn đã xác nhận và đã thanh toán',
        );
      }
      const payment = await queryRunner.manager.findOne(Payment, {
        where: { orderId: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment || payment.status !== PaymentStatus.PAID) {
        throw new BadRequestException('Đơn hàng chưa được thanh toán');
      }

      for (const item of order.items) {
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: item.productId },
          withDeleted: true,
          lock: { mode: 'pessimistic_write' },
        });
        if (!product) {
          throw new NotFoundException(
            `Không tìm thấy sản phẩm có ID ${item.productId} để hoàn kho`,
          );
        }
        product.quantity += item.quantity;
        await queryRunner.manager.save(product);
      }

      payment.status = PaymentStatus.REFUNDED;
      order.status = OrderStatus.CANCELLED;
      await queryRunner.manager.save(payment);
      await queryRunner.manager.save(order);
      await queryRunner.manager.save(
        queryRunner.manager.create(OrderStatusHistory, {
          orderId: id,
          fromStatus: OrderStatus.CONFIRMED,
          toStatus: OrderStatus.CANCELLED,
          note: refundPaymentDto.reason ?? 'Payment refunded; stock restored',
        }),
      );
      await queryRunner.commitTransaction();
      return payment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cancel(id: number): Promise<Order> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await queryRunner.manager.findOne(Order, {
        where: { id },
        relations: { items: { product: true } },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException(`Không tìm thấy đơn hàng có ID ${id}`);
      }
      if (
        order.status !== OrderStatus.PENDING &&
        order.status !== OrderStatus.CONFIRMED
      ) {
        throw new ConflictException(
          `Không thể hủy đơn hàng ở trạng thái ${order.status}`,
        );
      }
      const payment = await queryRunner.manager.findOne(Payment, {
        where: { orderId: id, status: PaymentStatus.PAID },
      });
      if (payment) {
        throw new ConflictException(
          'Đơn đã thanh toán; hãy dùng API refund để hoàn tiền và tồn kho',
        );
      }

      for (const item of order.items) {
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: item.productId },
          withDeleted: true,
          lock: { mode: 'pessimistic_write' },
        });

        if (!product) {
          throw new NotFoundException(
            `Không tìm thấy sản phẩm có ID ${item.productId} để hoàn kho`,
          );
        }

        product.quantity += item.quantity;
        await queryRunner.manager.save(product);
      }

      const previousStatus = order.status;
      order.status = OrderStatus.CANCELLED;
      await queryRunner.manager.save(order);
      await queryRunner.manager.save(
        queryRunner.manager.create(OrderStatusHistory, {
          orderId: id,
          fromStatus: previousStatus,
          toStatus: OrderStatus.CANCELLED,
          note: 'Order cancelled; stock restored',
        }),
      );
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    return this.findOne(id);
  }

  async getRevenue(query: RevenueQueryDto) {
    if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
      throw new BadRequestException('from không được sau to');
    }

    const totalQuery = this.ordersRepository.createQueryBuilder('order');
    const completedQuery = this.ordersRepository
      .createQueryBuilder('order')
      .where('order.status = :status', { status: OrderStatus.COMPLETED });

    if (query.from) {
      const from = new Date(query.from);
      totalQuery.andWhere('order.createdAt >= :from', { from });
      completedQuery.andWhere('order.createdAt >= :from', { from });
    }
    if (query.to) {
      const to = new Date(query.to);
      if (/^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
        to.setHours(23, 59, 59, 999);
      }
      totalQuery.andWhere('order.createdAt <= :to', { to });
      completedQuery.andWhere('order.createdAt <= :to', { to });
    }

    const [totalOrders, completedOrders, result] = await Promise.all([
      totalQuery.getCount(),
      completedQuery.getCount(),
      completedQuery
        .clone()
        .select(
          'COALESCE(SUM(CASE WHEN order.grandTotal = 0 THEN order.totalAmount ELSE order.grandTotal END), 0)',
          'revenue',
        )
        .addSelect('COALESCE(SUM(order.discountAmount), 0)', 'discountAmount')
        .getRawOne<{
          revenue: string | number;
          discountAmount: string | number;
        }>(),
    ]);

    return {
      totalOrders,
      completedOrders,
      revenue: Number(result?.revenue ?? 0),
      discountAmount: Number(result?.discountAmount ?? 0),
    };
  }

  async getTopProducts(limit: number): Promise<
    Array<{
      productId: number;
      name: string;
      totalSold: number;
    }>
  > {
    const rows = await this.dataSource
      .getRepository(OrderItem)
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .innerJoin('item.product', 'product')
      .select('product.id', 'productId')
      .addSelect('product.name', 'name')
      .addSelect('SUM(item.quantity)', 'totalSold')
      .where('order.status = :status', { status: OrderStatus.COMPLETED })
      .groupBy('product.id')
      .addGroupBy('product.name')
      .orderBy('totalSold', 'DESC')
      .addOrderBy('product.id', 'ASC')
      .limit(limit)
      .getRawMany<{
        productId: number;
        name: string;
        totalSold: string | number;
      }>();

    return rows.map((row) => ({
      productId: Number(row.productId),
      name: row.name,
      totalSold: Number(row.totalSold),
    }));
  }

  private isDuplicateKeyError(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('driverError' in error)) {
      return false;
    }
    const driverError = error.driverError;
    return (
      typeof driverError === 'object' &&
      driverError !== null &&
      'code' in driverError &&
      driverError.code === 'ER_DUP_ENTRY'
    );
  }
}
