import { Controller, Post, Get, Delete, Param, Body, Request, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreateInvitationUseCase } from '../../application/use-cases/create-invitation.use-case';
import { AcceptInvitationUseCase } from '../../application/use-cases/accept-invitation.use-case';
import { RevokeInvitationUseCase } from '../../application/use-cases/revoke-invitation.use-case';
import { ListInvitationsUseCase } from '../../application/use-cases/list-invitations.use-case';
import { RequireRoles } from '../../../auth/decorators/require-roles.decorator';
import { Role } from '@prisma/client';
import { CreateInvitationDto } from '../dto/create-invitation.dto';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { CurrentTenant } from '../../../auth/decorators/current-tenant.decorator';
import { TenantScope } from '../../../tenants/domain/tenant.types';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { TenantScoped } from '../../../auth/decorators/tenant-scoped.decorator';

@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly createUseCase: CreateInvitationUseCase,
    private readonly acceptUseCase: AcceptInvitationUseCase,
    private readonly revokeUseCase: RevokeInvitationUseCase,
    private readonly listUseCase: ListInvitationsUseCase
  ) {}

  @Post()
  @TenantScoped()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @RequireRoles(Role.OWNER, Role.ADMIN)
  async create(@CurrentTenant() scope: TenantScope, @Body() dto: CreateInvitationDto) {
    return this.createUseCase.execute(scope, dto);
  }

  @Get()
  @TenantScoped()
  @RequireRoles(Role.OWNER, Role.ADMIN)
  async list(@CurrentTenant() scope: TenantScope) {
    return this.listUseCase.execute(scope);
  }

  @Delete(':id')
  @HttpCode(204)
  @TenantScoped()
  @RequireRoles(Role.OWNER, Role.ADMIN)
  async revoke(@CurrentTenant() scope: TenantScope, @Param('id') id: string) {
    await this.revokeUseCase.execute(scope, id);
  }

  @Post('accept')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async accept(@Request() req: any, @CurrentUser() user: any, @Body() dto: AcceptInvitationDto) {
    const accessToken = req.headers.authorization?.split(' ')[1] || '';
    return this.acceptUseCase.execute(user.userId, dto.token, accessToken);
  }
}
