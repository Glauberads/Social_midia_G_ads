import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { TenantTransactionService } from '../../../tenants/application/services/tenant-transaction.service';
import { TenantContextService } from '../../../tenants/application/tenant-context.service';
import { SOCIAL_PROVIDER_ADAPTER, SocialProviderAdapter } from '../../domain/ports/social-provider.adapter';
import { TokenEncryptionService } from '../../../core/utils/crypto.service';


export interface SelectSocialAccountInput {
  sessionId: string;
  instagramAccountId: string;
  pageId: string;
}

@Injectable()
export class SelectSocialAccountUseCase {
  private readonly logger = new Logger(SelectSocialAccountUseCase.name);

  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly tenantContext: TenantContextService,
    @Inject(SOCIAL_PROVIDER_ADAPTER)
    private readonly adapter: SocialProviderAdapter,
    private readonly encryption: TokenEncryptionService,
  ) {}

  async execute(input: SelectSocialAccountInput): Promise<void> {
    const scope = this.tenantContext.getRequired();
    const { tenantId, userId, role } = scope;

    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN can select a social account.');
    }

    // 1. Fetch session inside RLS (Read-Only phase)
    const session = await this.tenantTransaction.execute(scope, async (tx) => {
      const s = await tx.oAuthSession.findUnique({ where: { id: input.sessionId } });
      if (!s) {
        throw new NotFoundException('OAuth session not found.');
      }
      if (s.tenantId !== tenantId) {
        throw new ForbiddenException('Session does not belong to your tenant.');
      }
      if (s.expiresAt < new Date()) {
        throw new BadRequestException('OAuth session has expired.');
      }
      if (s.consumedAt !== null) {
        throw new BadRequestException('OAuth session already consumed.');
      }
      return s;
    });

    // 2. Decrypt token securely 
    const sessionPlainToken = this.encryption.decrypt(session.accessTokenEncrypted, {
      kind: 'oauth-session',
      tenantId,
      sessionId: session.id,
      provider: 'META_INSTAGRAM',
    });

    // 3. Network call to validate selected account OUTSIDE of transaction
    let accounts: Awaited<ReturnType<SocialProviderAdapter['listAvailableAccounts']>>;
    try {
      accounts = await this.adapter.listAvailableAccounts(sessionPlainToken);
    } catch (err) {
      this.logger.error('[SelectSocialAccount] failed to re-verify accounts from provider');
      throw err;
    }

    const selected = accounts.find(
      (a) => a.instagramAccountId === input.instagramAccountId && a.pageId === input.pageId,
    );

    if (!selected) {
      throw new BadRequestException('The selected account/page combination is not accessible by this token.');
    }

    // 4. Transactionally consume session and upsert SocialConnection
    await this.tenantTransaction.execute(scope, async (tx) => {
      const s2 = await tx.oAuthSession.findUnique({ where: { id: input.sessionId } });
      if (!s2 || s2.consumedAt !== null) {
        throw new BadRequestException('Session has been consumed concurrently.');
      }

      await tx.oAuthSession.update({
        where: { id: input.sessionId },
        data: { consumedAt: new Date() }
      });

      // 5. Encrypt the token specifically for the final connection
      // We need connection ID before encryption.
      let conn = await tx.socialConnection.findUnique({
        where: { tenantId_provider: { tenantId, provider: 'META_INSTAGRAM' } },
      });

      if (!conn) {
        conn = await tx.socialConnection.create({
          data: {
            tenantId,
            provider: 'META_INSTAGRAM',
            status: 'DISCONNECTED', // temporary until encrypted
            connectedById: userId,
            accessTokenEncrypted: 'placeholder', // update later
          },
        });
      }

      const connEncrypted = this.encryption.encrypt(sessionPlainToken, {
        kind: 'social-token',
        tenantId,
        connectionId: conn.id,
        provider: 'META_INSTAGRAM',
      });

      // 4. Update the connection with the final data
      const nextRefreshAt = new Date(Date.now() + 50 * 24 * 60 * 60 * 1000); // 50 days refresh

      await tx.socialConnection.update({
        where: { id: conn.id },
        data: {
          status: 'CONNECTED',
          accessTokenEncrypted: connEncrypted,
          tokenExpiresAt: null, // long lived
          refreshMetadata: {
            pageId: selected.pageId,
            instagramId: selected.instagramAccountId,
            pageName: selected.pageName,
            instagramUsername: selected.instagramUsername,
            tokenType: 'facebook',
            graphApiVersion: 'v20.0',
          } as any,
          connectedById: userId,
          lastErrorCode: null,
          disconnectedAt: null,
          nextRefreshAt,
          processingLockedUntil: null,
        },
      });

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          action: 'SOCIAL_ACCOUNT_CONNECTED',
          entity: 'SocialConnection',
          entityId: conn.id,
          actorId: userId,
          tenantId,
          metadata: {
            provider: 'META_INSTAGRAM',
            pageId: input.pageId,
            instagramId: input.instagramAccountId,
          },
        },
      });

      // 6. Delete the consumed session
      await tx.oAuthSession.delete({ where: { id: session.id } });
    });

    this.logger.log(`[SelectSocialAccount] Successfully connected Meta/Instagram for tenant=${tenantId}`);
  }
}
