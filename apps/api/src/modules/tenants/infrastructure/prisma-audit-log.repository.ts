import { Injectable } from '@nestjs/common';
import { AuditLogRepository } from '../application/ports/audit-log.repository';
import { Prisma } from '@projeto/database';

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository {
  async append(tx: Prisma.TransactionClient, data: {
    action: string;
    entity: string;
    entityId: string;
    actorId: string;
    tenantId?: string;
    requestId?: string;
    metadata?: any;
  }): Promise<void> {
    await tx.auditLog.create({
      data: {
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        actorId: data.actorId,
        tenantId: data.tenantId,
        requestId: data.requestId,
        metadata: data.metadata || {},
      },
    });
  }
}
