import { Injectable } from '@nestjs/common';
import { MembershipRepository } from '../application/ports/membership.repository';
import { Prisma } from '@projeto/database';

@Injectable()
export class PrismaMembershipRepository implements MembershipRepository {
  async findByUserAndTenant(tx: Prisma.TransactionClient, userId: string, tenantId: string): Promise<any | null> {
    return await tx.membership.findFirst({
      where: { userId, tenantId },
      include: { tenant: true },
    });
  }

  async create(tx: Prisma.TransactionClient, data: { userId: string; tenantId: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' }): Promise<any> {
    return await tx.membership.create({
      data: {
        userId: data.userId,
        tenantId: data.tenantId,
        role: data.role,
        status: 'ACTIVE',
      },
    });
  }
}
