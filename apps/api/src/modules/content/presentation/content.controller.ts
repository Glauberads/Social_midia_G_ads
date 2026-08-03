import { Controller, Post, Get, Patch, Body, Param, Req, UseGuards, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { CreateContentRequestUseCase } from '../application/use-cases/create-content-request.use-case';
import { ListContentRequestsUseCase } from '../application/use-cases/list-content-requests.use-case';
import { GetContentRequestUseCase } from '../application/use-cases/get-content-request.use-case';
import { UpdateContentRequestUseCase } from '../application/use-cases/update-content-request.use-case';
import { ArchiveContentRequestUseCase } from '../application/use-cases/archive-content-request.use-case';
import { CreateContentDto } from './dtos/create-content.dto';
import { UpdateContentDto } from './dtos/update-content.dto';
import { RbacGuard } from '../../auth/guards/rbac.guard';
import { RequireRoles } from '../../auth/decorators/require-roles.decorator';
import { TenantScoped } from '../../auth/decorators/tenant-scoped.decorator';
import { SubmitContentRequestUseCase } from '../application/use-cases/submit-content-request.use-case';
import { CreateManualRevisionUseCase } from '../application/use-cases/create-manual-revision.use-case';
import { ListContentRevisionsUseCase } from '../application/use-cases/list-content-revisions.use-case';
import { GetContentRevisionUseCase } from '../application/use-cases/get-content-revision.use-case';
import { ApproveContentRevisionUseCase } from '../application/use-cases/approve-content-revision.use-case';
import { RejectContentRevisionUseCase } from '../application/use-cases/reject-content-revision.use-case';
import { CreateContentRevisionDto, ListContentRevisionsQueryDto, RejectContentRevisionDto } from './dtos/content-revision.dto';
import { ScheduleContentUseCase } from '../application/use-cases/schedule-content.use-case';
import { RescheduleContentUseCase } from '../application/use-cases/reschedule-content.use-case';
import { CancelContentScheduleUseCase } from '../application/use-cases/cancel-content-schedule.use-case';
import { GetContentScheduleUseCase } from '../application/use-cases/get-content-schedule.use-case';
import { ScheduleContentDto, CancelContentScheduleDto } from './dtos/content-schedule.dto';

@Controller('content-requests')
@TenantScoped()
export class ContentController {
  constructor(
    private readonly createUseCase: CreateContentRequestUseCase,
    private readonly listUseCase: ListContentRequestsUseCase,
    private readonly getUseCase: GetContentRequestUseCase,
    private readonly updateUseCase: UpdateContentRequestUseCase,
    private readonly archiveUseCase: ArchiveContentRequestUseCase,
    private readonly submitUseCase: SubmitContentRequestUseCase,
    private readonly createRevisionUseCase: CreateManualRevisionUseCase,
    private readonly listRevisionsUseCase: ListContentRevisionsUseCase,
    private readonly getRevisionUseCase: GetContentRevisionUseCase,
    private readonly approveRevisionUseCase: ApproveContentRevisionUseCase,
    private readonly rejectRevisionUseCase: RejectContentRevisionUseCase,
    private readonly scheduleContentUseCase: ScheduleContentUseCase,
    private readonly rescheduleContentUseCase: RescheduleContentUseCase,
    private readonly cancelScheduleUseCase: CancelContentScheduleUseCase,
    private readonly getScheduleUseCase: GetContentScheduleUseCase,
  ) {}

  @Post()
  @UseGuards(RbacGuard)
  @RequireRoles('OWNER', 'ADMIN', 'MEMBER')
  async create(@Req() req: any, @Body() dto: CreateContentDto) {
    return this.createUseCase.execute({
      tenantId: req.tenantScope.tenantId,
      userId: req.user.userId,
      ...dto,
    });
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(RbacGuard)
  @RequireRoles('OWNER', 'ADMIN', 'MEMBER')
  async submit(@Req() req: any, @Param('id') id: string) {
    return this.submitUseCase.execute({ contentRequestId: id, tenantId: req.tenantScope.tenantId, userId: req.user.userId, requestId: req.requestId });
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(RbacGuard)
  @RequireRoles('OWNER', 'ADMIN', 'MEMBER')
  async retry(@Req() req: any, @Param('id') id: string) {
    return this.submitUseCase.execute({ contentRequestId: id, tenantId: req.tenantScope.tenantId, userId: req.user.userId, requestId: req.requestId, retryFailed: true });
  }

  @Get(':id/revisions')
  async listRevisions(@Req() req: any, @Param('id') id: string, @Query() query: ListContentRevisionsQueryDto) {
    return this.listRevisionsUseCase.execute(id, req.tenantScope.tenantId, query.page, query.limit);
  }

  @Get(':id/revisions/:revisionId')
  async getRevision(@Req() req: any, @Param('id') id: string, @Param('revisionId') revisionId: string) {
    return this.getRevisionUseCase.execute(id, revisionId, req.tenantScope.tenantId);
  }

  @Post(':id/revisions')
  @UseGuards(RbacGuard)
  @RequireRoles('OWNER', 'ADMIN', 'MEMBER')
  async createRevision(@Req() req: any, @Param('id') id: string, @Body() dto: CreateContentRevisionDto) {
    return this.createRevisionUseCase.execute({ contentRequestId: id, tenantId: req.tenantScope.tenantId, userId: req.user.userId, requestId: req.requestId, ...dto });
  }

  @Post(':id/revisions/:revisionId/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RbacGuard)
  @RequireRoles('OWNER', 'ADMIN', 'MEMBER')
  async approveRevision(@Req() req: any, @Param('id') id: string, @Param('revisionId') revisionId: string) {
    return this.approveRevisionUseCase.execute(id, revisionId, req.tenantScope.tenantId, req.user.userId, req.requestId);
  }

  @Post(':id/revisions/:revisionId/reject')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RbacGuard)
  @RequireRoles('OWNER', 'ADMIN', 'MEMBER')
  async rejectRevision(@Req() req: any, @Param('id') id: string, @Param('revisionId') revisionId: string, @Body() dto: RejectContentRevisionDto) {
    return this.rejectRevisionUseCase.execute(id, revisionId, req.tenantScope.tenantId, req.user.userId, req.requestId, dto.reason);
  }

  @Post(':id/schedule')
  @UseGuards(RbacGuard)
  @RequireRoles('OWNER', 'ADMIN', 'MEMBER')
  async schedule(@Req() req: any, @Param('id') id: string, @Body() dto: ScheduleContentDto) {
    // The client sends localDateTime (which we treat as UTC in ISO format, per the user requirement: localDateTime as ISO string representing the instant)
    // Actually the user specified:
    // { "localDateTime": "2026-08-10T14:30:00", "timezone": "America/Sao_Paulo" }
    // We should parse it as an absolute UTC instant if it has a Z, or parse it in the given timezone.
    // However, JS Date parsing of "2026-08-10T14:30:00" depends on local machine.
    // Better to just accept scheduledFor as a full ISO UTC string in the DTO, but the user requested:
    // "Ou aceitar ISO com offset, mas não misturar os dois formatos. O backend deve transformar para UTC e persistir: scheduledFor: instante UTC; timezone: zona IANA"
    // I will expect the frontend to send `localDateTime` as a valid ISO-8601 with offset (e.g. "2026-08-10T14:30:00-03:00") and a `timezone` IANA string.
    return this.scheduleContentUseCase.execute({
      contentRequestId: id,
      tenantId: req.tenantScope.tenantId,
      userId: req.user.userId,
      requestId: req.requestId,
      scheduledFor: dto.localDateTime,
      timezone: dto.timezone,
    });
  }

  @Patch(':id/schedule')
  @UseGuards(RbacGuard)
  @RequireRoles('OWNER', 'ADMIN', 'MEMBER')
  async reschedule(@Req() req: any, @Param('id') id: string, @Body() dto: ScheduleContentDto) {
    return this.rescheduleContentUseCase.execute({
      contentRequestId: id,
      tenantId: req.tenantScope.tenantId,
      userId: req.user.userId,
      requestId: req.requestId,
      scheduledFor: dto.localDateTime,
      timezone: dto.timezone,
    });
  }

  @Post(':id/schedule/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RbacGuard)
  @RequireRoles('OWNER', 'ADMIN', 'MEMBER')
  async cancelSchedule(@Req() req: any, @Param('id') id: string, @Body() dto: CancelContentScheduleDto) {
    return this.cancelScheduleUseCase.execute({
      contentRequestId: id,
      tenantId: req.tenantScope.tenantId,
      userId: req.user.userId,
      requestId: req.requestId,
      reason: dto.reason,
    });
  }

  @Get(':id/schedule')
  async getSchedule(@Req() req: any, @Param('id') id: string) {
    const schedule = await this.getScheduleUseCase.execute({
      contentRequestId: id,
      tenantId: req.tenantScope.tenantId,
      userId: req.user.userId,
    });
    return schedule || null;
  }

  @Get()
  async list(@Req() req: any, @Query('status') status?: string) {
    return this.listUseCase.execute(req.tenantScope.tenantId, status as any);
  }

  @Get(':id')
  async get(@Req() req: any, @Param('id') id: string) {
    return this.getUseCase.execute(id, req.tenantScope.tenantId);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateContentDto) {
    return this.updateUseCase.execute({
      id,
      tenantId: req.tenantScope.tenantId,
      ...dto,
    });
  }

  @Post(':id/archive')
  async archive(@Req() req: any, @Param('id') id: string) {
    await this.archiveUseCase.execute(id, req.tenantScope.tenantId);
    return { success: true };
  }
}
