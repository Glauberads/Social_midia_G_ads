import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantScope } from '../../tenants/domain/tenant.types';
import { Prisma } from '@projeto/database';

@Injectable()
export class PrismaMembershipRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByTenant(tx: Prisma.TransactionClient, scope: TenantScope) {
    return tx.membership.findMany({
      where: {
        tenantId: scope.tenantId,
        status: { not: 'REMOVED' },
      },
      include: {
        user: {
          select: {
            email: true,
            fullName: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(tx: Prisma.TransactionClient, scope: TenantScope, membershipId: string) {
    return tx.membership.findFirst({
      where: {
        id: membershipId,
        tenantId: scope.tenantId,
        status: { not: 'REMOVED' },
      }
    });
  }



  async countActiveOwners(tx: Prisma.TransactionClient, tenantId: string): Promise<number> {
    return tx.membership.count({
      where: {
        tenantId,
        role: 'OWNER',
        status: 'ACTIVE'
      }
    });
  }

  async getActiveOwnersForUpdate(tenantId: string, tx: Prisma.TransactionClient): Promise<any[]> {
    // Pegar lock para concorrência
    const rows = await tx.$queryRaw<{id: string}[]>`
      SELECT id FROM "Membership"
      WHERE "tenantId" = ${tenantId}::uuid
        AND "role" = 'OWNER'
        AND "status" = 'ACTIVE'
      ORDER BY id
      FOR UPDATE
    `;
    return rows;
  }
}
