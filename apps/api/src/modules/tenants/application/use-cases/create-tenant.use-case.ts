import { Injectable, Inject } from '@nestjs/common';
import { CreateTenantDto } from '../../presentation/dto/create-tenant.dto';
import { TenantResponse } from '../../domain/tenant.types';
import { TenantSlugAlreadyExistsException, AuthProfileNotProvisionedException, RESERVED_SLUGS } from '../../domain/tenant.errors';
import { TENANT_REPOSITORY, TenantRepository } from '../ports/tenant.repository';
import { MEMBERSHIP_REPOSITORY, MembershipRepository } from '../ports/membership.repository';
import { AUDIT_LOG_REPOSITORY, AuditLogRepository } from '../ports/audit-log.repository';
import { UNIT_OF_WORK, UnitOfWork } from '../ports/unit-of-work';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class CreateTenantUseCase {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(TENANT_REPOSITORY) private readonly tenantRepository: TenantRepository,
    @Inject(MEMBERSHIP_REPOSITORY) private readonly membershipRepository: MembershipRepository,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepository,
    private readonly prisma: PrismaService, // To check profile without tx if needed, but we'll do inside tx
  ) {}

  async execute(dto: CreateTenantDto, userId: string, requestId?: string): Promise<TenantResponse> {
    if (RESERVED_SLUGS.includes(dto.slug.toLowerCase())) {
      throw new TenantSlugAlreadyExistsException();
    }

    return this.uow.execute(async (tx) => {
      // 1. Confirm UserProfile exists
      const userProfile = await tx.userProfile.findUnique({
        where: { id: userId },
      });

      if (!userProfile) {
        throw new AuthProfileNotProvisionedException();
      }

      // 2. Check if slug exists
      const existing = await this.tenantRepository.findBySlug(dto.slug, tx);
      if (existing) {
        throw new TenantSlugAlreadyExistsException();
      }

      // 3. Create Tenant
      const tenant = await this.tenantRepository.create(
        { name: dto.name, slug: dto.slug },
        tx,
      );

      // 4. Create Membership OWNER
      const membership = await this.membershipRepository.create(
        {
          userId,
          tenantId: tenant.id,
          role: 'OWNER',
        },
        tx,
      );

      // 5. Create AuditLog
      await this.auditLogRepository.append(
        {
          action: 'TENANT_CREATED',
          entity: 'Tenant',
          entityId: tenant.id,
          actorId: userId,
          tenantId: tenant.id,
          requestId,
          metadata: {
            tenantName: tenant.name,
            tenantSlug: tenant.slug,
          },
        },
        tx,
      );

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        membership: {
          id: membership.id,
          role: membership.role,
          status: membership.status,
        },
        createdAt: tenant.createdAt,
      };
    });
  }
}
