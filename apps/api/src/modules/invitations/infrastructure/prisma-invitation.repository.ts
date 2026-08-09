import { Injectable } from '@nestjs/common';
import { InvitationRepository } from '../application/ports/invitation.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { Invitation, Prisma } from '@prisma/client';

@Injectable()
export class PrismaInvitationRepository implements InvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(tx: Prisma.TransactionClient, data: Prisma.InvitationUncheckedCreateInput): Promise<Invitation> {
    return tx.invitation.create({
      data: data
    });
  }

  async findPendingById(tx: Prisma.TransactionClient, id: string): Promise<Invitation | null> {
    return tx.invitation.findUnique({
      where: { id, status: 'PENDING' }
    });
  }

  async findPendingByTokenHashForUpdate(tx: Prisma.TransactionClient, tokenHash: string): Promise<Invitation | null> {
    const rows = await tx.$queryRaw<Invitation[]>`
      SELECT * FROM "Invitation"
      WHERE "tokenHash" = ${tokenHash}
      FOR UPDATE
    `;
    return rows.length > 0 ? rows[0] : null;
  }

  async list(tx: Prisma.TransactionClient, tenantId: string): Promise<Invitation[]> {
    return tx.invitation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });
  }
}
