import { Invitation, Prisma } from '@prisma/client';
import { TenantScope } from '../../../tenants/domain/tenant.types';

export interface InvitationRepository {
  create(scope: TenantScope, data: Prisma.InvitationUncheckedCreateInput): Promise<Invitation>;
  findPendingById(scope: TenantScope, id: string): Promise<Invitation | null>;
  findPendingByTokenHashForUpdate(tokenHash: string, tx: Prisma.TransactionClient): Promise<Invitation | null>;
  list(scope: TenantScope): Promise<Invitation[]>;
}
