export const MEMBERSHIP_REPOSITORY = Symbol('MEMBERSHIP_REPOSITORY');

export interface MembershipRepository {
  create(data: { userId: string; tenantId: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' }, tx?: any): Promise<any>;
}
