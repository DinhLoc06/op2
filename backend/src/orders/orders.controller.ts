import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { User, UserRole } from '../users/entities/user.entity.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { FindOrdersQueryDto } from './dto/find-orders-query.dto.js';
import { RefundPaymentDto } from './dto/refund-payment.dto.js';
import { RevenueQueryDto } from './dto/revenue-query.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: User,
    @Body() createOrderDto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const normalizedKey = idempotencyKey?.trim();
    if (normalizedKey && normalizedKey.length > 100) {
      throw new BadRequestException('Idempotency-Key không được quá 100 ký tự');
    }
    return this.ordersService.create(
      createOrderDto,
      normalizedKey || undefined,
      user,
    );
  }

  @Get('my')
  findMine(@CurrentUser() user: User, @Query() query: FindOrdersQueryDto) {
    return this.ordersService.findMine(user.id, query);
  }

  @Get('statistics/revenue')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  getRevenue(@Query() query: RevenueQueryDto) {
    return this.ordersService.getRevenue(query);
  }

  @Get('statistics/top-products')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  getTopProducts(
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 5,
  ) {
    if (limit < 1 || limit > 100) {
      throw new BadRequestException('limit phải nằm trong khoảng 1 đến 100');
    }
    return this.ordersService.getTopProducts(limit);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  findAll(@Query() query: FindOrdersQueryDto) {
    return this.ordersService.findAll(query);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.ordersService.assertCanAccess(id, user);
    return this.ordersService.findOne(id);
  }

  @Get(':id/history')
  async findHistory(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.ordersService.assertCanAccess(id, user);
    return this.ordersService.findHistory(id);
  }

  @Post(':id/payments')
  pay(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    return this.ordersService.assertCanAccess(id, user).then(() =>
      this.ordersService.pay(id, createPaymentDto).then(async (payment) => {
        await this.auditLogs.record(
          user.id,
          'CREATE_PAYMENT',
          'Payment',
          payment.id,
        );
        return payment;
      }),
    );
  }

  @Get(':id/payments')
  async findPayment(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.ordersService.assertCanAccess(id, user);
    return this.ordersService.findPayment(id);
  }

  @Post(':id/refund')
  refund(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() refundPaymentDto: RefundPaymentDto,
  ) {
    return this.ordersService
      .refund(id, refundPaymentDto)
      .then(async (payment) => {
        await this.auditLogs.record(
          user.id,
          'REFUND_PAYMENT',
          'Payment',
          payment.id,
        );
        return payment;
      });
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  updateStatus(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService
      .updateStatus(id, updateOrderStatusDto)
      .then(async (order) => {
        await this.auditLogs.record(
          user.id,
          'UPDATE_ORDER_STATUS',
          'Order',
          id,
          {
            status: order.status,
          },
        );
        return order;
      });
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.ordersService.assertCanAccess(id, user).then(() =>
      this.ordersService.cancel(id).then(async (order) => {
        await this.auditLogs.record(user.id, 'CANCEL_ORDER', 'Order', id);
        return order;
      }),
    );
  }
}
