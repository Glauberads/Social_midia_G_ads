import { CreateTenantUseCase } from './create-tenant.use-case';
import { TenantSlugAlreadyExistsException, AuthProfileNotProvisionedException } from '../../domain/tenant.errors';

describe('CreateTenantUseCase', () => {
  let useCase: CreateTenantUseCase;
  let mockUow: any;
  let mockTenantRepo: any;
  let mockMembershipRepo: any;
  let mockAuditLogRepo: any;
  let mockPrisma: any;

  beforeEach(() => {
    mockUow = {
      execute: jest.fn(async (work) => {
        const tx = {
          userProfile: {
            findUnique: jest.fn().mockResolvedValue({ id: 'user-123' }),
          },
        };
        return await work(tx);
      }),
    };

    mockTenantRepo = {
      findBySlug: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'tenant-123',
        name: 'Workspace',
        slug: 'workspace',
        status: 'ACTIVE',
        createdAt: new Date(),
      }),
    };

    mockMembershipRepo = {
      create: jest.fn().mockResolvedValue({
        id: 'membership-123',
        role: 'OWNER',
        status: 'ACTIVE',
      }),
    };

    mockAuditLogRepo = {
      append: jest.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {};

    useCase = new CreateTenantUseCase(
      mockUow,
      mockTenantRepo,
      mockMembershipRepo,
      mockAuditLogRepo,
      mockPrisma,
    );
  });

  it('deve criar um tenant com sucesso', async () => {
    const result = await useCase.execute({ name: 'Workspace', slug: 'workspace' }, 'user-123', 'req-1');
    expect(result.id).toBe('tenant-123');
    expect(result.membership.role).toBe('OWNER');
    expect(mockTenantRepo.create).toHaveBeenCalled();
    expect(mockMembershipRepo.create).toHaveBeenCalled();
    expect(mockAuditLogRepo.append).toHaveBeenCalled();
  });

  it('deve rejeitar slug reservado', async () => {
    await expect(useCase.execute({ name: 'Admin', slug: 'admin' }, 'user-123', 'req-1'))
      .rejects.toThrow(TenantSlugAlreadyExistsException);
  });

  it('deve rejeitar slug duplicado', async () => {
    mockTenantRepo.findBySlug.mockResolvedValueOnce({ id: 'existing' });
    await expect(useCase.execute({ name: 'Workspace', slug: 'workspace' }, 'user-123', 'req-1'))
      .rejects.toThrow(TenantSlugAlreadyExistsException);
  });

  it('deve falhar se perfil não existir (simulado no uow)', async () => {
    mockUow.execute = jest.fn(async (work) => {
      const tx = {
        userProfile: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };
      return await work(tx);
    });
    await expect(useCase.execute({ name: 'Workspace', slug: 'workspace' }, 'user-123', 'req-1'))
      .rejects.toThrow(AuthProfileNotProvisionedException);
  });

  it('deve propagar falha de Membership e não engolir o erro', async () => {
    mockMembershipRepo.create.mockRejectedValueOnce(new Error('DB Error'));
    await expect(useCase.execute({ name: 'Workspace', slug: 'workspace' }, 'user-123', 'req-1'))
      .rejects.toThrow('DB Error');
  });
});
