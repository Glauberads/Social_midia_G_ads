import { Job, UnrecoverableError } from 'bullmq';
import { ContentStatus, GenerationStatus, Prisma, PrismaClient } from '@projeto/database';
import { ContentGenerationProvider, ProviderError } from './providers/content-generation.provider';

export interface ContentGenerationJob {
  generationId: string;
  tenantId: string;
  contentRequestId: string;
  requestedById: string;
  requestId: string;
}

export class ContentGenerationProcessor {
  constructor(private readonly prisma: PrismaClient, private readonly provider: ContentGenerationProvider) {}

  async process(job: Job<ContentGenerationJob>): Promise<void> {
    const data = job.data;
    const input = await this.inTenantTransaction(data, async (tx) => {
      const generation = await tx.contentGeneration.findFirst({ where: { id: data.generationId, tenantId: data.tenantId } });
      if (!generation || generation.status === GenerationStatus.SUCCEEDED) return null;
      if (generation.status === GenerationStatus.FAILED) return null;
      const request = await tx.contentRequest.findFirst({ where: { id: data.contentRequestId, tenantId: data.tenantId } });
      if (!request) throw new UnrecoverableError('CONTENT_REQUEST_NOT_FOUND');
      await tx.contentGeneration.update({ where: { id: generation.id }, data: { status: GenerationStatus.PROCESSING, attempt: { increment: 1 }, startedAt: generation.startedAt || new Date(), errorCode: null, errorMessage: null } });
      await tx.contentRequest.update({ where: { id: request.id }, data: { status: ContentStatus.GENERATING } });
      return { title: request.title, briefing: request.briefing, objective: request.objective, audience: request.audience, tone: request.tone, platform: request.platform as string };
    });
    if (!input) return;

    try {
      const result = await this.provider.generate(input);
      await this.inTenantTransaction(data, async (tx) => {
        const generation = await tx.contentGeneration.findFirst({ where: { id: data.generationId, tenantId: data.tenantId } });
        if (!generation || generation.status === GenerationStatus.SUCCEEDED) return;
        const existing = await tx.generatedContent.findUnique({ where: { generationId: generation.id } });
        if (!existing) {
          const version = (await tx.generatedContent.count({ where: { contentRequestId: data.contentRequestId } })) + 1;
          await tx.generatedContent.create({ data: { tenantId: data.tenantId, contentRequestId: data.contentRequestId, generationId: generation.id, version, ...result } });
        }
        const completedAt = new Date();
        await tx.contentGeneration.update({ where: { id: generation.id }, data: { status: GenerationStatus.SUCCEEDED, completedAt, errorCode: null, errorMessage: null } });
        await tx.contentRequest.update({ where: { id: data.contentRequestId }, data: { status: ContentStatus.READY } });
        await tx.auditLog.create({ data: { tenantId: data.tenantId, actorId: data.requestedById, action: 'CONTENT_GENERATION_SUCCEEDED', entity: 'ContentGeneration', entityId: generation.id, requestId: data.requestId, metadata: { promptVersion: generation.promptVersion } } });
      });
    } catch (error) {
      const providerError = error instanceof ProviderError ? error : new ProviderError('GENERATION_INTERNAL_ERROR', false, 'Generation failed');
      const configuredAttempts = typeof job.opts.attempts === 'number' ? job.opts.attempts : 1;
      const hasRetry = providerError.transient && job.attemptsMade + 1 < configuredAttempts;
      await this.inTenantTransaction(data, async (tx) => {
        await tx.contentGeneration.updateMany({ where: { id: data.generationId, tenantId: data.tenantId, status: GenerationStatus.PROCESSING }, data: { status: hasRetry ? GenerationStatus.QUEUED : GenerationStatus.FAILED, errorCode: providerError.code, errorMessage: sanitizeError(providerError.message), completedAt: hasRetry ? null : new Date() } });
        await tx.contentRequest.updateMany({ where: { id: data.contentRequestId, tenantId: data.tenantId }, data: { status: hasRetry ? ContentStatus.SUBMITTED : ContentStatus.FAILED } });
        if (!hasRetry) await tx.auditLog.create({ data: { tenantId: data.tenantId, actorId: data.requestedById, action: 'CONTENT_GENERATION_FAILED', entity: 'ContentGeneration', entityId: data.generationId, requestId: data.requestId, metadata: { errorCode: providerError.code } } });
      });
      if (!providerError.transient) throw new UnrecoverableError(providerError.code);
      throw providerError;
    }
  }

  private async inTenantTransaction<T>(data: ContentGenerationJob, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${data.tenantId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.user_id', ${data.requestedById}, true)`;
      return fn(tx);
    });
  }
}

export function sanitizeError(message: string): string {
  return message.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/[A-Za-z0-9_-]{32,}/g, '[REDACTED]').slice(0, 300);
}
