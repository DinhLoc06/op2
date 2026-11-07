import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity.js';
import { FindAuditLogsQueryDto } from './dto/find-audit-logs-query.dto.js';
import { AuditLog } from './entities/audit-log.entity.js';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly logs: Repository<AuditLog>,
  ) {}

  async record(
    userId: number | null,
    action: string,
    entity: string,
    entityId: number | string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.logs.save(
      this.logs.create({
        userId,
        action,
        entity,
        entityId: String(entityId),
        metadata: metadata ? JSON.stringify(metadata) : null,
      }),
    );
  }

  findAll(actor: User, query: FindAuditLogsQueryDto): Promise<AuditLog[]> {
    const where: FindOptionsWhere<AuditLog> = {};
    if (actor.role === UserRole.ADMIN) {
      if (query.userId !== undefined) where.userId = query.userId;
    } else {
      where.userId = actor.id;
    }
    if (query.action) where.action = query.action;
    if (query.entity) where.entity = query.entity;
    return this.logs.find({
      where,
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }
}
