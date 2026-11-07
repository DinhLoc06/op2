import { IsEnum } from 'class-validator';
import { PaymentMethod } from '../entities/payment.entity.js';

export class CreatePaymentDto {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}
