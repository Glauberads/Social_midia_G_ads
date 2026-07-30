import { Injectable } from '@nestjs/common';
import { TenantRepository } from '../application/ports/tenant.repository';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PrismaTenantRepository implements TenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySlug(slug: string, tx?: any): Promise<any | null> {
    const client = tx || this.prisma;
    return await client.tenant.findUnique({
      where: { slug },
    });
  }

  async create(data: { name: string; slug: string }, tx?: any): Promise<any> {
    const client = tx || this.prisma;
    return await client.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        status: 'ACTIVE',
      },
    });
  }

  async findUserTenants(userId: string): Promise<any[]> {
    return await this.prisma.membership.findMany({
      where: { userId },
      include: {
        tenant: true,
      },
      orderBy: {
        tenant: {
          createdAt: 'asc',
        },
      },
    });
  }
}
