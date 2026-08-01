import { Module } from '@nestjs/common';
import { MembershipsController } from './presentation/memberships.controller';
import { ManageMembershipUseCase } from './application/use-cases/manage-membership.use-case';
import { PrismaMembershipRepository } from './infrastructure/prisma-membership.repository';

import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [MembershipsController],
  providers: [ManageMembershipUseCase, PrismaMembershipRepository],
  exports: [PrismaMembershipRepository]
})
export class MembershipsModule {}
