import 'dotenv/config';
import { PrismaClient } from '@projeto/database';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { loadConfig } from './config';
import { ContentGenerationProcessor, ContentGenerationJob } from './processor';
import { FakeContentGenerationProvider } from './providers/fake.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';

export const CONTENT_GENERATION_QUEUE = 'content-generation';

export function createProvider(config: ReturnType<typeof loadConfig>) {
  return config.AI_PROVIDER === 'fake'
    ? new FakeContentGenerationProvider()
    : new OpenAiCompatibleProvider(config.AI_API_KEY!, config.AI_MODEL, config.AI_BASE_URL, config.AI_TIMEOUT_MS);
}

export async function startWorker() {
  const config = loadConfig();
  const prisma = new PrismaClient();
  await prisma.$connect();
  const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const processor = new ContentGenerationProcessor(prisma, createProvider(config));
  const worker = new Worker<ContentGenerationJob>(CONTENT_GENERATION_QUEUE, (job) => processor.process(job), { connection, prefix: config.QUEUE_PREFIX, concurrency: config.WORKER_CONCURRENCY, lockDuration: config.AI_TIMEOUT_MS + 15_000 });
  worker.on('ready', () => console.log(JSON.stringify({ event: 'worker_ready', queue: CONTENT_GENERATION_QUEUE })));
  worker.on('completed', (job) => console.log(JSON.stringify({ event: 'generation_completed', jobId: job.id, generationId: job.data.generationId, requestId: job.data.requestId })));
  worker.on('failed', (job, error) => console.error(JSON.stringify({ event: 'generation_failed', jobId: job?.id, generationId: job?.data.generationId, requestId: job?.data.requestId, code: error.message.slice(0, 100) })));
  const shutdown = async () => { await worker.close(); await connection.quit(); await prisma.$disconnect(); };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return { worker, prisma, connection };
}

if (require.main === module) {
  startWorker().catch(() => { console.error(JSON.stringify({ event: 'worker_bootstrap_failed' })); process.exitCode = 1; });
}
