import { Injectable } from '@nestjs/common';
import { InvitationRepository } from '../application/ports/invitation.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { Invitation, Prisma } from '@prisma/client';
import { TenantScope } from '../../tenants/domain/tenant.types';

@Injectable()
export class PrismaInvitationRepository implements InvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(scope: TenantScope, data: Prisma.InvitationUncheckedCreateInput): Promise<Invitation> {
    return this.prisma.invitation.create({
      data: {
        ...data,
        tenantId: scope.tenantId,
        invitedById: scope.userId,
      }
    });
  }

  async findPendingById(scope: TenantScope, id: string): Promise<Invitation | null> {
    return this.prisma.invitation.findUnique({
      where: { id, tenantId: scope.tenantId, status: 'PENDING' }
    });
  }

  async findPendingByTokenHashForUpdate(tokenHash: string, tx: Prisma.TransactionClient): Promise<Invitation | null> {
    const rows = await tx.$queryRaw<Invitation[]>`
      SELECT * FROM "Invitation"
      WHERE "tokenHash" = ${tokenHash}
      FOR UPDATE
    `;
    return rows.length > 0 ? rows[0] : null;
  }

  async list(scope: TenantScope): Promise<Invitation[]> {
    return this.prisma.invitation.findMany({
      where: { tenantId: scope.tenantId },
      orderBy: { createdAt: 'desc' }
    });
  }
}
