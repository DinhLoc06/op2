import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';
import { Product } from './entities/product.entity.js';
import { Category } from '../categories/entities/category.entity.js';
import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Category]), AuditLogsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
