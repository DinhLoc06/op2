import { PartialType } from '@nestjs/mapped-types';
import { CreateCouponDto } from './create-coupon.dto.js';

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}
