import { Inject, Injectable, Logger } from '@nestjs/common';
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
export class ValidateSocialConnectionUseCase {
  private readonly logger = new Logger(ValidateSocialConnectionUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionService: TenantTransactionService,
    private readonly tenantContext: TenantContextService,
    private readonly tokenEncryption: TokenEncryptionService,
    @Inject(SOCIAL_PROVIDER_ADAPTER) private readonly adapter: SocialProviderAdapter,
  ) {}

  async execute(): Promise<{ status: string; category?: string }> {
    const scope = this.tenantContext.getRequired();

    return this.transactionService.execute(scope, async (tx) => {
      const conn = await tx.socialConnection.findUnique({
        where: { tenantId_provider: { tenantId: scope.tenantId, provider: 'META_INSTAGRAM' } },
      });

      if (!conn) {
        throw new Error('Connection not found');
      }

      if (!conn.accessTokenEncrypted) {
        return { status: conn.status };
      }

      const accessToken = await this.tokenEncryption.decrypt(conn.accessTokenEncrypted, {
        kind: 'social-token',
        tenantId: scope.tenantId,
        connectionId: conn.id,
        provider: 'META_INSTAGRAM',
      });

      try {
        await this.adapter.validateConnection(accessToken);

        // Success
        await tx.socialConnection.update({
          where: { id: conn.id },
          data: {
            status: 'CONNECTED',
            lastValidatedAt: new Date(),
            refreshFailureCount: 0,
            lastErrorAt: null,
            lastErrorCategory: null,
            lastErrorCode: null,
          },
        });

        return { status: 'CONNECTED', category: 'VALID' };
      } catch (err) {
        const classification = MetaErrorClassifier.classify(err);
        const now = new Date();
        const failureCount = conn.refreshFailureCount + 1;

        let nextStatus: SocialConnectionStatus = conn.status;
        let clearToken = false;

        if (classification.category === 'EXPIRED' || classification.category === 'REVOKED') {
          nextStatus = classification.category === 'EXPIRED' ? 'EXPIRED' : 'REVOKED';
          clearToken = true;
        } else {
          // Cooldown logic applies to Transient, Rate Limited, etc.
          // 1-3 errors -> preserve CONNECTED, 4+ -> ERROR
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

  private calculateCooldown(failureCount: number, fromDate: Date): Date {
    const next = new Date(fromDate);
    // 1st: 15m, 2nd: 1h, 3rd: 6h, 4th+: 24h + jitter
    const jitterMaxSeconds = 15 * 60; // Up to 15m jitter
    const jitter = Math.floor(Math.random() * jitterMaxSeconds) * 1000;

    switch (failureCount) {
      case 1:
        next.setMinutes(next.getMinutes() + 15);
        break;
      case 2:
        next.setHours(next.getHours() + 1);
        break;
      case 3:
        next.setHours(next.getHours() + 6);
        break;
      default:
        next.setHours(next.getHours() + 24);
        break;
    }

    return new Date(next.getTime() + jitter);
  }
}
