import { Module } from '@nestjs/common';
import { ContentController } from './presentation/content.controller';
import { CalendarController } from './presentation/calendar.controller';
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
import { ScheduleContentUseCase } from './application/use-cases/schedule-content.use-case';
import { RescheduleContentUseCase } from './application/use-cases/reschedule-content.use-case';
import { CancelContentScheduleUseCase } from './application/use-cases/cancel-content-schedule.use-case';
import { GetContentScheduleUseCase } from './application/use-cases/get-content-schedule.use-case';
import { ListCalendarUseCase } from './application/use-cases/list-calendar.use-case';
import { ContentScheduleRepository } from './domain/repositories/content-schedule.repository';
import { PrismaContentScheduleRepository } from './infrastructure/database/prisma-content-schedule.repository';

@Module({
  imports: [TenantsModule],
  controllers: [ContentController, CalendarController],
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
    ScheduleContentUseCase,
    RescheduleContentUseCase,
    CancelContentScheduleUseCase,
    GetContentScheduleUseCase,
    ListCalendarUseCase,
    {
      provide: ContentRequestRepository,
      useClass: PrismaContentRequestRepository,
    },
    {
      provide: ContentScheduleRepository,
      useClass: PrismaContentScheduleRepository,
    },
  ],
  exports: [ContentGenerationQueue],
})
export class ContentModule {}
