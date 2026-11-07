import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { User, UserRole } from '../users/entities/user.entity.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.users.exists({ where: { email } })) {
      throw new ConflictException('Email đã được sử dụng');
    }
    const user = this.users.create({
      email,
      fullName: dto.fullName.trim(),
      password: await hash(dto.password, 12),
      role: UserRole.CUSTOMER,
    });
    let saved: User;
    try {
      saved = await this.users.save(user);
    } catch (error) {
      if (this.isDuplicateEmailError(error)) {
        throw new ConflictException('Email đã được sử dụng');
      }
      throw error;
    }
    await this.auditLogs.record(saved.id, 'REGISTER', 'User', saved.id);
    return this.safeUser(saved);
  }

  async login(emailInput: string, password: string) {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: emailInput.trim().toLowerCase() })
      .getOne();
    if (!user?.isActive) {
      await this.auditLogs.record(
        user?.id ?? null,
        'LOGIN_FAILED',
        'User',
        emailInput.trim().toLowerCase(),
      );
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }
    if (!(await compare(password, user.password))) {
      await this.auditLogs.record(user.id, 'LOGIN_FAILED', 'User', user.id);
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }
    const tokens = await this.issueTokens(user);
    await this.auditLogs.record(user.id, 'LOGIN_SUCCESS', 'User', user.id);
    return { ...tokens, user: this.safeUser(user) };
  }

  async refresh(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.refreshTokens.findOne({
      where: { tokenHash, revoked: false },
      relations: { user: true },
    });
    if (!stored || stored.expiresAt <= new Date() || !stored.user.isActive) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }
    const revoked = await this.refreshTokens.update(
      { id: stored.id, revoked: false },
      { revoked: true },
    );
    if (!revoked.affected) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã bị thu hồi',
      );
    }
    return this.issueTokens(stored.user);
  }

  async logout(rawToken: string, userId: number) {
    const stored = await this.refreshTokens.findOne({
      where: { tokenHash: this.hashToken(rawToken), userId, revoked: false },
    });
    if (stored) {
      stored.revoked = true;
      await this.refreshTokens.save(stored);
    }
    await this.auditLogs.record(userId, 'LOGOUT', 'User', userId);
    return { message: 'Đã đăng xuất' };
  }

  async changePassword(
    user: User,
    currentPassword: string,
    newPassword: string,
  ) {
    const account = await this.users
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: user.id })
      .getOneOrFail();
    if (!(await compare(currentPassword, account.password))) {
      throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');
    }
    account.password = await hash(newPassword, 12);
    account.tokenVersion += 1;
    await this.users.save(account);
    await this.refreshTokens.update({ userId: user.id }, { revoked: true });
    await this.auditLogs.record(user.id, 'PASSWORD_CHANGED', 'User', user.id);
    return { message: 'Đổi mật khẩu thành công; vui lòng đăng nhập lại' };
  }

  private async issueTokens(user: User) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });
    const refreshToken = randomBytes(48).toString('base64url');
    await this.refreshTokens.save(
      this.refreshTokens.create({
        tokenHash: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
    );
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: 900 };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private isDuplicateEmailError(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('driverError' in error)) {
      return false;
    }
    const driverError = error.driverError;
    return (
      typeof driverError === 'object' &&
      driverError !== null &&
      'code' in driverError &&
      driverError.code === 'ER_DUP_ENTRY'
    );
  }

  private safeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
