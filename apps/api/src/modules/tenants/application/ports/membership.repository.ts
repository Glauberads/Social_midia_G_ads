import { Prisma } from '@projeto/database';

export const MEMBERSHIP_REPOSITORY = Symbol('MEMBERSHIP_REPOSITORY');

export interface MembershipRepository {
  findByUserAndTenant(tx: Prisma.TransactionClient, userId: string, tenantId: string): Promise<any | null>;
  create(tx: Prisma.TransactionClient, data: { userId: string; tenantId: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' }): Promise<any>;
}
