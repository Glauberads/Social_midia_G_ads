import { PrismaClient, Prisma, SocialConnectionStatus, SocialConnectionErrorCategory } from '@projeto/database';
import crypto from 'crypto';
import { loadConfig, isMetaConfigured } from '../config';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

export class SocialConnectionHealthProcessor {
  private config = loadConfig();

  constructor(private readonly prisma: PrismaClient) {}

  async processBatch(batchSize = 50): Promise<number> {
    if (!isMetaConfigured(this.config)) {
      // Integration is not configured, we shouldn't attempt to process Meta jobs
      return 0;
    }

    const candidates = await this.prisma.$queryRaw<{ id: string; tenantId: string }[]>`
      SELECT id, "tenantId"
      FROM public.get_social_connection_health_candidates(${batchSize})
    `;

    if (!candidates || candidates.length === 0) {
      return 0;
    }

    let processedCount = 0;

    for (const candidate of candidates) {
      const lockToken = crypto.randomUUID();
      let snapshot: { id: string; status: SocialConnectionStatus; refreshFailureCount: number; accessTokenEncrypted: string | null; tokenExpiresAt: Date | null; nextRefreshAt: Date | null } | null = null;

      try {
        // 1. FASE DE CLAIM
        const claimResult = await this.inTenantTransaction(candidate.tenantId, async (tx) => {
          const locked = await tx.$executeRaw`
            UPDATE public.social_connections
            SET "processingLockedUntil" = now() + interval '5 minutes',
                "processingLockToken" = ${lockToken}::uuid
            WHERE id = ${candidate.id}::uuid
              AND ("processingLockedUntil" IS NULL OR "processingLockedUntil" <= now())
          `;

          if (locked === 0) return null; // locked by another worker

          const conn = await tx.socialConnection.findUnique({
            where: { id: candidate.id },
            select: { id: true, status: true, refreshFailureCount: true, accessTokenEncrypted: true, tokenExpiresAt: true, nextRefreshAt: true }
          });
          return conn;
        });

        if (!claimResult) {
          continue; // Claim perdido
        }

        snapshot = claimResult;

        if (!snapshot.accessTokenEncrypted || snapshot.status !== 'CONNECTED') {
          // Precisamos liberar o lock já que não vamos processar
          await this.releaseLock(candidate.tenantId, snapshot.id, lockToken);
          processedCount++;
          continue;
        }

        const accessToken = this.decryptToken(snapshot.accessTokenEncrypted);
        const isEligibleForRefresh = snapshot.nextRefreshAt && snapshot.nextRefreshAt <= new Date();

        // 2. FASE DE NETWORK (Fora da transaction)
        if (isEligibleForRefresh) {
          await this.handleRefresh(candidate.tenantId, snapshot, accessToken, lockToken);
        } else {
          await this.handleValidate(candidate.tenantId, snapshot, accessToken, lockToken);
        }
        processedCount++;
      } catch (err) {
        console.error(JSON.stringify({
          event: 'social_connection_processing_failed',
          connectionId: candidate.id,
          error: err instanceof Error ? err.message : String(err)
        }));
        if (snapshot) {
          // Tentar persistir a falha em nova transação curta
          await this.handleError(candidate.tenantId, snapshot, lockToken, err);
          processedCount++; // Tentado e falhado
        }
      }
    }

    return processedCount;
  }

  private async releaseLock(tenantId: string, connectionId: string, lockToken: string) {
    await this.inTenantTransaction(tenantId, async (tx) => {
      await tx.$executeRaw`
        UPDATE public.social_connections
        SET "processingLockedUntil" = NULL,
            "processingLockToken" = NULL
        WHERE id = ${connectionId}::uuid
          AND "processingLockToken" = ${lockToken}::uuid
      `;
    });
  }

  private async handleValidate(tenantId: string, conn: { id: string; status: SocialConnectionStatus; refreshFailureCount: number; accessTokenEncrypted: string | null; tokenExpiresAt: Date | null }, accessToken: string, lockToken: string) {
    const res = await fetch(`https://graph.facebook.com/${this.config.META_GRAPH_API_VERSION!}/me?fields=id,name&access_token=${accessToken}`);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw Object.assign(new Error(`Validation failed: ${res.status}`), {
        status: res.status,
        graphErrorCode: body?.error?.code,
        graphErrorSubcode: body?.error?.error_subcode,
      });
    }

    await this.inTenantTransaction(tenantId, async (tx) => {
      await tx.$executeRaw`
        UPDATE public.social_connections
        SET "lastValidatedAt" = NOW(),
            "refreshFailureCount" = 0,
            "lastErrorAt" = NULL,
            "lastErrorCategory" = NULL,
            "lastErrorCode" = NULL,
            "processingLockedUntil" = NULL,
            "processingLockToken" = NULL
        WHERE id = ${conn.id}::uuid
          AND "processingLockToken" = ${lockToken}::uuid
      `;
    });
  }

  private async handleRefresh(tenantId: string, conn: { id: string; status: SocialConnectionStatus; refreshFailureCount: number; accessTokenEncrypted: string | null; tokenExpiresAt: Date | null }, accessToken: string, lockToken: string) {
    const now = new Date();
    // Update last refresh attempt (Ownership-safe)
    await this.inTenantTransaction(tenantId, async (tx) => {
      await tx.$executeRaw`
        UPDATE public.social_connections
        SET "lastRefreshAttemptAt" = ${now}::timestamp
        WHERE id = ${conn.id}::uuid
          AND "processingLockToken" = ${lockToken}::uuid
      `;
    });

    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.config.META_APP_ID!,
      client_secret: this.config.META_APP_SECRET!,
      fb_exchange_token: accessToken,
    });

    const res = await fetch(`https://graph.facebook.com/${this.config.META_GRAPH_API_VERSION!}/oauth/access_token?${params}`);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw Object.assign(new Error(`Refresh failed: ${res.status}`), {
        status: res.status,
        graphErrorCode: body?.error?.code,
        graphErrorSubcode: body?.error?.error_subcode,
      });
    }

    const data = await res.json();

    const newEncryptedToken = this.encryptToken(data.access_token);
    const tokenExpiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
    const nextRefreshAt = this.calculateNextRefreshAt(data.expires_in);

    await this.inTenantTransaction(tenantId, async (tx) => {
      // Prisma update with standard method where possible, but we need raw for ownership token checking easily
      // Because we must ensure processingLockToken matches
      await tx.$executeRaw`
        UPDATE public.social_connections
        SET "accessTokenEncrypted" = ${newEncryptedToken},
            "tokenExpiresAt" = ${tokenExpiresAt}::timestamp,
            "nextRefreshAt" = ${nextRefreshAt}::timestamp,
            "lastRefreshSuccessAt" = ${now}::timestamp,
            "refreshFailureCount" = 0,
            "lastErrorAt" = NULL,
            "lastErrorCategory" = NULL,
            "lastErrorCode" = NULL,
            "processingLockedUntil" = NULL,
            "processingLockToken" = NULL
        WHERE id = ${conn.id}::uuid
          AND "processingLockToken" = ${lockToken}::uuid
      `;
    });
  }

  private async handleError(tenantId: string, conn: { id: string; status: SocialConnectionStatus; refreshFailureCount: number; accessTokenEncrypted: string | null; tokenExpiresAt: Date | null }, lockToken: string, err: unknown) {
    const classification = this.classifyMetaError(err);
    const failureCount = conn.refreshFailureCount + 1;
    const now = new Date();

    let nextStatus: SocialConnectionStatus = conn.status;
    let clearToken = false;

    if (classification === 'EXPIRED' || classification === 'REVOKED') {
      nextStatus = classification === 'EXPIRED' ? 'EXPIRED' : 'REVOKED';
      clearToken = true;
    } else {
      if (failureCount >= 4) {
        nextStatus = 'ERROR';
      }
    }

    const nextRefreshAt = this.calculateCooldown(failureCount, now);

    await this.inTenantTransaction(tenantId, async (tx) => {
      // Prisma raw update to enforce token validation securely
      await tx.$executeRaw`
        UPDATE public.social_connections
        SET status = ${nextStatus}::"SocialConnectionStatus",
            "lastErrorAt" = ${now}::timestamp,
            "lastErrorCategory" = ${classification}::"SocialConnectionErrorCategory",
            "refreshFailureCount" = ${clearToken ? 0 : failureCount},
            "nextRefreshAt" = ${clearToken ? null : nextRefreshAt}::timestamp,
            "accessTokenEncrypted" = ${clearToken ? null : conn.accessTokenEncrypted},
            "tokenExpiresAt" = ${clearToken ? null : conn.tokenExpiresAt}::timestamp,
            "processingLockedUntil" = NULL,
            "processingLockToken" = NULL
        WHERE id = ${conn.id}::uuid
          AND "processingLockToken" = ${lockToken}::uuid
      `;
    });
  }

  private classifyMetaError(err: unknown): SocialConnectionErrorCategory | 'INVALID_RESPONSE' {
    const error = err as Record<string, unknown>;
    if (error.status === 429) return 'RATE_LIMITED';
    if (typeof error.status === 'number' && error.status >= 500) return 'TRANSIENT_ERROR';
    if (error.code === 'TIMEOUT' || error.code === 'FETCH_ERROR') return 'TRANSIENT_ERROR';

    if (error.graphErrorCode === 190) {
      if (error.graphErrorSubcode === 463 || error.graphErrorSubcode === 460) return 'EXPIRED';
      return 'REVOKED';
    }
    if (error.graphErrorCode === 10 || error.graphErrorCode === 200 || error.graphErrorCode === 2500) return 'PERMISSION_ERROR';
    if (error.graphErrorCode === 4 || error.graphErrorCode === 17 || error.graphErrorCode === 32 || error.graphErrorCode === 613) return 'RATE_LIMITED';
    if (error.graphErrorCode === 2) return 'TRANSIENT_ERROR';

    return 'INVALID_RESPONSE';
  }

  private calculateNextRefreshAt(expiresInSeconds: number | null): Date | null {
    if (!expiresInSeconds) return null;
    let marginDays = parseInt(process.env.META_TOKEN_REFRESH_MARGIN_DAYS ?? '14', 10);
    if (isNaN(marginDays) || marginDays < 7 || marginDays > 30) marginDays = 14;

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const nextRefresh = new Date(expiresAt.getTime() - marginDays * 24 * 60 * 60 * 1000);
    const minNextRefresh = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const baseNextRefresh = nextRefresh < minNextRefresh ? minNextRefresh : nextRefresh;
    const jitterMaxMs = 6 * 60 * 60 * 1000;
    const jitter = Math.floor(Math.random() * jitterMaxMs);
    return new Date(baseNextRefresh.getTime() + jitter);
  }

  private calculateCooldown(failureCount: number, fromDate: Date): Date {
    const next = new Date(fromDate);
    const jitterMaxSeconds = 15 * 60;
    const jitter = Math.floor(Math.random() * jitterMaxSeconds) * 1000;
    switch (failureCount) {
      case 1: next.setMinutes(next.getMinutes() + 15); break;
      case 2: next.setHours(next.getHours() + 1); break;
      case 3: next.setHours(next.getHours() + 6); break;
      default: next.setHours(next.getHours() + 24); break;
    }
    return new Date(next.getTime() + jitter);
  }

  private async inTenantTransaction<T>(tenantId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.user_id', '', true)`;
      return fn(tx);
    });
  }

  private encryptToken(token: string): string {
    const alg = 'aes-256-gcm';
    const iv = randomBytes(12);
    const key = Buffer.from(this.config.ENCRYPTION_KEY, 'hex');
    const cipher = createCipheriv(alg, key, iv);
    let enc = cipher.update(token, 'utf8', 'hex');
    enc += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${enc}`;
  }

  private decryptToken(encryptedString: string): string {
    const parts = encryptedString.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted string format');
    const [ivHex, authTagHex, encHex] = parts;
    const alg = 'aes-256-gcm';
    const key = Buffer.from(this.config.ENCRYPTION_KEY, 'hex');
    const decipher = createDecipheriv(alg, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let dec = decipher.update(encHex, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  }
}
