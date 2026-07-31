import { IsEnum } from 'class-validator';
import { Role } from '@projeto/database';

export class ChangeRoleDto {
  @IsEnum(Role)
  role!: Role;
}
