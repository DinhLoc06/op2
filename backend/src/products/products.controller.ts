import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  ParseIntPipe,
  Post,
  Query,
  Put,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto.js';
import { FindProductsQueryDto } from './dto/find-products-query.dto.js';
import { StockDto } from './dto/stock.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductsService } from './products.service.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { Public } from '../auth/decorators/public.decorator.js';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  @Get()
  @Public()
  findAll(@Query() query: FindProductsQueryDto) {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      throw new BadRequestException('minPrice không được lớn hơn maxPrice');
    }

    return this.productsService.findAll(query);
  }

  @Get(':id')
  @Public()
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  async create(
    @CurrentUser() user: User,
    @Body() createProductDto: CreateProductDto,
  ) {
    const product = await this.productsService.create(createProductDto);
    await this.auditLogs.record(
      user.id,
      'PRODUCT_CREATED',
      'Product',
      product.id,
    );
    return product;
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService
      .update(id, updateProductDto)
      .then(async (product) => {
        await this.auditLogs.record(user.id, 'PRODUCT_UPDATED', 'Product', id);
        return product;
      });
  }

  @Patch(':id/restore')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  restore(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.productsService.restore(id).then(async (product) => {
      await this.auditLogs.record(user.id, 'PRODUCT_RESTORED', 'Product', id);
      return product;
    });
  }

  @Patch(':id/stock/in')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  stockIn(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() stockDto: StockDto,
  ) {
    return this.productsService.stockIn(id, stockDto).then(async (product) => {
      await this.auditLogs.record(user.id, 'PRODUCT_STOCK_IN', 'Product', id, {
        quantity: stockDto.quantity,
      });
      return product;
    });
  }

  @Patch(':id/stock/out')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  stockOut(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() stockDto: StockDto,
  ) {
    return this.productsService.stockOut(id, stockDto).then(async (product) => {
      await this.auditLogs.record(user.id, 'PRODUCT_STOCK_OUT', 'Product', id, {
        quantity: stockDto.quantity,
      });
      return product;
    });
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.productsService.remove(id);
    await this.auditLogs.record(user.id, 'DELETE_PRODUCT', 'Product', id);
    return { message: 'Đã xóa sản phẩm thành công' };
  }
}
