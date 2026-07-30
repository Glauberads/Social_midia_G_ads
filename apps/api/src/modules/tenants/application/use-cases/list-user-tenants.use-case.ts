import { Injectable, Inject } from '@nestjs/common';
import { TENANT_REPOSITORY, TenantRepository } from '../ports/tenant.repository';
import { TenantResponse } from '../../domain/tenant.types';

@Injectable()
export class ListUserTenantsUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY) private readonly tenantRepository: TenantRepository,
  ) {}

  async execute(userId: string): Promise<TenantResponse[]> {
    const records = await this.tenantRepository.findUserTenants(userId);
    
    return records.map((record) => ({
      id: record.tenant.id,
      name: record.tenant.name,
      slug: record.tenant.slug,
      status: record.tenant.status,
      membership: {
        id: record.id,
        role: record.role,
        status: record.status,
      },
      createdAt: record.tenant.createdAt,
    }));
  }
}
