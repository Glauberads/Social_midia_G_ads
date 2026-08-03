import { Injectable } from '@nestjs/common';
import { ContentScheduleRepository } from '../../domain/repositories/content-schedule.repository';
import { TenantTransactionService } from '../../../../modules/tenants/application/services/tenant-transaction.service';
import { ContentScheduleModel, ScheduleStatus } from '../../domain/models/content-schedule.model';
import { ContentStatus } from '../../domain/models/content-request.model';
import { RevisionStatus } from '@projeto/database';

export interface ScheduleContentCommand {
  tenantId: string;
  userId: string;
  contentRequestId: string;
  scheduledFor: string; // ISO UTC string
  timezone: string;     // IANA
  requestId?: string;
}

@Injectable()
export class ScheduleContentUseCase {
  constructor(
    private readonly scheduleRepository: ContentScheduleRepository,
    private readonly transactionService: TenantTransactionService,
  ) {}

  async execute(command: ScheduleContentCommand): Promise<ContentScheduleModel> {
    const { tenantId, userId, contentRequestId, scheduledFor, timezone, requestId } = command;

    // Validate timezone
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      throw new Error("INVALID_TIMEZONE");
    }

    const scheduledForDate = new Date(scheduledFor);
    if (isNaN(scheduledForDate.getTime())) {
      throw new Error("INVALID_DATE");
    }

    if (scheduledForDate <= new Date()) {
      throw new Error("PAST_DATE_NOT_ALLOWED");
    }

    // Derive scheduledMinute
    const scheduledMinute = new Date(scheduledForDate);
    scheduledMinute.setSeconds(0, 0);

    return this.transactionService.execute({ tenantId, userId } as any, async (tx) => {
      // Validate request exists and is APPROVED
      const request = await tx.contentRequest.findFirst({
        where: { id: contentRequestId, tenantId }
      });
      if (!request) {
        throw new Error("CONTENT_REQUEST_NOT_FOUND");
      }
      if (request.status !== ContentStatus.APPROVED) {
        throw new Error("CONTENT_REQUEST_NOT_APPROVED");
      }

      // Validate revision exists and is APPROVED
      const activeRevision = await tx.contentRevision.findFirst({
        where: { contentRequestId, tenantId, status: RevisionStatus.APPROVED }
      });
      if (!activeRevision) {
        throw new Error("NO_APPROVED_REVISION");
      }

      // Ensure no active schedule exists for this content
      const existing = await this.scheduleRepository.findActiveByContentRequestId(contentRequestId, tenantId, tx);
      if (existing) {
        throw new Error("SCHEDULE_ALREADY_EXISTS");
      }

      // Create schedule
      const schedule = await this.scheduleRepository.create({
        tenantId,
        contentRequestId,
        revisionId: activeRevision.id,
        scheduledById: userId,
        status: ScheduleStatus.SCHEDULED,
        scheduledFor: scheduledForDate,
        scheduledMinute,
        timezone,
      }, tx);

      // Audit Log
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: userId,
          action: 'CONTENT_SCHEDULED',
          entity: 'ContentSchedule',
          entityId: schedule.id,
          requestId,
          metadata: { scheduledFor: scheduledForDate.toISOString(), timezone }
        }
      });

      return schedule;
    });
  }
}
