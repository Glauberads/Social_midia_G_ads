import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, RevisionSource, RevisionStatus } from '@projeto/database';
import { TenantTransactionService } from '../../../tenants/application/services/tenant-transaction.service';

interface Command {
  contentRequestId: string;
  tenantId: string;
  userId: string;
  requestId: string;
  caption?: string;
  callToAction?: string;
  hashtags?: string[];
}

@Injectable()
export class CreateManualRevisionUseCase {
  constructor(private readonly transaction: TenantTransactionService) {}

  async execute(command: Command) {
    return this.transaction.execute({ tenantId: command.tenantId, userId: command.userId } as any, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ContentRequest" WHERE id = ${command.contentRequestId}::uuid AND "tenantId" = ${command.tenantId}::uuid FOR UPDATE`;
      const request = await tx.contentRequest.findFirst({ where: { id: command.contentRequestId, tenantId: command.tenantId } });
      if (!request) throw new NotFoundException('CONTENT_NOT_FOUND');
      if (request.status !== ContentStatus.READY && request.status !== ContentStatus.REJECTED) throw new ConflictException('INVALID_REVISION_STATUS_TRANSITION');

      const base = await tx.contentRevision.findFirst({ where: { contentRequestId: request.id, tenantId: command.tenantId }, orderBy: { version: 'desc' } });
      if (!base) throw new ConflictException('REVISION_BASE_NOT_FOUND');
      const caption = command.caption?.trim() || base.caption;
      const callToAction = command.callToAction?.trim() || base.callToAction;
      const hashtags = command.hashtags?.map((tag) => tag.trim()) || base.hashtags;

      await tx.contentRevision.updateMany({ where: { contentRequestId: request.id, tenantId: command.tenantId, status: RevisionStatus.DRAFT }, data: { status: RevisionStatus.SUPERSEDED } });
      const revision = await tx.contentRevision.create({
        data: {
          tenantId: command.tenantId,
          contentRequestId: request.id,
          generatedContentId: base.generatedContentId,
          createdById: command.userId,
          source: RevisionSource.MANUAL_EDIT,
          caption,
          callToAction,
          hashtags,
          version: base.version + 1,
        },
      });
      await tx.contentRequest.update({ where: { id: request.id }, data: { status: ContentStatus.READY } });
      await tx.auditLog.create({ data: { tenantId: command.tenantId, actorId: command.userId, action: 'CONTENT_REVISION_CREATED', entity: 'ContentRevision', entityId: revision.id, requestId: command.requestId, metadata: { version: revision.version, source: revision.source } } });
      return revision;
    });
  }
}
