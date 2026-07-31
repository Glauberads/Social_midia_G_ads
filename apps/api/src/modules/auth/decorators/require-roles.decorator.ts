import { SetMetadata } from '@nestjs/common';
import { Role } from '@projeto/database';

export const REQUIRE_ROLES_KEY = 'requireRoles';
export const RequireRoles = (...roles: Role[]) => SetMetadata(REQUIRE_ROLES_KEY, roles);
