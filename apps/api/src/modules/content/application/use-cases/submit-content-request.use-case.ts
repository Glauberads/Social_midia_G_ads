import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerationStatus } from '@projeto/database';
import { TenantTransactionService } from '../../../tenants/application/services/tenant-transaction.service';
import { ContentStatus } from '../../domain/models/content-request.model';
import { ContentGenerationQueue } from '../../infrastructure/queue/content-generation.queue';

interface SubmitCommand {
  contentRequestId: string;
  tenantId: string;
  userId: string;
  requestId: string;
  retryFailed?: boolean;
}

@Injectable()
export class SubmitContentRequestUseCase {
  constructor(
    private readonly transaction: TenantTransactionService,
    private readonly queue: ContentGenerationQueue,
    private readonly config: ConfigService,
  ) {}

  async execute(command: SubmitCommand) {
    const scope = { tenantId: command.tenantId, userId: command.userId };
    const created = await this.transaction.execute<any>(scope as any, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ContentRequest" WHERE id = ${command.contentRequestId}::uuid AND "tenantId" = ${command.tenantId}::uuid FOR UPDATE`;
      const request = await tx.contentRequest.findFirst({ where: { id: command.contentRequestId, tenantId: command.tenantId } });
      if (!request) throw new NotFoundException('CONTENT_NOT_FOUND');

      if (request.status === ContentStatus.SUBMITTED || request.status === ContentStatus.GENERATING) {
        const existing = await tx.contentGeneration.findFirst({
          where: { contentRequestId: request.id, tenantId: command.tenantId, status: { in: [GenerationStatus.QUEUED, GenerationStatus.PROCESSING] } },
          orderBy: { createdAt: 'desc' },
        });
        if (existing) return { generation: existing, previousStatus: request.status, idempotent: true };
      }

      const allowed = command.retryFailed
        ? request.status === ContentStatus.FAILED
        : request.status === ContentStatus.DRAFT || request.status === ContentStatus.REJECTED;
      if (!allowed) throw new ConflictException('INVALID_CONTENT_STATUS_TRANSITION');

      const generationNumber = (await tx.contentGeneration.count({ where: { contentRequestId: request.id } })) + 1;
      const idempotencyKey = `content-generation-${request.id}-${generationNumber}`;
      const generation = await tx.contentGeneration.create({
        data: {
          tenantId: command.tenantId,
          contentRequestId: request.id,
          requestedById: command.userId,
          provider: this.config.get<string>('AI_PROVIDER', 'fake'),
          model: this.config.get<string>('AI_MODEL', 'fake-v1'),
          promptVersion: 'pt-BR-v1',
          idempotencyKey,
        },
      });
      await tx.contentRequest.update({ where: { id: request.id }, data: { status: ContentStatus.SUBMITTED } });
      return { generation, previousStatus: request.status, idempotent: false };
    });

    if (!created.idempotent) {
      try {
        await this.queue.enqueue({
          generationId: created.generation.id,
          tenantId: command.tenantId,
          contentRequestId: command.contentRequestId,
          requestedById: command.userId,
          requestId: command.requestId,
        }, created.generation.idempotencyKey);
      } catch {
        await this.compensate(command, created.generation.id, created.previousStatus as ContentStatus);
        throw new ServiceUnavailableException('GENERATION_QUEUE_UNAVAILABLE');
      }
    }

    return {
      generationId: created.generation.id,
      status: created.generation.status,
      idempotent: created.idempotent,
    };
  }

  private async compensate(command: SubmitCommand, generationId: string, previousStatus: ContentStatus) {
    await this.transaction.execute({ tenantId: command.tenantId, userId: command.userId } as any, async (tx) => {
      const generation = await tx.contentGeneration.findFirst({ where: { id: generationId, tenantId: command.tenantId } });
      if (!generation || generation.status !== GenerationStatus.QUEUED) return;
      await tx.contentGeneration.delete({ where: { id: generationId } });
      await tx.contentRequest.updateMany({
        where: { id: command.contentRequestId, tenantId: command.tenantId, status: ContentStatus.SUBMITTED },
        data: { status: previousStatus },
      });
    });
  }
}
