import { Invitation, Prisma } from '@prisma/client';

export interface InvitationRepository {
  create(tx: Prisma.TransactionClient, data: Prisma.InvitationUncheckedCreateInput): Promise<Invitation>;
  findPendingById(tx: Prisma.TransactionClient, id: string): Promise<Invitation | null>;
  findPendingByTokenHashForUpdate(tx: Prisma.TransactionClient, tokenHash: string): Promise<Invitation | null>;
  list(tx: Prisma.TransactionClient, tenantId: string): Promise<Invitation[]>;
}
