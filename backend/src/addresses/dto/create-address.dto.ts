import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  receiverName!: string;

  @IsString()
  @Matches(/^[0-9+()\-\s]{7,30}$/)
  receiverPhone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  addressLine!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  ward!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  district!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  province!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
