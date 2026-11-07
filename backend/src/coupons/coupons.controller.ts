import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateCouponDto } from './dto/create-coupon.dto.js';
import { CouponsService } from './coupons.service.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { User, UserRole } from '../users/entities/user.entity.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { UpdateCouponDto } from './dto/update-coupon.dto.js';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  create(@CurrentUser() user: User, @Body() createCouponDto: CreateCouponDto) {
    return this.couponsService.create(createCouponDto, user.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.couponsService.update(id, dto, user.id);
  }

  @Get()
  findAll() {
    return this.couponsService.findAll();
  }
}
