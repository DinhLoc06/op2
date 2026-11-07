import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CouponUsage } from './entities/coupon-usage.entity.js';
import { Coupon } from './entities/coupon.entity.js';
import { Category } from '../categories/entities/category.entity.js';
import { CouponsController } from './coupons.controller.js';
import { CouponsService } from './coupons.service.js';
import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Coupon, CouponUsage, Category]),
    AuditLogsModule,
  ],
  controllers: [CouponsController],
  providers: [CouponsService],
})
export class CouponsModule {}
