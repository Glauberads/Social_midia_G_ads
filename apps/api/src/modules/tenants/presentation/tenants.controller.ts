import { Controller, Post, Get, Body, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateTenantUseCase } from '../application/use-cases/create-tenant.use-case';
import { ListUserTenantsUseCase } from '../application/use-cases/list-user-tenants.use-case';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedIdentity } from '../../auth/services/access-token-verifier.interface';
import { TenantScoped } from '../../auth/decorators/tenant-scoped.decorator';
import { CurrentTenant } from '../../auth/decorators/current-tenant.decorator';
import { TenantScope } from '../domain/tenant.types';

@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly createTenantUseCase: CreateTenantUseCase,
    private readonly listUserTenantsUseCase: ListUserTenantsUseCase,
  ) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async create(
    @Body() dto: CreateTenantDto,
    @CurrentUser() user: AuthenticatedIdentity,
    @Req() req: any,
  ) {
    return await this.createTenantUseCase.execute(dto, user.userId, req.requestId);
  }

  @Get()
  @TenantScoped()
  async findAll(
    @CurrentUser() user: AuthenticatedIdentity,
    @CurrentTenant() tenant: TenantScope,
  ) {
    return await this.listUserTenantsUseCase.execute(user.userId, tenant.tenantId);
  }
}
