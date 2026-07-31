import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_ROLES_KEY } from '../decorators/require-roles.decorator';
import { Role } from '@projeto/database';
import { TenantScope } from '../../tenants/domain/tenant.types';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(REQUIRE_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // Se a rota não exige role específica, permite passagem (mas TenantResolver já barrou acessos base se for TenantScoped)
    }

    const request = context.switchToHttp().getRequest();
    const scope: TenantScope = request.tenantScope;

    if (!scope) {
      throw new ForbiddenException('TENANT_CONTEXT_REQUIRED');
    }

    if (!requiredRoles.includes(scope.role as Role)) {
      throw new ForbiddenException('MEMBERSHIP_ACCESS_DENIED');
    }

    return true;
  }
}
