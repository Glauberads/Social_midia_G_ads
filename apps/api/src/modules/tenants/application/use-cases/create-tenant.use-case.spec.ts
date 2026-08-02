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
      executeGlobal: jest.fn(async (_userId, work) => {
        const tx = {
          userProfile: {
            findUnique: jest.fn().mockResolvedValue({ id: 'user-123' }),
          },
          $executeRaw: jest.fn().mockResolvedValue(1),
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
    expect(result.id).toEqual(expect.any(String));
    expect(result.name).toBe('Workspace');
    expect(result.membership.role).toBe('OWNER');
    expect(mockUow.executeGlobal).toHaveBeenCalled();
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
    mockUow.executeGlobal = jest.fn(async (_userId, work) => {
      const tx = {
        userProfile: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        $executeRaw: jest.fn(),
      };
      return await work(tx);
    });
    await expect(useCase.execute({ name: 'Workspace', slug: 'workspace' }, 'user-123', 'req-1'))
      .rejects.toThrow(AuthProfileNotProvisionedException);
  });

  it('deve propagar falha de Membership e não engolir o erro', async () => {
    mockUow.executeGlobal = jest.fn(async (_userId, work) => work({
      userProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'user-123' }) },
      $executeRaw: jest.fn().mockRejectedValue(new Error('DB Error')),
    }));
    await expect(useCase.execute({ name: 'Workspace', slug: 'workspace' }, 'user-123', 'req-1'))
      .rejects.toThrow('DB Error');
  });
});
