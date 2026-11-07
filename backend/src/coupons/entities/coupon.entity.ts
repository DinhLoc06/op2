import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { CouponUsage } from './coupon-usage.entity.js';
import { Category } from '../../categories/entities/category.entity.js';

export enum DiscountType {
  PERCENT = 'PERCENT',
  FIXED = 'FIXED',
}

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'enum', enum: DiscountType })
  discountType: DiscountType;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  discountValue: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  minOrderValue: number;

  @Column({ type: 'int', default: 0 })
  usageLimit: number;

  @Column({ type: 'int', default: 0 })
  usedCount: number;

  @Column({ type: 'timestamptz' })
  startAt: Date;

  @Column({ type: 'timestamptz' })
  endAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', nullable: true })
  categoryId: number | null;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category: Category | null;

  @OneToMany(() => CouponUsage, (usage) => usage.coupon)
  usages: Relation<CouponUsage[]>;

  @CreateDateColumn()
  createdAt: Date;
}
