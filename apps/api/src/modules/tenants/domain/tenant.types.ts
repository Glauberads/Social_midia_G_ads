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
