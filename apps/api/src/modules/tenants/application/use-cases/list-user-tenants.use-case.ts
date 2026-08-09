import { Injectable, Inject } from '@nestjs/common';
import { TENANT_REPOSITORY, TenantRepository } from '../ports/tenant.repository';
import { TenantResponse } from '../../domain/tenant.types';
import { UNIT_OF_WORK, UnitOfWork } from '../ports/unit-of-work';

@Injectable()
export class ListUserTenantsUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY) private readonly tenantRepository: TenantRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(userId: string, tenantId: string): Promise<TenantResponse[]> {
    return this.uow.executeWithTenant(tenantId, userId, async (tx) => {
      const records = await this.tenantRepository.findUserTenants(tx, userId);
      
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
    });
  }
}
