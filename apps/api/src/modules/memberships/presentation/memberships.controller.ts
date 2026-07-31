import { Controller, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { TenantScoped } from '../../auth/decorators/tenant-scoped.decorator';
import { RequireRoles } from '../../auth/decorators/require-roles.decorator';
import { CurrentTenant } from '../../auth/decorators/current-tenant.decorator';
import { TenantScope } from '../../tenants/domain/tenant.types';
import { RbacGuard } from '../../auth/guards/rbac.guard';
import { PrismaMembershipRepository } from '../infrastructure/prisma-membership.repository';
import { ManageMembershipUseCase } from '../application/use-cases/manage-membership.use-case';
import { ChangeRoleDto } from './dto/change-role.dto';
import { ChangeStatusDto } from './dto/change-status.dto';

@Controller('memberships')
@TenantScoped()
@UseGuards(RbacGuard)
export class MembershipsController {
  constructor(
    private readonly membershipRepo: PrismaMembershipRepository,
    private readonly manageMembership: ManageMembershipUseCase,
  ) {}

  @Get()
  @RequireRoles('OWNER', 'ADMIN')
  async listMemberships(@CurrentTenant() tenant: TenantScope) {
    const memberships = await this.membershipRepo.listByTenant(tenant);
    return memberships.map((m: any) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      fullName: m.user.fullName,
      role: m.role,
      status: m.status,
      createdAt: m.createdAt,
    }));
  }

  @Patch(':id/role')
  @RequireRoles('OWNER', 'ADMIN')
  async changeRole(
    @CurrentTenant() tenant: TenantScope,
    @Param('id') membershipId: string,
    @Body() dto: ChangeRoleDto,
  ) {
    await this.manageMembership.changeRole(tenant, membershipId, dto.role);
    return { success: true };
  }

  @Patch(':id/status')
  @RequireRoles('OWNER', 'ADMIN')
  async changeStatus(
    @CurrentTenant() tenant: TenantScope,
    @Param('id') membershipId: string,
    @Body() dto: ChangeStatusDto,
  ) {
    await this.manageMembership.changeStatus(tenant, membershipId, dto.status);
    return { success: true };
  }

  @Delete(':id')
  @RequireRoles('OWNER', 'ADMIN')
  async removeMembership(
    @CurrentTenant() tenant: TenantScope,
    @Param('id') membershipId: string,
  ) {
    await this.manageMembership.remove(tenant, membershipId);
    return { success: true };
  }
}
