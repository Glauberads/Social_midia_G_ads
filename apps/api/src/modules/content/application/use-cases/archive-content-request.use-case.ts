import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentRequestRepository } from '../../domain/repositories/content-request.repository';
import { TenantTransactionService } from '../../../../modules/tenants/application/services/tenant-transaction.service';
import { ContentStatus } from '../../domain/models/content-request.model';

@Injectable()
export class ArchiveContentRequestUseCase {
  constructor(
    private readonly repository: ContentRequestRepository,
    private readonly transactionService: TenantTransactionService,
  ) {}

  async execute(id: string, tenantId: string): Promise<void> {
    return this.transactionService.execute({ tenantId } as any, async (tx) => {
      const existing = await this.repository.findById(id, tenantId, tx);
      if (!existing) throw new NotFoundException('CONTENT_NOT_FOUND');
      if (existing.status === ContentStatus.APPROVED) throw new ConflictException('APPROVED_CONTENT_IS_TERMINAL');

      if (existing.status !== ContentStatus.ARCHIVED) {
        await this.repository.update(id, tenantId, { status: ContentStatus.ARCHIVED }, tx);
      }
    });
  }
}
