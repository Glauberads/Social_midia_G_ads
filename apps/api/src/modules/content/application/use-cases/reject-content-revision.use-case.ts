import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, RevisionStatus } from '@projeto/database';
import { TenantTransactionService } from '../../../tenants/application/services/tenant-transaction.service';

@Injectable()
export class RejectContentRevisionUseCase {
  constructor(private readonly transaction: TenantTransactionService) {}

  async execute(contentRequestId: string, revisionId: string, tenantId: string, userId: string, requestId: string, reason: string) {
    const sanitizedReason = sanitizeRejectionReason(reason);
    return this.transaction.execute({ tenantId, userId } as any, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ContentRequest" WHERE id = ${contentRequestId}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
      const request = await tx.contentRequest.findFirst({ where: { id: contentRequestId, tenantId } });
      if (!request) throw new NotFoundException('CONTENT_NOT_FOUND');
      if (request.status !== ContentStatus.READY) throw new ConflictException('CONTENT_NOT_READY_FOR_REJECTION');
      const revision = await tx.contentRevision.findFirst({ where: { id: revisionId, contentRequestId, tenantId } });
      if (!revision) throw new NotFoundException('REVISION_NOT_FOUND');
      if (revision.status !== RevisionStatus.DRAFT) throw new ConflictException('REVISION_NOT_ACTIVE');

      const rejected = await tx.contentRevision.update({ where: { id: revision.id }, data: { status: RevisionStatus.REJECTED, rejectionReason: sanitizedReason } });
      await tx.contentRequest.update({ where: { id: request.id }, data: { status: ContentStatus.REJECTED } });
      await tx.auditLog.create({ data: { tenantId, actorId: userId, action: 'CONTENT_REVISION_REJECTED', entity: 'ContentRevision', entityId: revision.id, requestId, metadata: { version: revision.version, reason: sanitizedReason } } });
      return rejected;
    });
  }
}

export function sanitizeRejectionReason(reason: string): string {
  return Array.from(reason.trim(), (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  }).join('').replace(/\s+/g, ' ').slice(0, 500);
}
