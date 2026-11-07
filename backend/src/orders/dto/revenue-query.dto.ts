import { IsDateString, IsOptional } from 'class-validator';

export class RevenueQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
