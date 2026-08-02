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
    void requestId;
    if (RESERVED_SLUGS.includes(dto.slug.toLowerCase())) {
      throw new TenantSlugAlreadyExistsException();
    }

    return this.uow.executeGlobal(userId, async (tx) => {
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

      // 3. Create Tenant via SECURITY DEFINER function since RLS blocks normal inserts
      // We generate UUIDs here
      const crypto = await import('crypto');
      const tenantId = crypto.randomUUID();
      const membershipId = crypto.randomUUID();
      const auditLogId = crypto.randomUUID();

      await tx.$executeRaw`
        SELECT public.create_tenant_with_owner(
          ${userId}::uuid, 
          ${tenantId}::uuid, 
          ${dto.name}, 
          ${dto.slug}, 
          ${membershipId}::uuid
        )
      `;

      // 5. Create AuditLog via SECURITY DEFINER function
      await tx.$executeRaw`
        SELECT public.log_global_audit(
          ${auditLogId}::uuid,
          'TENANT_CREATED',
          'Tenant',
          ${tenantId},
          ${userId}::uuid,
          ${{ tenantName: dto.name, tenantSlug: dto.slug }}::jsonb
        )
      `;

      return {
        id: tenantId,
        name: dto.name,
        slug: dto.slug,
        status: 'ACTIVE',
        membership: {
          id: membershipId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
        createdAt: new Date(),
      };
    });
  }
}
