import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  Column,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import type { Relation } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'varchar', length: 100 })
  entity: string;

  @Column({ type: 'varchar', length: 100 })
  entityId: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  metadata: string | null;

  @ManyToOne(() => User, (user) => user.auditLogs, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'userId' })
  user: Relation<User> | null;

  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
