import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/entities/product.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import { Order } from './entities/order.entity.js';
import { Payment } from './entities/payment.entity.js';
import { OrderStatusHistory } from './entities/order-status-history.entity.js';
import { IdempotencyKey } from './entities/idempotency-key.entity.js';
import { Coupon } from '../coupons/entities/coupon.entity.js';
import { CouponUsage } from '../coupons/entities/coupon-usage.entity.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { StatisticsController } from './statistics.controller.js';
import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';
import { Address } from '../addresses/entities/address.entity.js';
import { User } from '../users/entities/user.entity.js';
import { AuditLog } from '../audit-logs/entities/audit-log.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Product,
      Payment,
      OrderStatusHistory,
      IdempotencyKey,
      Coupon,
      CouponUsage,
      Address,
      User,
      AuditLog,
    ]),
    AuditLogsModule,
  ],
  controllers: [OrdersController, StatisticsController],
  providers: [OrdersService],
})
export class OrdersModule {}
