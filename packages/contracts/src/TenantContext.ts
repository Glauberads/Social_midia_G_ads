export interface TenantContext {
  tenantId: string;
  userId: string;
  membershipId: string;
  roles: string[];
  permissions: string[];
  requestId: string;
  source: string;
  isPlatformAdmin: boolean;
}
