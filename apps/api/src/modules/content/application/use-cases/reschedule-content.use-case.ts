import { Injectable, Inject } from '@nestjs/common';
import { ContentScheduleRepository } from '../../domain/repositories/content-schedule.repository';
import { TenantTransactionService } from '../../../../modules/tenants/application/services/tenant-transaction.service';
import { ContentScheduleModel, ScheduleStatus } from '../../domain/models/content-schedule.model';

export interface RescheduleContentCommand {
  tenantId: string;
  userId: string;
  contentRequestId: string;
  scheduledFor: string; // ISO UTC string
  timezone: string;     // IANA
  requestId?: string;
}

@Injectable()
export class RescheduleContentUseCase {
  constructor(
    private readonly scheduleRepository: ContentScheduleRepository,
    private readonly transactionService: TenantTransactionService,
  ) {}

  async execute(command: RescheduleContentCommand): Promise<ContentScheduleModel> {
    const { tenantId, userId, contentRequestId, scheduledFor, timezone, requestId } = command;

    // Validate timezone
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch (e) {
      throw new Error("INVALID_TIMEZONE");
    }

    const scheduledForDate = new Date(scheduledFor);
    if (isNaN(scheduledForDate.getTime())) {
      throw new Error("INVALID_DATE");
    }

    if (scheduledForDate <= new Date()) {
      throw new Error("PAST_DATE_NOT_ALLOWED");
    }

    const scheduledMinute = new Date(scheduledForDate);
    scheduledMinute.setSeconds(0, 0);

    return this.transactionService.execute({ tenantId, userId } as any, async (tx) => {
      // Find existing active schedule
      const existing = await this.scheduleRepository.findActiveByContentRequestId(contentRequestId, tenantId, tx);
      if (!existing) {
        throw new Error("SCHEDULE_NOT_FOUND");
      }
      
      if (existing.status !== ScheduleStatus.SCHEDULED) {
        throw new Error("ONLY_SCHEDULED_CAN_BE_RESCHEDULED");
      }

      // Update schedule
      const updated = await this.scheduleRepository.update(existing.id, tenantId, {
        scheduledFor: scheduledForDate,
        scheduledMinute,
        timezone,
      }, tx);

      // Audit Log
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: userId,
          action: 'CONTENT_RESCHEDULED',
          entity: 'ContentSchedule',
          entityId: updated.id,
          requestId,
          metadata: { 
            oldScheduledFor: existing.scheduledFor.toISOString(),
            newScheduledFor: scheduledForDate.toISOString(), 
            timezone 
          }
        }
      });

      return updated;
    });
  }
}
