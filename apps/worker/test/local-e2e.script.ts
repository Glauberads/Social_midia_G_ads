import 'dotenv/config';
import { randomUUID } from 'crypto';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { ContentPlatform, ContentStatus, GenerationStatus, PrismaClient } from '@projeto/database';
import { CONTENT_GENERATION_QUEUE, startWorker } from '../src';

async function waitFor<T>(read: () => Promise<T>, accept: (value: T) => boolean, timeoutMs = 20_000): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await read();
    if (accept(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('E2E_TIMEOUT');
}

async function main() {
  process.env.AI_PROVIDER = 'fake';
  process.env.NODE_ENV = 'test';
  const prisma = new PrismaClient();
  const userId = randomUUID();
  const tenantId = randomUUID();
  const requestId = randomUUID();
  const firstGenerationId = randomUUID();
  const redis = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });
  const queue = new Queue(CONTENT_GENERATION_QUEUE, { connection: redis, prefix: process.env.QUEUE_PREFIX || 'glauberads:development' });
  let runtime: Awaited<ReturnType<typeof startWorker>> | undefined;

  try {
    await prisma.$executeRaw`INSERT INTO auth.users (id, instance_id, email, aud, role, encrypted_password, created_at, updated_at) VALUES (${userId}::uuid, '00000000-0000-0000-0000-000000000000', ${`worker-${userId}@e2e.local`}, 'authenticated', 'authenticated', 'pass', NOW(), NOW())`;
    await prisma.userProfile.upsert({ where: { id: userId }, create: { id: userId, email: `worker-${userId}@e2e.local` }, update: {} });
    await prisma.tenant.create({ data: { id: tenantId, name: 'Worker E2E', slug: `worker-e2e-${tenantId}` } });
    await prisma.membership.create({ data: { userId, tenantId, role: 'OWNER' } });
    await prisma.contentRequest.create({ data: { id: requestId, tenantId, createdById: userId, title: 'E2E fake', briefing: 'Crie uma legenda determinística para o teste ponta a ponta.', objective: 'conhecer o produto', platform: ContentPlatform.INSTAGRAM_FEED, status: ContentStatus.SUBMITTED } });
    await prisma.contentGeneration.create({ data: { id: firstGenerationId, tenantId, contentRequestId: requestId, requestedById: userId, provider: 'fake', model: 'fake-v1', promptVersion: 'pt-BR-v1', idempotencyKey: `e2e-${firstGenerationId}` } });

    runtime = await startWorker();
    await queue.add(CONTENT_GENERATION_QUEUE, { generationId: firstGenerationId, tenantId, contentRequestId: requestId, requestedById: userId, requestId: 'worker-e2e-success' }, { jobId: `e2e-${firstGenerationId}`, attempts: 3, backoff: { type: 'exponential', delay: 100 } });
    const ready = await waitFor(() => prisma.contentRequest.findUnique({ where: { id: requestId }, include: { generatedContents: true } }), (value) => value?.status === ContentStatus.READY);
    if (!ready || ready.generatedContents.length !== 1) throw new Error('SUCCESS_RESULT_NOT_PERSISTED');

    await runtime.worker.close(); await runtime.connection.quit(); await runtime.prisma.$disconnect();
    runtime = await startWorker();
    const duplicateJob = await queue.add(CONTENT_GENERATION_QUEUE, { generationId: firstGenerationId, tenantId, contentRequestId: requestId, requestedById: userId, requestId: 'worker-e2e-duplicate-after-restart' }, { jobId: `e2e-duplicate-${firstGenerationId}`, attempts: 3 });
    await waitFor(() => duplicateJob.getState(), (state) => state === 'completed');
    if (await prisma.generatedContent.count({ where: { contentRequestId: requestId } }) !== 1) throw new Error('DUPLICATE_DELIVERY_CREATED_VERSION');

    await prisma.contentRequest.update({ where: { id: requestId }, data: { status: ContentStatus.SUBMITTED, briefing: '[[fake:permanent]]' } });
    const failedGeneration = await prisma.contentGeneration.create({ data: { tenantId, contentRequestId: requestId, requestedById: userId, provider: 'fake', model: 'fake-v1', promptVersion: 'pt-BR-v1', idempotencyKey: `e2e-failed-${requestId}` } });
    await queue.add(CONTENT_GENERATION_QUEUE, { generationId: failedGeneration.id, tenantId, contentRequestId: requestId, requestedById: userId, requestId: 'worker-e2e-failure' }, { jobId: `e2e-failed-${requestId}`, attempts: 3 });
    await waitFor(() => prisma.contentGeneration.findUnique({ where: { id: failedGeneration.id } }), (value) => value?.status === GenerationStatus.FAILED);

    await prisma.contentRequest.update({ where: { id: requestId }, data: { status: ContentStatus.SUBMITTED, briefing: 'Retry válido e determinístico.' } });
    const retryGeneration = await prisma.contentGeneration.create({ data: { tenantId, contentRequestId: requestId, requestedById: userId, provider: 'fake', model: 'fake-v1', promptVersion: 'pt-BR-v1', idempotencyKey: `e2e-retry-${requestId}` } });
    await queue.add(CONTENT_GENERATION_QUEUE, { generationId: retryGeneration.id, tenantId, contentRequestId: requestId, requestedById: userId, requestId: 'worker-e2e-retry' }, { jobId: `e2e-retry-${requestId}`, attempts: 3 });
    await waitFor(() => prisma.contentGeneration.findUnique({ where: { id: retryGeneration.id } }), (value) => value?.status === GenerationStatus.SUCCEEDED);
    const versions = await prisma.generatedContent.findMany({ where: { contentRequestId: requestId }, orderBy: { version: 'asc' } });
    if (versions.length !== 2 || versions[0].version !== 1 || versions[1].version !== 2) throw new Error('VERSION_IDEMPOTENCY_FAILED');

    await prisma.contentRequest.update({ where: { id: requestId }, data: { status: ContentStatus.SUBMITTED, briefing: '[[fake:transient]]' } });
    const transientGeneration = await prisma.contentGeneration.create({ data: { tenantId, contentRequestId: requestId, requestedById: userId, provider: 'fake', model: 'fake-v1', promptVersion: 'pt-BR-v1', idempotencyKey: `e2e-transient-${requestId}` } });
    await queue.add(CONTENT_GENERATION_QUEUE, { generationId: transientGeneration.id, tenantId, contentRequestId: requestId, requestedById: userId, requestId: 'worker-e2e-transient' }, { jobId: `e2e-transient-${requestId}`, attempts: 3, backoff: { type: 'exponential', delay: 100 } });
    const exhausted = await waitFor(() => prisma.contentGeneration.findUnique({ where: { id: transientGeneration.id } }), (value) => value?.status === GenerationStatus.FAILED);
    if (!exhausted || exhausted.attempt !== 3) throw new Error('TRANSIENT_RETRY_COUNT_FAILED');
    console.log(JSON.stringify({ result: 'ok', success: true, restartSafe: true, duplicateSafe: true, terminalFailure: true, retry: true, transientAttempts: exhausted.attempt, versions: versions.length }));
  } finally {
    await queue.close();
    if (runtime) { await runtime.worker.close(); await runtime.connection.quit(); await runtime.prisma.$disconnect(); }
    if (redis.status !== 'end') await redis.quit();
    await prisma.generatedContent.deleteMany({ where: { tenantId } });
    await prisma.contentGeneration.deleteMany({ where: { tenantId } });
    await prisma.auditLog.deleteMany({ where: { tenantId } }).catch(() => undefined);
    await prisma.contentRequest.deleteMany({ where: { tenantId } });
    await prisma.membership.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.userProfile.deleteMany({ where: { id: userId } });
    await prisma.$executeRaw`DELETE FROM auth.users WHERE id = ${userId}::uuid`;
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'E2E_FAILED'); process.exitCode = 1; });
