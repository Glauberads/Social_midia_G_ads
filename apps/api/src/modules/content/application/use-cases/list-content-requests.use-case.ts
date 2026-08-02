import { Injectable } from '@nestjs/common';
import { ContentRequestRepository } from '../../domain/repositories/content-request.repository';
import { TenantTransactionService } from '../../../../modules/tenants/application/services/tenant-transaction.service';
import { ContentRequestModel, ContentStatus } from '../../domain/models/content-request.model';

@Injectable()
export class ListContentRequestsUseCase {
  constructor(
    private readonly repository: ContentRequestRepository,
    private readonly transactionService: TenantTransactionService,
  ) {}

  async execute(tenantId: string, status?: ContentStatus): Promise<ContentRequestModel[]> {
    return this.transactionService.execute({ tenantId } as any, async (tx) => {
      return this.repository.findMany(tenantId, tx, { status });
    });
  }
}
