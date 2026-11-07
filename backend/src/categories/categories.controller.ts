import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { CategoriesService } from './categories.service.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { Public } from '../auth/decorators/public.decorator.js';

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  @Get()
  @Public()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':id/products')
  @Public()
  findProducts(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findProducts(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  async create(
    @CurrentUser() user: User,
    @Body() createCategoryDto: CreateCategoryDto,
  ) {
    const category = await this.categoriesService.create(createCategoryDto);
    await this.auditLogs.record(
      user.id,
      'CATEGORY_CREATED',
      'Category',
      category.id,
    );
    return category;
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.categoriesService.remove(id);
    await this.auditLogs.record(user.id, 'CATEGORY_DELETED', 'Category', id);
    return { message: 'Đã xóa danh mục thành công' };
  }
}
