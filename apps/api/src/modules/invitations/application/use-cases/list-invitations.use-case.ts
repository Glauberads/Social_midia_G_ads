import { Injectable, Inject } from '@nestjs/common';
import { InvitationRepository } from '../../application/ports/invitation.repository';
import { TenantScope } from '../../../tenants/domain/tenant.types';

import { TenantTransactionService } from '../../../tenants/application/services/tenant-transaction.service';

@Injectable()
export class ListInvitationsUseCase {
  constructor(
    @Inject('InvitationRepository') private readonly invitationRepo: InvitationRepository,
    private readonly transactionService: TenantTransactionService
  ) {}

  async execute(scope: TenantScope) {
    return this.transactionService.execute(scope, async (tx) => {
      const invitations = await this.invitationRepo.list(tx, scope.tenantId);

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
    });
  }
}
