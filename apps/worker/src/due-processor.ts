import { PrismaClient, Prisma } from '@projeto/database';

export class DueScheduleProcessor {
  constructor(private readonly prisma: PrismaClient) {}

  async processBatch(batchSize = 50): Promise<number> {
    // Localize IDs in a controlled way without modifying globally
    // We use queryRaw because we want to quickly find candidate IDs.
    // In many setups, the Prisma Client connected as service_role/postgres bypasses RLS.
    // We only fetch candidate IDs here. The actual mutation happens inside a tenant-scoped transaction.
    const candidates = await this.prisma.$queryRaw<{ id: string; tenantId: string }[]>`
      SELECT id, "tenantId" 
      FROM public."ContentSchedule"
      WHERE status = 'SCHEDULED' 
        AND "scheduledFor" <= now()
      LIMIT ${batchSize}
    `;

    if (!candidates || candidates.length === 0) {
      return 0;
    }

    let processedCount = 0;

    for (const candidate of candidates) {
      try {
        const processed = await this.inTenantTransaction(candidate.tenantId, async (tx) => {
          // Lock the row with FOR UPDATE SKIP LOCKED
          const rows = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM public."ContentSchedule"
            WHERE id = ${candidate.id}::uuid
              AND "tenantId" = ${candidate.tenantId}::uuid
              AND status = 'SCHEDULED'
              AND "scheduledFor" <= now()
            FOR UPDATE SKIP LOCKED
          `;

          if (rows.length === 0) {
            // Already processed by another worker or not eligible anymore
            return false;
          }

          // Mark as DUE
          await tx.contentSchedule.update({
            where: { id: candidate.id },
            data: { status: 'DUE', updatedAt: new Date() },
          });

          // Audit Log (system action, no actorId)
          await tx.auditLog.create({
            data: {
              tenantId: candidate.tenantId,
              actorId: null, // System action
              action: 'CONTENT_SCHEDULE_DUE',
              entity: 'ContentSchedule',
              entityId: candidate.id,
              metadata: { reason: 'Time arrived' },
            },
          });

          return true;
        });

        if (processed) {
          processedCount++;
        }
      } catch (err) {
        console.error(JSON.stringify({
          event: 'due_schedule_processing_failed',
          scheduleId: candidate.id,
          error: err instanceof Error ? err.message : String(err)
        }));
      }
    }

    return processedCount;
  }

  private async inTenantTransaction<T>(tenantId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      // Using a fake system ID or leaving app.user_id empty since it's a system process
      await tx.$executeRaw`SELECT set_config('app.user_id', '', true)`;
      return fn(tx);
    });
  }
}
