import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const CONTENT_GENERATION_QUEUE = 'content-generation';

export interface ContentGenerationJob {
  generationId: string;
  tenantId: string;
  contentRequestId: string;
  requestedById: string;
  requestId: string;
}

@Injectable()
export class ContentGenerationQueue implements OnModuleDestroy {
  private readonly connection: IORedis;
  private readonly queue: Queue<ContentGenerationJob>;

  constructor(config: ConfigService) {
    this.connection = new IORedis(config.getOrThrow<string>('REDIS_URL'), {
      enableReadyCheck: true,
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });
    this.queue = new Queue(CONTENT_GENERATION_QUEUE, {
      connection: this.connection,
      prefix: config.get<string>('QUEUE_PREFIX', 'glauberads:development'),
      defaultJobOptions: {
        attempts: config.get<number>('GENERATION_MAX_ATTEMPTS', 3),
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: { age: 3_600, count: 500 },
        removeOnFail: { age: 604_800, count: 1_000 },
      },
    });
  }

  async enqueue(payload: ContentGenerationJob, idempotencyKey: string): Promise<void> {
    await this.queue.add(CONTENT_GENERATION_QUEUE, payload, { jobId: idempotencyKey });
  }

  async ping(): Promise<void> {
    if (this.connection.status === 'wait') await this.connection.connect();
    const pong = await this.connection.ping();
    if (pong !== 'PONG') throw new Error('REDIS_UNAVAILABLE');
    await this.queue.getJobCounts('waiting', 'active', 'failed');
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    if (this.connection.status !== 'end') await this.connection.quit();
  }
}
