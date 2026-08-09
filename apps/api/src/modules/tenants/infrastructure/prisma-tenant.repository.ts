import { Injectable } from '@nestjs/common';
import { TenantRepository } from '../application/ports/tenant.repository';
import { Prisma } from '@projeto/database';

@Injectable()
export class PrismaTenantRepository implements TenantRepository {
  async findBySlug(tx: Prisma.TransactionClient, slug: string): Promise<any | null> {
    return await tx.tenant.findUnique({
      where: { slug },
    });
  }

  async create(tx: Prisma.TransactionClient, data: { name: string; slug: string }): Promise<any> {
    try {
      return await tx.tenant.create({
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

  async findUserTenants(tx: Prisma.TransactionClient, userId: string): Promise<any[]> {
    return await tx.membership.findMany({
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
