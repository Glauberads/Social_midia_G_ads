import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { TenantScope } from '../../tenants/domain/tenant.types';

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): TenantScope => {
    const request = ctx.switchToHttp().getRequest();
    const scope = request.tenantScope as TenantScope;
    if (!scope) {
      throw new UnauthorizedException('TenantScope is not present on the request. Make sure TenantResolverGuard is applied.');
    }
    return scope;
  },
);
