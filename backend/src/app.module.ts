import { Module } from '@nestjs/common';
import 'pg';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from './products/products.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { CouponsModule } from './coupons/coupons.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AddressesModule } from './addresses/addresses.module.js';
import { UsersModule } from './users/users.module.js';
import { AuditLogsModule } from './audit-logs/audit-logs.module.js';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      ssl: { rejectUnauthorized: false },
    }),
    ProductsModule,
    CategoriesModule,
    OrdersModule,
    CouponsModule,
    AuditLogsModule,
    AuthModule,
    AddressesModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
