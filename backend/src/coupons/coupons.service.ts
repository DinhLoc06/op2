import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../categories/entities/category.entity.js';
import { CreateCouponDto } from './dto/create-coupon.dto.js';
import { UpdateCouponDto } from './dto/update-coupon.dto.js';
import { Coupon } from './entities/coupon.entity.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponsRepository: Repository<Coupon>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    private readonly auditLogs: AuditLogsService,
  ) {}

  findAll(): Promise<Coupon[]> {
    return this.couponsRepository.find({ order: { id: 'ASC' } });
  }

  async create(
    createCouponDto: CreateCouponDto,
    actorId: number,
  ): Promise<Coupon> {
    const { categoryId, ...couponData } = createCouponDto;
    let category: Category | null = null;
    if (categoryId !== undefined) {
      category = await this.categoriesRepository.findOne({
        where: { id: categoryId },
      });
      if (!category) {
        throw new NotFoundException(
          `Không tìm thấy danh mục có ID ${categoryId}`,
        );
      }
    }

    if (new Date(createCouponDto.endAt) <= new Date(createCouponDto.startAt)) {
      throw new BadRequestException('endAt phải sau startAt');
    }
    if (
      createCouponDto.discountType === 'PERCENT' &&
      createCouponDto.discountValue > 100
    ) {
      throw new BadRequestException('Coupon phần trăm không được vượt quá 100');
    }

    const coupon = this.couponsRepository.create({
      ...couponData,
      category,
      code: createCouponDto.code.trim().toUpperCase(),
      startAt: new Date(createCouponDto.startAt),
      endAt: new Date(createCouponDto.endAt),
    });

    try {
      const saved = await this.couponsRepository.save(coupon);
      await this.auditLogs.record(actorId, 'CREATE_COUPON', 'Coupon', saved.id);
      return saved;
    } catch (error) {
      if (this.isDuplicateCodeError(error)) {
        throw new ConflictException('Mã coupon đã tồn tại');
      }
      throw error;
    }
  }

  async update(
    id: number,
    dto: UpdateCouponDto,
    actorId: number,
  ): Promise<Coupon> {
    const coupon = await this.couponsRepository.findOne({ where: { id } });
    if (!coupon)
      throw new NotFoundException(`Không tìm thấy coupon có ID ${id}`);
    const { categoryId, ...fields } = dto;
    if (categoryId !== undefined) {
      const category = await this.categoriesRepository.findOne({
        where: { id: categoryId },
      });
      if (!category)
        throw new NotFoundException(
          `Không tìm thấy danh mục có ID ${categoryId}`,
        );
      coupon.category = category;
      coupon.categoryId = category.id;
    }
    Object.assign(coupon, fields);
    if (dto.code !== undefined) coupon.code = dto.code.trim().toUpperCase();
    if (
      coupon.startAt &&
      coupon.endAt &&
      new Date(coupon.endAt) <= new Date(coupon.startAt)
    ) {
      throw new BadRequestException('endAt phải sau startAt');
    }
    if (coupon.discountType === 'PERCENT' && coupon.discountValue > 100) {
      throw new BadRequestException('Coupon phần trăm không được vượt quá 100');
    }
    try {
      const saved = await this.couponsRepository.save(coupon);
      await this.auditLogs.record(actorId, 'UPDATE_COUPON', 'Coupon', id);
      return saved;
    } catch (error) {
      if (this.isDuplicateCodeError(error)) {
        throw new ConflictException('Mã coupon đã tồn tại');
      }
      throw error;
    }
  }

  private isDuplicateCodeError(error: unknown): boolean {
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
