import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  IsOptional,
  Matches,
  MaxLength,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateOrderItemDto } from './create-order-item.dto.js';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(100)
  customerName?: string;

  @IsString()
  @Matches(/^[0-9+()\-\s]{7,20}$/)
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  shippingAddress?: string;

  @IsInt()
  @Min(1)
  addressId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  couponCode?: string;
}
