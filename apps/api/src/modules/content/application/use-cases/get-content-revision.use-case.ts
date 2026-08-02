import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantTransactionService } from '../../../tenants/application/services/tenant-transaction.service';

@Injectable()
export class GetContentRevisionUseCase {
  constructor(private readonly transaction: TenantTransactionService) {}

  async execute(contentRequestId: string, revisionId: string, tenantId: string) {
    return this.transaction.execute({ tenantId } as any, async (tx) => {
      const revision = await tx.contentRevision.findFirst({ where: { id: revisionId, contentRequestId, tenantId } });
      if (!revision) throw new NotFoundException('REVISION_NOT_FOUND');
      return revision;
    });
  }
}
