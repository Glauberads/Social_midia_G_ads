import { Controller, Get, UseGuards } from '@nestjs/common';
import { TenantScoped } from '../../auth/decorators/tenant-scoped.decorator';
import { CurrentTenant } from '../../auth/decorators/current-tenant.decorator';
import { TenantScope } from '../domain/tenant.types';
import { SupabaseAuthGuard } from '../../auth/guards/supabase-auth.guard';
import { TenantResolverGuard } from '../../auth/guards/tenant-resolver.guard';

@Controller('tenant-context')
@UseGuards(SupabaseAuthGuard, TenantResolverGuard)
export class TenantContextController {
  @Get()
  @TenantScoped()
  getTenantContext(@CurrentTenant() tenant: TenantScope) {
    return {
      tenantId: tenant.tenantId,
      membershipId: tenant.membershipId,
      role: tenant.role,
      requestId: tenant.requestId,
    };
  }
}
