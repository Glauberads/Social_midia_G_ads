import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: PrismaHealthIndicator,
    private prisma: PrismaService,
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
    ]);
  }
}
