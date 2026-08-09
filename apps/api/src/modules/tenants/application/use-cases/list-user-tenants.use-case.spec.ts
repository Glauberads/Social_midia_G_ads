import { ListUserTenantsUseCase } from './list-user-tenants.use-case';
import { TenantRepository } from '../ports/tenant.repository';

describe('ListUserTenantsUseCase', () => {
  let useCase: ListUserTenantsUseCase;
  let mockTenantRepo: any;

  beforeEach(() => {
    mockTenantRepo = {
      findUserTenants: jest.fn().mockResolvedValue([
        {
          id: 'membership-123',
          role: 'OWNER',
          status: 'ACTIVE',
          tenant: {
            id: 'tenant-123',
            name: 'Workspace',
            slug: 'workspace',
            status: 'ACTIVE',
            createdAt: new Date('2026-07-30'),
          },
        },
      ]),
    };

    const mockUow = {
      executeWithTenant: jest.fn().mockImplementation((tenantId, userId, cb) => cb({}))
    };

    useCase = new ListUserTenantsUseCase(
      mockTenantRepo as unknown as TenantRepository,
      mockUow as any
    );
  });

  it('deve listar apenas os tenants em que o usuario possui membership', async () => {
    const result = await useCase.execute('user-123', 'tenant-123');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('tenant-123');
    expect(result[0].membership.role).toBe('OWNER');
    expect(mockTenantRepo.findUserTenants).toHaveBeenCalledWith('user-123', {});
  });
});
