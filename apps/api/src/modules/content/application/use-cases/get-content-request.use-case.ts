import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentRequestRepository } from '../../domain/repositories/content-request.repository';
import { TenantTransactionService } from '../../../../modules/tenants/application/services/tenant-transaction.service';

@Injectable()
export class GetContentRequestUseCase {
  constructor(
    private readonly repository: ContentRequestRepository,
    private readonly transactionService: TenantTransactionService,
  ) {}

  async execute(id: string, tenantId: string) {
    return this.transactionService.execute({ tenantId } as any, async (tx) => {
      const result = await this.repository.findById(id, tenantId, tx);
      if (!result) throw new NotFoundException('CONTENT_NOT_FOUND');
      const latestGeneration = await tx.contentGeneration.findFirst({
        where: { contentRequestId: id, tenantId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, status: true, provider: true, model: true, promptVersion: true,
          attempt: true, errorCode: true, errorMessage: true, startedAt: true,
          completedAt: true, createdAt: true,
          generatedContent: { select: { caption: true, callToAction: true, hashtags: true, version: true, createdAt: true } },
        },
      });
      return { ...result, latestGeneration };
    });
  }
}
