import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';
import { HealthIndicatorResult } from '@nestjs/terminus';
import { ContentGenerationQueue } from '../content/infrastructure/queue/content-generation.queue';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: PrismaHealthIndicator,
    private prisma: PrismaService,
    private queue: ContentGenerationQueue,
  ) {}

  @Get('live')
  @Public()
  @HealthCheck()
  checkLive() {
    return { status: 'ok', message: 'Service is alive' };
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  checkReady() {
    return this.health.check([
      () => this.db.pingCheck('database', this.prisma),
      async (): Promise<HealthIndicatorResult> => {
        try {
          await this.queue.ping();
          return { redis: { status: 'up' }, queue: { status: 'up' } };
        } catch {
          throw new Error('Redis or generation queue is unavailable');
        }
      },
    ]);
  }
}
