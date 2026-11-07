import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsPositive,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name!: string;

  @IsInt()
  @IsPositive()
  price!: number;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsInt()
  @IsPositive()
  categoryId!: number;

  @IsInt()
  @Min(0)
  quantity!: number;
}
