import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentRequestRepository } from '../../domain/repositories/content-request.repository';
import { TenantTransactionService } from '../../../../modules/tenants/application/services/tenant-transaction.service';
import { ContentRequestModel } from '../../domain/models/content-request.model';

@Injectable()
export class GetContentRequestUseCase {
  constructor(
    private readonly repository: ContentRequestRepository,
    private readonly transactionService: TenantTransactionService,
  ) {}

  async execute(id: string, tenantId: string): Promise<ContentRequestModel> {
    return this.transactionService.execute({ tenantId } as any, async (tx) => {
      const result = await this.repository.findById(id, tenantId, tx);
      if (!result) throw new NotFoundException('CONTENT_NOT_FOUND');
      return result;
    });
  }
}
