import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { User, UserRole } from '../users/entities/user.entity.js';
import { FindAuditLogsQueryDto } from './dto/find-audit-logs-query.dto.js';
import { AuditLogsService } from './audit-logs.service.js';

@Controller('audit-logs')
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  findAll(@CurrentUser() user: User, @Query() query: FindAuditLogsQueryDto) {
    return this.auditLogs.findAll(user, query);
  }
}
