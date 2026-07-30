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
    try {
      return await client.tenant.create({
        data: {
          name: data.name,
          slug: data.slug,
          status: 'ACTIVE',
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('slug')) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { TenantSlugAlreadyExistsException } = require('../domain/tenant.errors');
        throw new TenantSlugAlreadyExistsException();
      }
      throw error;
    }
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
