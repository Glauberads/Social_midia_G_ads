import { Injectable } from '@nestjs/common';
import { ContentScheduleRepository } from '../../domain/repositories/content-schedule.repository';
import { TenantTransactionService } from '../../../../modules/tenants/application/services/tenant-transaction.service';
import { ContentScheduleModel } from '../../domain/models/content-schedule.model';

export interface GetContentScheduleQuery {
  tenantId: string;
  userId: string;
  contentRequestId: string;
}

@Injectable()
export class GetContentScheduleUseCase {
  constructor(
    private readonly scheduleRepository: ContentScheduleRepository,
    private readonly transactionService: TenantTransactionService,
  ) {}

  async execute(query: GetContentScheduleQuery): Promise<ContentScheduleModel | null> {
    const { tenantId, userId, contentRequestId } = query;

    return this.transactionService.execute({ tenantId, userId } as any, async (tx) => {
      // Find active schedule
      const existing = await this.scheduleRepository.findActiveByContentRequestId(contentRequestId, tenantId, tx);
      return existing;
    });
  }
}
