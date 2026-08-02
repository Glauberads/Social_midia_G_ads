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
import { SubmitContentRequestUseCase } from './application/use-cases/submit-content-request.use-case';
import { ContentGenerationQueue } from './infrastructure/queue/content-generation.queue';
import { CreateManualRevisionUseCase } from './application/use-cases/create-manual-revision.use-case';
import { ListContentRevisionsUseCase } from './application/use-cases/list-content-revisions.use-case';
import { GetContentRevisionUseCase } from './application/use-cases/get-content-revision.use-case';
import { ApproveContentRevisionUseCase } from './application/use-cases/approve-content-revision.use-case';
import { RejectContentRevisionUseCase } from './application/use-cases/reject-content-revision.use-case';

@Module({
  imports: [TenantsModule],
  controllers: [ContentController],
  providers: [
    CreateContentRequestUseCase,
    ListContentRequestsUseCase,
    GetContentRequestUseCase,
    UpdateContentRequestUseCase,
    ArchiveContentRequestUseCase,
    SubmitContentRequestUseCase,
    ContentGenerationQueue,
    CreateManualRevisionUseCase,
    ListContentRevisionsUseCase,
    GetContentRevisionUseCase,
    ApproveContentRevisionUseCase,
    RejectContentRevisionUseCase,
    {
      provide: ContentRequestRepository,
      useClass: PrismaContentRequestRepository,
    },
  ],
  exports: [ContentGenerationQueue],
})
export class ContentModule {}
