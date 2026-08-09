import { PrismaClient, Prisma, SocialConnectionStatus, SocialConnectionErrorCategory } from '@projeto/database';
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
      try {
        await this.inTenantTransaction(candidate.tenantId, async (tx) => {
          // Lock processing inside RLS context
          const locked = await tx.$executeRaw`
            UPDATE public.social_connections
            SET "processingLockedUntil" = now() + interval '5 minutes'
            WHERE id = ${candidate.id}::uuid
              AND ("processingLockedUntil" IS NULL OR "processingLockedUntil" <= now())
          `;

          if (locked === 0) return; // locked by another worker

          try {
            const conn = await tx.socialConnection.findUnique({
              where: { id: candidate.id },
            });

            if (!conn || conn.status !== 'CONNECTED' || !conn.accessTokenEncrypted) {
              return;
            }

            const accessToken = this.decryptToken(conn.accessTokenEncrypted);
            
            // Determine if we are doing a refresh or just validation
            // We do refresh if tokenExpiresAt is present and we are within the margin
            const isEligibleForRefresh = conn.nextRefreshAt && conn.nextRefreshAt <= new Date();

            if (isEligibleForRefresh) {
              await this.handleRefresh(tx, conn, accessToken);
            } else {
              await this.handleValidate(tx, conn, accessToken);
            }
          } finally {
            // Release processing lock inside RLS context
            await tx.$executeRaw`
              UPDATE public.social_connections
              SET "processingLockedUntil" = NULL
              WHERE id = ${candidate.id}::uuid
            `;
          }
        });

        processedCount++;
      } catch (err) {
        console.error(JSON.stringify({
          event: 'social_connection_processing_failed',
          connectionId: candidate.id,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    }

    return processedCount;
  }

  private async handleValidate(tx: Prisma.TransactionClient, conn: { id: string; status: SocialConnectionStatus; refreshFailureCount: number; accessTokenEncrypted: string | null; tokenExpiresAt: Date | null }, accessToken: string) {
    try {
      const res = await fetch(`https://graph.facebook.com/${this.config.META_GRAPH_API_VERSION!}/me?fields=id,name&access_token=${accessToken}`);
      
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw Object.assign(new Error(`Validation failed: ${res.status}`), {
          status: res.status,
          graphErrorCode: body?.error?.code,
          graphErrorSubcode: body?.error?.error_subcode,
        });
      }

      await tx.socialConnection.update({
        where: { id: conn.id },
        data: {
          lastValidatedAt: new Date(),
          refreshFailureCount: 0,
          lastErrorAt: null,
          lastErrorCategory: null,
          lastErrorCode: null,
        },
      });
    } catch (err) {
      await this.handleError(tx, conn, err);
    }
  }

  private async handleRefresh(tx: Prisma.TransactionClient, conn: { id: string; status: SocialConnectionStatus; refreshFailureCount: number; accessTokenEncrypted: string | null; tokenExpiresAt: Date | null }, accessToken: string) {
    try {
      const now = new Date();
      await tx.socialConnection.update({
        where: { id: conn.id },
        data: { lastRefreshAttemptAt: now },
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

      await tx.socialConnection.update({
        where: { id: conn.id },
        data: {
          accessTokenEncrypted: newEncryptedToken,
          tokenExpiresAt: tokenExpiresAt,
          nextRefreshAt: nextRefreshAt,
          lastRefreshSuccessAt: now,
          refreshFailureCount: 0,
          lastErrorAt: null,
          lastErrorCategory: null,
          lastErrorCode: null,
        },
      });

    } catch (err) {
      await this.handleError(tx, conn, err);
    }
  }

  private async handleError(tx: Prisma.TransactionClient, conn: { id: string; status: SocialConnectionStatus; refreshFailureCount: number; accessTokenEncrypted: string | null; tokenExpiresAt: Date | null }, err: unknown) {
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

    await tx.socialConnection.update({
      where: { id: conn.id },
      data: {
        status: nextStatus,
        lastErrorAt: now,
        lastErrorCategory: classification as SocialConnectionErrorCategory,
        refreshFailureCount: clearToken ? 0 : failureCount,
        nextRefreshAt: clearToken ? null : nextRefreshAt,
        accessTokenEncrypted: clearToken ? null : conn.accessTokenEncrypted,
        tokenExpiresAt: clearToken ? null : conn.tokenExpiresAt,
      },
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
