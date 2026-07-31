import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaMembershipRepository } from '../../infrastructure/prisma-membership.repository';
import { TenantScope } from '../../../tenants/domain/tenant.types';
import { Role, MembershipStatus, Prisma } from '@projeto/database';
import {
  MembershipNotFoundException,
  LastOwnerProtectedException,
  CannotManageOwnerException,
  CannotManageAdminException,
  CannotManageSelfException
} from '../../domain/membership.errors';

@Injectable()
export class ManageMembershipUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipRepo: PrismaMembershipRepository,
  ) {}

  private validateManagementRules(actorRole: Role, targetRole: Role, action: 'ROLE' | 'STATUS' | 'REMOVE', newRole?: Role) {
    if (actorRole === 'ADMIN') {
      if (targetRole === 'OWNER') {
        throw new CannotManageOwnerException();
      }
      if (targetRole === 'ADMIN') {
        throw new CannotManageAdminException();
      }
      if (newRole === 'OWNER') {
        throw new CannotManageOwnerException(); // ADMIN can't promote to OWNER
      }
    }
  }

  async changeRole(scope: TenantScope, membershipId: string, newRole: Role) {
    if (scope.membershipId === membershipId) {
      throw new CannotManageSelfException();
    }

    const membership = await this.membershipRepo.findById(scope, membershipId);
    if (!membership) throw new MembershipNotFoundException();

    this.validateManagementRules(scope.role as Role, membership.role, 'ROLE', newRole);

    await this.prisma.$transaction(async (tx) => {
      // Protection against demoting last OWNER
      if (membership.role === 'OWNER' && newRole !== 'OWNER' && membership.status === 'ACTIVE') {
        const owners = await this.membershipRepo.getActiveOwnersForUpdate(scope.tenantId, tx);
        if (owners.length <= 1) {
          throw new LastOwnerProtectedException();
        }
      }

      const updated = await tx.membership.update({
        where: { id: membershipId },
        data: { role: newRole }
      });

      await this.createAuditLog(tx, scope, 'MEMBERSHIP_ROLE_CHANGED', membershipId, {
        previousRole: membership.role,
        newRole: newRole,
        targetUserId: membership.userId,
      });

      return updated;
    });
  }

  async changeStatus(scope: TenantScope, membershipId: string, newStatus: MembershipStatus) {
    if (scope.membershipId === membershipId && newStatus === 'SUSPENDED') {
      throw new CannotManageSelfException();
    }

    const membership = await this.membershipRepo.findById(scope, membershipId);
    if (!membership) throw new MembershipNotFoundException();

    this.validateManagementRules(scope.role as Role, membership.role, 'STATUS');

    await this.prisma.$transaction(async (tx) => {
      // Protection against suspending last active OWNER
      if (membership.role === 'OWNER' && membership.status === 'ACTIVE' && newStatus === 'SUSPENDED') {
        const owners = await this.membershipRepo.getActiveOwnersForUpdate(scope.tenantId, tx);
        if (owners.length <= 1) {
          throw new LastOwnerProtectedException();
        }
      }

      const updated = await tx.membership.update({
        where: { id: membershipId },
        data: { status: newStatus }
      });

      const action = newStatus === 'SUSPENDED' ? 'MEMBERSHIP_SUSPENDED' : 'MEMBERSHIP_REACTIVATED';

      await this.createAuditLog(tx, scope, action, membershipId, {
        previousStatus: membership.status,
        newStatus: newStatus,
        targetUserId: membership.userId,
      });

      return updated;
    });
  }

  async remove(scope: TenantScope, membershipId: string) {
    if (scope.membershipId === membershipId) {
      throw new CannotManageSelfException();
    }

    const membership = await this.membershipRepo.findById(scope, membershipId);
    if (!membership) throw new MembershipNotFoundException();

    if (scope.membershipId !== membershipId) {
       this.validateManagementRules(scope.role as Role, membership.role, 'REMOVE');
    }

    await this.prisma.$transaction(async (tx) => {
      // Protection against removing last active OWNER
      if (membership.role === 'OWNER' && membership.status === 'ACTIVE') {
        const owners = await this.membershipRepo.getActiveOwnersForUpdate(scope.tenantId, tx);
        if (owners.length <= 1) {
          throw new LastOwnerProtectedException();
        }
      }

      const updated = await tx.membership.update({
        where: { id: membershipId },
        data: { status: 'REMOVED' }
      });

      await this.createAuditLog(tx, scope, 'MEMBERSHIP_REMOVED', membershipId, {
        previousStatus: membership.status,
        newStatus: 'REMOVED',
        targetUserId: membership.userId,
      });

      return updated;
    });
  }

  private async createAuditLog(
    tx: Prisma.TransactionClient,
    scope: TenantScope,
    action: string,
    entityId: string,
    metadata: any
  ) {
    await tx.auditLog.create({
      data: {
        action,
        entity: 'Membership',
        entityId,
        actorId: scope.userId,
        tenantId: scope.tenantId,
        requestId: scope.requestId,
        metadata
      }
    });
  }
}
