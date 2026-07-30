import { Module } from '@nestjs/common';
import { TenantsController } from './presentation/tenants.controller';
import { TenantContextController } from './presentation/tenant-context.controller';
import { CreateTenantUseCase } from './application/use-cases/create-tenant.use-case';
import { ListUserTenantsUseCase } from './application/use-cases/list-user-tenants.use-case';
import { TenantContextService } from './application/tenant-context.service';
import { TENANT_REPOSITORY } from './application/ports/tenant.repository';
import { PrismaTenantRepository } from './infrastructure/prisma-tenant.repository';
import { MEMBERSHIP_REPOSITORY } from './application/ports/membership.repository';
import { PrismaMembershipRepository } from './infrastructure/prisma-membership.repository';
import { AUDIT_LOG_REPOSITORY } from './application/ports/audit-log.repository';
import { PrismaAuditLogRepository } from './infrastructure/prisma-audit-log.repository';
import { UNIT_OF_WORK } from './application/ports/unit-of-work';
import { PrismaUnitOfWork } from './infrastructure/prisma-unit-of-work';
import { PrismaModule } from '../prisma/prisma.module';

import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TenantsController, TenantContextController],
  providers: [
    CreateTenantUseCase,
    ListUserTenantsUseCase,
    TenantContextService,
    {
      provide: TENANT_REPOSITORY,
      useClass: PrismaTenantRepository,
    },
    {
      provide: MEMBERSHIP_REPOSITORY,
      useClass: PrismaMembershipRepository,
    },
    {
      provide: AUDIT_LOG_REPOSITORY,
      useClass: PrismaAuditLogRepository,
    },
    {
      provide: UNIT_OF_WORK,
      useClass: PrismaUnitOfWork,
    },
  ],
  exports: [TenantContextService],
})
export class TenantsModule {}
