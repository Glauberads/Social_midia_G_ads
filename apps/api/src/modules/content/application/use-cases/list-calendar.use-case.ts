import { Injectable } from '@nestjs/common';
import { ContentScheduleRepository } from '../../domain/repositories/content-schedule.repository';
import { TenantTransactionService } from '../../../../modules/tenants/application/services/tenant-transaction.service';
import { ContentScheduleModel } from '../../domain/models/content-schedule.model';

export interface ListCalendarQuery {
  tenantId: string;
  userId: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
}

@Injectable()
export class ListCalendarUseCase {
  constructor(
    private readonly scheduleRepository: ContentScheduleRepository,
    private readonly transactionService: TenantTransactionService,
  ) {}

  async execute(query: ListCalendarQuery): Promise<ContentScheduleModel[]> {
    const { tenantId, userId, startDate, endDate } = query;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("INVALID_DATE_RANGE");
    }

    if (start > end) {
      throw new Error("START_DATE_AFTER_END_DATE");
    }

    // Limit interval to max 60 days
    const diffMs = end.getTime() - start.getTime();
    if (diffMs > 60 * 24 * 60 * 60 * 1000) {
      throw new Error("EXCESSIVE_DATE_RANGE");
    }

    return this.transactionService.execute({ tenantId, userId } as any, async (tx) => {
      return this.scheduleRepository.findMany(tenantId, start, end, tx);
    });
  }
}
