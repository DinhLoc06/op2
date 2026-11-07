import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Coupon } from './coupon.entity.js';

@Entity('coupon_usages')
@Unique(['couponId', 'customerPhone'])
export class CouponUsage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  couponId: number;

  @Column({ type: 'varchar', length: 20 })
  customerPhone: string;

  @ManyToOne(() => Coupon, (coupon) => coupon.usages, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'couponId' })
  coupon: Relation<Coupon>;
}
