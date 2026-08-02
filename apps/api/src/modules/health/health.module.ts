import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [TerminusModule, PrismaModule, ContentModule],
  controllers: [HealthController],
})
export class HealthModule {}
