import {
  CreateDateColumn,
  Entity,
  Column,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Address } from '../../addresses/entities/address.entity.js';
import { Order } from '../../orders/entities/order.entity.js';
import { RefreshToken } from '../../auth/entities/refresh-token.entity.js';
import { AuditLog } from '../../audit-logs/entities/audit-log.entity.js';
import type { Relation } from 'typeorm';

export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  CUSTOMER = 'CUSTOMER',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 120, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 100 })
  fullName: string;

  @Column({ select: false })
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  tokenVersion: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Address, (address) => address.user)
  addresses: Relation<Address[]>;

  @OneToMany(() => Order, (order) => order.user)
  orders: Relation<Order[]>;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: Relation<RefreshToken[]>;

  @OneToMany(() => AuditLog, (log) => log.user)
  auditLogs: Relation<AuditLog[]>;
}
