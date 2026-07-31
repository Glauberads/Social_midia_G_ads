import { Injectable, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantScope } from '../../../tenants/domain/tenant.types';
import { Role, InvitationStatus } from '@prisma/client';

@Injectable()
export class RevokeInvitationUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(scope: TenantScope, invitationId: string) {
    return this.prisma.$transaction(async (tx) => {
      type LockedRevokeRow = {
        id: string;
        email: string;
        role: Role;
        status: InvitationStatus;
      };

      // 1. Lock the invitation
      const rows = await tx.$queryRaw<LockedRevokeRow[]>`
        SELECT id, email, role, status
        FROM "Invitation"
        WHERE id = ${invitationId}::uuid AND "tenantId" = ${scope.tenantId}::uuid
        FOR UPDATE
      `;

      if (rows.length === 0) {
        throw new NotFoundException('INVITATION_NOT_FOUND');
      }

      const invitation = rows[0];

      // 2. Validate RBAC
      const actorRole = scope.role as Role;
      if (actorRole === Role.ADMIN) {
        if (invitation.role === Role.OWNER || invitation.role === Role.ADMIN) {
          throw new ForbiddenException('ADMIN cannot revoke OWNER or ADMIN invitations');
        }
      }

      // 3. Validate status
      if (invitation.status !== 'PENDING') {
        throw new ConflictException('INVITATION_NOT_PENDING');
      }

      // 4. Revoke
      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'REVOKED',
          revokedAt: new Date()
        }
      });

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          action: 'INVITATION_REVOKED',
          entity: 'Invitation',
          entityId: invitation.id,
          actorId: scope.userId,
          tenantId: scope.tenantId,
          metadata: {
            targetEmail: invitation.email,
            targetRole: invitation.role
          }
        }
      });

      return { success: true };
    });
  }
}
