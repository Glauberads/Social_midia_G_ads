import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@projeto/database';
import { TenantScope } from '../../domain/tenant.types';

@Injectable()
export class TenantTransactionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Executes a callback within a PostgreSQL interactive transaction with RLS context applied.
   */
  async execute<T>(
    scope: TenantScope,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // Set RLS context variables for this transaction
      if (scope.tenantId) {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${scope.tenantId}, true)`;
      }
      if (scope.userId) {
        await tx.$executeRaw`SELECT set_config('app.user_id', ${scope.userId}, true)`;
      }
      
      // Execute the business logic
      return fn(tx);
    });
  }

  /**
   * For Global flows (no tenantId).
   */
  async executeGlobal<T>(
    userId: string | null,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      if (userId) {
        await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      }
      return fn(tx);
    });
  }
}
