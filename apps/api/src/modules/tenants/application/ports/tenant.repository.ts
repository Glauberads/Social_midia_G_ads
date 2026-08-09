import { Prisma } from '@projeto/database';

export const TENANT_REPOSITORY = Symbol('TENANT_REPOSITORY');

export interface TenantRepository {
  findBySlug(tx: Prisma.TransactionClient, slug: string): Promise<any | null>;
  create(tx: Prisma.TransactionClient, data: { name: string; slug: string }): Promise<any>;
  findUserTenants(tx: Prisma.TransactionClient, userId: string): Promise<any[]>;
}
