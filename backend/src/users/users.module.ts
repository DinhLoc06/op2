import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';
import { User } from './entities/user.entity.js';
import { RefreshToken } from '../auth/entities/refresh-token.entity.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, RefreshToken]), AuditLogsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
