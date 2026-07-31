import { ExecutionContext, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantResolverGuard } from './tenant-resolver.guard';
import { PrismaService } from '../../prisma/prisma.service';

describe('TenantResolverGuard', () => {
  let guard: TenantResolverGuard;
  let reflector: Reflector;
  let prisma: PrismaService;
  let context: ExecutionContext;
  let request: any;

  beforeEach(() => {
    reflector = new Reflector();
    prisma = new PrismaService();
    guard = new TenantResolverGuard(reflector, prisma);

    request = {
      headers: {},
      user: { userId: 'user-id-123' },
    };

    context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. rota global sem x-tenant-id continua funcionando', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('2. rota tenant-scoped sem header retorna 400', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
    await expect(guard.canActivate(context)).rejects.toThrow('TENANT_CONTEXT_REQUIRED');
  });

  it('3. header malformado retorna 400', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    request.headers['x-tenant-id'] = 'not-a-uuid';
    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
    await expect(guard.canActivate(context)).rejects.toThrow('INVALID_TENANT_ID');
  });

  it('4. múltiplos valores do header retornam 400', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    request.headers['x-tenant-id'] = ['uuid-1', 'uuid-2'];
    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
    await expect(guard.canActivate(context)).rejects.toThrow('INVALID_TENANT_ID');
  });

  const validUuid = '123e4567-e89b-12d3-a456-426614174000';

  it('5. membership inexistente retorna 403', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    request.headers['x-tenant-id'] = validUuid;
    prisma.tenant.findUnique = jest.fn().mockResolvedValue({
      id: validUuid,
      status: 'ACTIVE',
      memberships: [],
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toThrow('TENANT_ACCESS_DENIED');
  });

  it('6. membership suspensa retorna 403', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    request.headers['x-tenant-id'] = validUuid;
    prisma.tenant.findUnique = jest.fn().mockResolvedValue({
      id: validUuid,
      status: 'ACTIVE',
      memberships: [{ id: 'm1', role: 'MEMBER', status: 'SUSPENDED' }],
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toThrow('MEMBERSHIP_SUSPENDED');
  });

  it('7. tenant suspenso retorna 403', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    request.headers['x-tenant-id'] = validUuid;
    prisma.tenant.findUnique = jest.fn().mockResolvedValue({
      id: validUuid,
      status: 'SUSPENDED',
      memberships: [{ id: 'm1', role: 'OWNER', status: 'ACTIVE' }],
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toThrow('TENANT_SUSPENDED');
  });

  it('8. tenant deletado não é acessível', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    request.headers['x-tenant-id'] = validUuid;
    prisma.tenant.findUnique = jest.fn().mockResolvedValue({
      id: validUuid,
      status: 'ACTIVE',
      deletedAt: new Date(),
      memberships: [{ id: 'm1', role: 'OWNER', status: 'ACTIVE' }],
    });

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
    await expect(guard.canActivate(context)).rejects.toThrow('TENANT_NOT_FOUND');
  });

  it('9. membership ativa cria TenantScope', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    request.headers['x-tenant-id'] = validUuid;
    prisma.tenant.findUnique = jest.fn().mockResolvedValue({
      id: validUuid,
      status: 'ACTIVE',
      memberships: [{ id: 'm1', role: 'OWNER', status: 'ACTIVE' }],
    });

    await guard.canActivate(context);
    expect(request.tenantScope).toBeDefined();
    expect(request.tenantScope.tenantId).toBe(validUuid);
    expect(request.tenantScope.role).toBe('OWNER');
    expect(request.tenantScope.membershipId).toBe('m1');
    expect(request.tenantScope.userId).toBe('user-id-123');
  });
});
