export const TENANT_REPOSITORY = Symbol('TENANT_REPOSITORY');

export interface TenantRepository {
  findBySlug(slug: string, tx?: any): Promise<any | null>;
  create(data: { name: string; slug: string }, tx?: any): Promise<any>;
  findUserTenants(userId: string): Promise<any[]>;
}
