import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_TENANT_SCOPED_KEY } from '../decorators/tenant-scoped.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantScope } from '../../tenants/domain/tenant.types';
import { randomUUID } from 'crypto';

@Injectable()
export class TenantResolverGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isTenantScoped = this.reflector.getAllAndOverride<boolean>(
      IS_TENANT_SCOPED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isTenantScoped) {
      return true; // Rota não exige tenant
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // Identity do SupabaseAuthGuard
    if (!user || !user.userId) {
      throw new ForbiddenException('Usuário não autenticado.');
    }

    const rawTenantHeader = request.headers['x-tenant-id'];
    
    if (!rawTenantHeader) {
      throw new BadRequestException('TENANT_CONTEXT_REQUIRED');
    }

    if (Array.isArray(rawTenantHeader)) {
      throw new BadRequestException('INVALID_TENANT_ID');
    }

    if (rawTenantHeader.includes(',')) {
      throw new BadRequestException('INVALID_TENANT_ID');
    }

    const tenantId = rawTenantHeader.trim();
    
    if (tenantId === '') {
      throw new BadRequestException('INVALID_TENANT_ID');
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      throw new BadRequestException('INVALID_TENANT_ID');
    }

    // Busca tenant e membership atômica
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        memberships: {
          where: { userId: user.userId },
        },
      },
    }) as any; // Bypass inference issues

    if (!tenant || tenant.deletedAt || tenant.status === 'DELETED') {
      throw new NotFoundException('TENANT_NOT_FOUND');
    }

    if (tenant.status === 'SUSPENDED') {
      throw new ForbiddenException('TENANT_SUSPENDED');
    }

    if (tenant.memberships.length === 0) {
      throw new ForbiddenException('TENANT_ACCESS_DENIED');
    }

    const membership = tenant.memberships[0];

    if (membership.status === 'SUSPENDED') {
      throw new ForbiddenException('MEMBERSHIP_SUSPENDED');
    }

    if (membership.status !== 'ACTIVE') {
      throw new ForbiddenException('TENANT_ACCESS_DENIED');
    }

    const requestId = request.headers['x-request-id'] || randomUUID();
    request.requestId = requestId;

    // Criar TenantScope Imutável
    const scope: TenantScope = Object.freeze({
      userId: user.userId,
      tenantId: tenant.id,
      membershipId: membership.id,
      role: membership.role,
      requestId,
    });

    request.tenantScope = scope;

    return true;
  }
}
