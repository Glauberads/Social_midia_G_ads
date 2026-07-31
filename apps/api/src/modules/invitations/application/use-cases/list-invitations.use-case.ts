import { Injectable, Inject } from '@nestjs/common';
import { InvitationRepository } from '../../application/ports/invitation.repository';
import { TenantScope } from '../../../tenants/domain/tenant.types';

@Injectable()
export class ListInvitationsUseCase {
  constructor(@Inject('InvitationRepository') private readonly invitationRepo: InvitationRepository) {}

  async execute(scope: TenantScope) {
    const invitations = await this.invitationRepo.list(scope);

    return invitations.map(inv => {
      const isExpired = new Date(inv.expiresAt) <= new Date();
      const effectiveStatus = inv.status === 'PENDING' && isExpired ? 'EXPIRED' : inv.status;

      return {
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        effectiveStatus,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt
        // DO NOT INCLUDE tokenHash
      };
    });
  }
}
