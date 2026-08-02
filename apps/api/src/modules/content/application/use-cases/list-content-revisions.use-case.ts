import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantTransactionService } from '../../../tenants/application/services/tenant-transaction.service';

@Injectable()
export class ListContentRevisionsUseCase {
  constructor(private readonly transaction: TenantTransactionService) {}

  async execute(contentRequestId: string, tenantId: string, page = 1, limit = 20) {
    return this.transaction.execute({ tenantId } as any, async (tx) => {
      const request = await tx.contentRequest.findFirst({ where: { id: contentRequestId, tenantId }, select: { id: true } });
      if (!request) throw new NotFoundException('CONTENT_NOT_FOUND');
      const where = { contentRequestId, tenantId };
      const [items, total] = await Promise.all([
        tx.contentRevision.findMany({
          where,
          orderBy: { version: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: { id: true, generatedContentId: true, createdById: true, source: true, caption: true, callToAction: true, hashtags: true, version: true, status: true, rejectionReason: true, approvedAt: true, approvedById: true, createdAt: true, updatedAt: true },
        }),
        tx.contentRevision.count({ where }),
      ]);
      return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
    });
  }
}
