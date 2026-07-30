import { Injectable } from '@nestjs/common';
import { AuditLogRepository } from '../application/ports/audit-log.repository';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async append(data: {
    action: string;
    entity: string;
    entityId: string;
    actorId: string;
    tenantId?: string;
    requestId?: string;
    metadata?: any;
  }, tx?: any): Promise<void> {
    const client = tx || this.prisma;
    await client.auditLog.create({
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
