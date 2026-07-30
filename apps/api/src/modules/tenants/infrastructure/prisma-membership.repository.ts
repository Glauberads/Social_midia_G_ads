import { Injectable } from '@nestjs/common';
import { MembershipRepository } from '../application/ports/membership.repository';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PrismaMembershipRepository implements MembershipRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { userId: string; tenantId: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' }, tx?: any): Promise<any> {
    const client = tx || this.prisma;
    return await client.membership.create({
      data: {
        userId: data.userId,
        tenantId: data.tenantId,
        role: data.role,
        status: 'ACTIVE',
      },
    });
  }
}
