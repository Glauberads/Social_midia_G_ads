import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { TenantContextService } from '../../../tenants/application/tenant-context.service';
import { TenantTransactionService } from '../../../tenants/application/services/tenant-transaction.service';
import { SOCIAL_PROVIDER_ADAPTER, SocialProviderAdapter } from '../../domain/ports/social-provider.adapter';
import { TokenEncryptionService } from '../../../core/utils/crypto.service';
import { Prisma } from '@prisma/client';


@Injectable()
export class DisconnectSocialConnectionUseCase {
  private readonly logger = new Logger(DisconnectSocialConnectionUseCase.name);

  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly tenantContext: TenantContextService,
    @Inject(SOCIAL_PROVIDER_ADAPTER)
    private readonly adapter: SocialProviderAdapter,
    private readonly encryption: TokenEncryptionService,
  ) {}

  async execute(): Promise<void> {
    const scope = this.tenantContext.getRequired();
    const { tenantId, userId, role } = scope;

    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN can disconnect social accounts.');
    }

    await this.tenantTransaction.execute(scope, async (tx) => {
      const conn = await tx.socialConnection.findUnique({
        where: { tenantId_provider: { tenantId, provider: 'META_INSTAGRAM' } },
      });

      if (!conn) {
        throw new NotFoundException('No active Meta/Instagram connection found.');
      }

      // Attempt to decrypt token for remote revocation (best-effort)
      let plainToken: string | null = null;
      if (conn.accessTokenEncrypted) {
        try {
          plainToken = this.encryption.decrypt(conn.accessTokenEncrypted, {
            kind: 'social-token',
            tenantId,
            connectionId: conn.id,
            provider: 'META_INSTAGRAM',
          });
        } catch {
          this.logger.warn('[Disconnect] Could not decrypt token for revocation — continuing with local disconnect.');
        }
      }

      const now = new Date();

      await tx.socialConnection.update({
        where: { id: conn.id },
        data: {
          status: 'DISCONNECTED',
          disconnectedAt: now,
          accessTokenEncrypted: null,
          tokenExpiresAt: null,
          refreshMetadata: Prisma.JsonNull,
          lastErrorCode: null,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'SOCIAL_ACCOUNT_DISCONNECTED',
          entity: 'SocialConnection',
          entityId: conn.id,
          actorId: userId,
          tenantId,
          metadata: { provider: 'META_INSTAGRAM' },
        },
      });

      // Remote revocation — best-effort, does NOT affect local state
      if (plainToken) {
        try {
          await this.adapter.revoke(plainToken);
          this.logger.log(`[Disconnect] Remote token revoked for tenant=${tenantId}`);
        } catch {
          this.logger.warn('[Disconnect] Remote revocation failed — local disconnect already applied.');
        }
      }
    });

    // Remote revocation — best-effort, does NOT affect local state
  }
}
