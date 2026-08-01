import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../application/ports/unit-of-work';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  async executeGlobal<T>(userId: string | null, work: (tx: any) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      if (userId) {
        await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      }
      return await work(tx);
    });
  }

  async executeWithTenant<T>(tenantId: string, userId: string, work: (tx: any) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      return await work(tx);
    });
  }
}
