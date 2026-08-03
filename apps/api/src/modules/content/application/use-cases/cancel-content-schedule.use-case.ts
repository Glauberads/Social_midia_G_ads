import { Injectable, Inject } from '@nestjs/common';
import { ContentScheduleRepository } from '../../domain/repositories/content-schedule.repository';
import { TenantTransactionService } from '../../../../modules/tenants/application/services/tenant-transaction.service';
import { ContentScheduleModel, ScheduleStatus } from '../../domain/models/content-schedule.model';

export interface CancelContentScheduleCommand {
  tenantId: string;
  userId: string;
  contentRequestId: string;
  reason?: string;
  requestId?: string;
}

@Injectable()
export class CancelContentScheduleUseCase {
  constructor(
    private readonly scheduleRepository: ContentScheduleRepository,
    private readonly transactionService: TenantTransactionService,
  ) {}

  async execute(command: CancelContentScheduleCommand): Promise<ContentScheduleModel> {
    const { tenantId, userId, contentRequestId, reason, requestId } = command;

    return this.transactionService.execute({ tenantId, userId } as any, async (tx) => {
      // Find existing schedule
      const existing = await this.scheduleRepository.findActiveByContentRequestId(contentRequestId, tenantId, tx);
      
      // If already canceled or not found, just return (or throw if you want, but idempotency means returning success if already canceled)
      // Actually we will fetch the latest one to see if it's already canceled. 
      // `findActiveByContentRequestId` only returns SCHEDULED or DUE. 
      if (!existing) {
        throw new Error("SCHEDULE_NOT_FOUND");
      }
      
      if (existing.status !== ScheduleStatus.SCHEDULED) {
         throw new Error("ONLY_SCHEDULED_CAN_BE_CANCELED");
      }

      // Update schedule
      const updated = await this.scheduleRepository.update(existing.id, tenantId, {
        status: ScheduleStatus.CANCELED,
        canceledAt: new Date(),
        canceledById: userId,
        cancelReason: reason || null,
      }, tx);

      // Audit Log
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: userId,
          action: 'CONTENT_SCHEDULE_CANCELED',
          entity: 'ContentSchedule',
          entityId: updated.id,
          requestId,
          metadata: { reason }
        }
      });

      return updated;
    });
  }
}
