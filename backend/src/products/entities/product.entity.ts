import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  DeleteDateColumn,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity.js';

@Entity('products')
export class Product {

  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    length: 255
  })
  name: string;

  @Column({
    type: 'int'
  })
  price: number;

  @Column({
    type: 'text',
    nullable: true
  })
  description: string | null;

  @Column({ type: 'int', nullable: true })
  categoryId: number | null;

  @ManyToOne(() => Category, (category) => category.products, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'categoryId' })
  category: Category | null;

  @Column({
    type: 'int',
    default: 0,
  })
  quantity: number;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}