import { Module } from '@nestjs/common';
import { ContentController } from './presentation/content.controller';
import { CreateContentRequestUseCase } from './application/use-cases/create-content-request.use-case';
import { ListContentRequestsUseCase } from './application/use-cases/list-content-requests.use-case';
import { GetContentRequestUseCase } from './application/use-cases/get-content-request.use-case';
import { UpdateContentRequestUseCase } from './application/use-cases/update-content-request.use-case';
import { ArchiveContentRequestUseCase } from './application/use-cases/archive-content-request.use-case';
import { ContentRequestRepository } from './domain/repositories/content-request.repository';
import { PrismaContentRequestRepository } from './infrastructure/database/prisma-content-request.repository';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [ContentController],
  providers: [
    CreateContentRequestUseCase,
    ListContentRequestsUseCase,
    GetContentRequestUseCase,
    UpdateContentRequestUseCase,
    ArchiveContentRequestUseCase,
    {
      provide: ContentRequestRepository,
      useClass: PrismaContentRequestRepository,
    },
  ],
})
export class ContentModule {}
