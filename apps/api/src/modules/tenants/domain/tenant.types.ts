export interface TenantResponse {
  id: string;
  name: string;
  slug: string;
  status: string;
  membership: {
    id: string;
    role: string;
    status: string;
  };
  createdAt: Date;
}

export interface TenantScope {
  readonly userId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly role: string;
  readonly requestId: string;
}
