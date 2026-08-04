import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantTransactionService } from '../../../tenants/application/services/tenant-transaction.service';
import { TenantContextService } from '../../../tenants/application/tenant-context.service';
import { TokenEncryptionService } from '../../../core/utils/crypto.service';
import {
  SOCIAL_PROVIDER_ADAPTER,
  SocialProviderAdapter,
} from '../../domain/ports/social-provider.adapter';
import { MetaErrorClassifier } from '../../domain/services/meta-error-classifier.service';
import { SocialConnectionStatus } from '@prisma/client';

@Injectable()
export class RefreshSocialConnectionUseCase {
  private readonly logger = new Logger(RefreshSocialConnectionUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly transactionService: TenantTransactionService,
    private readonly tenantContext: TenantContextService,
    private readonly tokenEncryption: TokenEncryptionService,
    @Inject(SOCIAL_PROVIDER_ADAPTER) private readonly adapter: SocialProviderAdapter,
  ) {}

  async execute(force = false): Promise<{ status: string; category?: string }> {
    const scope = this.tenantContext.getRequired();

    return this.transactionService.execute(scope, async (tx) => {
      const conn = await tx.socialConnection.findUnique({
        where: { tenantId_provider: { tenantId: scope.tenantId, provider: 'META_INSTAGRAM' } },
      });

      if (!conn) throw new Error('Connection not found');
      if (conn.status !== 'CONNECTED') throw new Error('Connection is not in CONNECTED state');
      if (!conn.accessTokenEncrypted) throw new Error('No access token available for refresh');

      const now = new Date();

      // Elegibility check
      if (!force) {
        if (conn.nextRefreshAt && conn.nextRefreshAt > now) {
          return { status: conn.status, category: 'NOT_ELIGIBLE' };
        }
      }

      await tx.socialConnection.update({
        where: { id: conn.id },
        data: { lastRefreshAttemptAt: now },
      });

      const accessToken = await this.tokenEncryption.decrypt(conn.accessTokenEncrypted, {
        kind: 'social-token',
        tenantId: scope.tenantId,
        connectionId: conn.id,
        provider: 'META_INSTAGRAM',
      });

      try {
        const result = await this.adapter.exchangeForLongLivedToken(accessToken);

        // Success
        const newEncryptedToken = await this.tokenEncryption.encrypt(result.accessToken, {
          kind: 'social-token',
          tenantId: scope.tenantId,
          connectionId: conn.id,
          provider: 'META_INSTAGRAM',
        });
        const nextRefreshAt = this.calculateNextRefreshAt(result.expiresIn);
        const tokenExpiresAt = result.expiresIn ? new Date(Date.now() + result.expiresIn * 1000) : null;

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

        return { status: 'CONNECTED', category: 'VALID' };
      } catch (err) {
        const classification = MetaErrorClassifier.classify(err);
        const failureCount = conn.refreshFailureCount + 1;

        let nextStatus: SocialConnectionStatus = conn.status;
        let clearToken = false;

        if (classification.category === 'EXPIRED' || classification.category === 'REVOKED') {
          nextStatus = classification.category === 'EXPIRED' ? 'EXPIRED' : 'REVOKED';
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
            lastErrorCategory: classification.category === 'VALID' ? null : classification.category,
            refreshFailureCount: clearToken ? 0 : failureCount,
            nextRefreshAt: clearToken ? null : nextRefreshAt,
            accessTokenEncrypted: clearToken ? null : conn.accessTokenEncrypted,
            tokenExpiresAt: clearToken ? null : conn.tokenExpiresAt,
          },
        });

        return { status: nextStatus, category: classification.category };
      }
    });
  }

  private calculateNextRefreshAt(expiresInSeconds: number | null): Date | null {
    if (!expiresInSeconds) return null;

    let marginDays = parseInt(this.configService.get<string>('META_TOKEN_REFRESH_MARGIN_DAYS') ?? '14', 10);
    if (isNaN(marginDays) || marginDays < 7 || marginDays > 30) {
      marginDays = 14;
    }

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const nextRefresh = new Date(expiresAt.getTime() - marginDays * 24 * 60 * 60 * 1000);

    // never define nextRefreshAt before now + 24h
    const minNextRefresh = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const baseNextRefresh = nextRefresh < minNextRefresh ? minNextRefresh : nextRefresh;

    // Apply jitter of up to 6 hours (in ms)
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
}
