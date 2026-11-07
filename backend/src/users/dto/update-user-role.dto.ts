import { IsEnum } from 'class-validator';
import { UserRole } from '../entities/user.entity.js';

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}
