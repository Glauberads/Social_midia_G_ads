import { Injectable, ConflictException, ForbiddenException, GoneException, Inject } from '@nestjs/common';
import { Role, InvitationStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { InvitationTokenHasher } from '../../domain/invitation-crypto';
import { EmailNormalizer } from '../../domain/email-normalizer';

import { AuthenticatedUserResolver } from '../../application/ports/authenticated-user.resolver';

@Injectable()
export class AcceptInvitationUseCase {
  constructor(
    @Inject('AuthenticatedUserResolver') private readonly authResolver: AuthenticatedUserResolver,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async execute(userId: string, rawToken: string, accessToken: string) {
    // Consultar identidade ANTES da transação
    const resolvedUser = await this.authResolver.resolve(accessToken);
    const normalizedUserEmail = EmailNormalizer.normalize(resolvedUser.email);
    const pepper = this.config.get<string>('INVITATION_TOKEN_PEPPER');
    if (!pepper) throw new Error('INVITATION_TOKEN_PEPPER is not configured');

    const tokenHash = InvitationTokenHasher.hash(rawToken, pepper);

    return this.prisma.$transaction(async (tx) => {
      type LockedInvitationRow = {
        id: string;
        email: string;
        role: Role;
        status: InvitationStatus;
        tokenHash: string;
        tenantId: string;
        expiresAt: Date;
      };

      // 1. Lock the invitation
      const rows = await tx.$queryRaw<LockedInvitationRow[]>`
        SELECT id, email, role, status, "tokenHash", "tenantId", "expiresAt"
        FROM "Invitation"
        WHERE "tokenHash" = ${tokenHash}
        FOR UPDATE
      `;

      if (rows.length === 0) {
        throw new ForbiddenException('INVITATION_NOT_FOUND_OR_INVALID'); // Stable error for wrong token
      }

      const invitation = rows[0];

      // 2. Validate status and expiration
      if (invitation.status !== 'PENDING') {
        throw new ConflictException('INVITATION_ALREADY_USED');
      }

      if (new Date(invitation.expiresAt) <= new Date()) {
        // Option chosen: return 410 without persisting EXPIRED in this transaction to avoid rollback complexity.
        // The instruction says "expiresAt <= now() significa convite expirado; aceite retorna 410 INVITATION_EXPIRED; nenhuma Membership é criada"
        throw new GoneException('INVITATION_EXPIRED');
      }

      // 3. Validate email matches
      if (EmailNormalizer.normalize(invitation.email) !== normalizedUserEmail) {
        throw new ForbiddenException('INVITATION_EMAIL_MISMATCH');
      }

      // 4. Validate Tenant status
      const tenantRows = await tx.$queryRaw<any[]>`
        SELECT status, "deletedAt" FROM "Tenant" WHERE id = ${invitation.tenantId}
      `;
      if (tenantRows.length === 0 || tenantRows[0].status !== 'ACTIVE' || tenantRows[0].deletedAt !== null) {
        throw new ForbiddenException('TENANT_NOT_ACTIVE');
      }

      // 5. Check existing membership
      const existingMembership = await tx.$queryRaw<any[]>`
        SELECT id FROM "Membership"
        WHERE "userId" = ${userId}::uuid AND "tenantId" = ${invitation.tenantId}::uuid
      `;
      if (existingMembership.length > 0) {
        throw new ConflictException('MEMBERSHIP_ALREADY_EXISTS');
      }

      // 6. Create Membership
      const membership = await tx.membership.create({
        data: {
          userId,
          tenantId: invitation.tenantId,
          role: invitation.role,
          status: 'ACTIVE'
        }
      });

      // 7. Update Invitation
      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          acceptedById: userId
        }
      });

      // 8. Audit Logs
      await tx.auditLog.create({
        data: {
          action: 'INVITATION_ACCEPTED',
          entity: 'Invitation',
          entityId: invitation.id,
          actorId: userId,
          tenantId: invitation.tenantId,
          metadata: {
            targetEmail: invitation.email,
            targetRole: invitation.role,
            targetUserId: userId
          }
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'MEMBERSHIP_CREATED',
          entity: 'Membership',
          entityId: membership.id,
          actorId: userId,
          tenantId: invitation.tenantId,
          metadata: {
            targetUserId: userId,
            targetRole: invitation.role
          }
        }
      });

      return membership;
    });
  }
}
