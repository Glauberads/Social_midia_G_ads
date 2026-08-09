import { Prisma } from '@projeto/database';

export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');

export interface AuditLogRepository {
  append(tx: Prisma.TransactionClient, data: {
    action: string;
    entity: string;
    entityId: string;
    actorId: string;
    tenantId?: string;
    requestId?: string;
    metadata?: any;
  }): Promise<void>;
}
