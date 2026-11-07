import { Controller, Get, Query } from '@nestjs/common';
import { RevenueQueryDto } from './dto/revenue-query.dto.js';
import { OrdersService } from './orders.service.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';

@Controller('statistics')
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class StatisticsController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('revenue')
  getRevenue(@Query() query: RevenueQueryDto) {
    return this.ordersService.getRevenue(query);
  }
}
