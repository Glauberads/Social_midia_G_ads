import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateTenantUseCase } from '../application/use-cases/create-tenant.use-case';
import { ListUserTenantsUseCase } from '../application/use-cases/list-user-tenants.use-case';
import { SupabaseAuthGuard } from '../../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedIdentity } from '../../auth/services/access-token-verifier.interface';

@Controller('tenants')
@UseGuards(SupabaseAuthGuard)
export class TenantsController {
  constructor(
    private readonly createTenantUseCase: CreateTenantUseCase,
    private readonly listUserTenantsUseCase: ListUserTenantsUseCase,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateTenantDto,
    @CurrentUser() user: AuthenticatedIdentity,
    @Req() req: any,
  ) {
    return await this.createTenantUseCase.execute(dto, user.userId, req.requestId);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedIdentity) {
    return await this.listUserTenantsUseCase.execute(user.userId);
  }
}
