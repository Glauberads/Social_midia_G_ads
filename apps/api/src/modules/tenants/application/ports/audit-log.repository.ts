export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');

export interface AuditLogRepository {
  append(data: {
    action: string;
    entity: string;
    entityId: string;
    actorId: string;
    tenantId?: string;
    requestId?: string;
    metadata?: any;
  }, tx?: any): Promise<void>;
}
