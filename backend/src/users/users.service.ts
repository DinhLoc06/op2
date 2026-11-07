import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { RefreshToken } from '../auth/entities/refresh-token.entity.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { User } from './entities/user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly audit: AuditLogsService,
  ) {}

  findAll() {
    return this.users.find({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number) {
    const user = await this.users.findOne({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    return user;
  }

  async update(
    id: number,
    actorId: number,
    dto: UpdateUserRoleDto | UpdateUserStatusDto,
  ) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    Object.assign(user, dto);
    const saved = await this.users.save(user);
    if ('isActive' in dto && dto.isActive === false) {
      await this.refreshTokens.update({ userId: id }, { revoked: true });
    }
    await this.audit.record(
      actorId,
      'role' in dto ? 'UPDATE_USER_ROLE' : 'USER_STATUS_UPDATED',
      'User',
      id,
      'role' in dto ? { role: dto.role } : { isActive: dto.isActive },
    );
    return {
      id: saved.id,
      email: saved.email,
      fullName: saved.fullName,
      role: saved.role,
      isActive: saved.isActive,
    };
  }

  async remove(id: number, actorId: number) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    await this.audit.record(actorId, 'DELETE_USER', 'User', id);
    await this.users.remove(user);
    return { message: 'Đã xóa tài khoản' };
  }
}
