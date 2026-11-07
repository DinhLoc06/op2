import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Order } from './order.entity.js';

@Entity('order_status_histories')
export class OrderStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderId: number;

  @Column({ type: 'varchar', length: 30 })
  fromStatus: string;

  @Column({ type: 'varchar', length: 30 })
  toStatus: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @ManyToOne(() => Order, (order) => order.statusHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order: Relation<Order>;

  @CreateDateColumn()
  createdAt: Date;
}
