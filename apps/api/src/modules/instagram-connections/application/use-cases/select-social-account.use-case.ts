import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
  NotFoundException,
  GoneException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantContextService } from '../../../tenants/application/tenant-context.service';
import { SOCIAL_PROVIDER_ADAPTER, SocialProviderAdapter } from '../../domain/ports/social-provider.adapter';
import { TokenEncryptionService } from '../../../core/utils/crypto.service';
import { randomUUID } from 'crypto';


export interface SelectSocialAccountInput {
  sessionId: string;
  instagramAccountId: string;
  pageId: string;
}

@Injectable()
export class SelectSocialAccountUseCase {
  private readonly logger = new Logger(SelectSocialAccountUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
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

    // Atomically consume session and create/update SocialConnection
    await this.prisma.$transaction(async (tx) => {
      const session = await tx.oAuthSession.findUnique({ where: { id: input.sessionId } });

      if (!session || session.tenantId !== tenantId) {
        throw new NotFoundException('OAuth session not found.');
      }
      if (session.userId !== userId) {
        throw new UnauthorizedException('OAuth session belongs to a different user.');
      }
      if (session.consumedAt !== null) {
        throw new GoneException('OAuth session has already been used.');
      }
      if (session.expiresAt < new Date()) {
        throw new GoneException('OAuth session has expired.');
      }

      // Decrypt token to validate account selection against provider
      const plainToken = this.encryption.decrypt(session.accessTokenEncrypted, {
        kind: 'oauth-session',
        tenantId,
        sessionId: input.sessionId,
        provider: 'META_INSTAGRAM',
      });

      // Verify the selected account is actually linked (re-consult provider)
      let accounts: Awaited<ReturnType<SocialProviderAdapter['listAvailableAccounts']>>;
      try {
        accounts = await this.adapter.listAvailableAccounts(plainToken);
      } catch (err) {
        this.logger.error('[SelectSocialAccount] failed to re-verify accounts from provider');
        throw err;
      }

      const selected = accounts.find(
        (a) => a.instagramAccountId === input.instagramAccountId && a.pageId === input.pageId,
      );

      if (!selected) {
        throw new BadRequestException(
          'The selected account/page combination is not accessible by this token.',
        );
      }

      // Mark session as consumed
      await tx.oAuthSession.update({
        where: { id: input.sessionId },
        data: { consumedAt: new Date() },
      });

      // Encrypt the long-lived token for permanent storage
      // Use upsert — one row per tenant/provider
      const now = new Date();
      const existingConnection = await tx.socialConnection.findUnique({
        where: { tenantId_provider: { tenantId, provider: 'META_INSTAGRAM' } },
      });

      const connectionId = existingConnection?.id ?? randomUUID();

      const encryptedToken = this.encryption.encrypt(plainToken, {
        kind: 'social-token',
        tenantId,
        connectionId,
        provider: 'META_INSTAGRAM',
      });

      await tx.socialConnection.upsert({
        where: { tenantId_provider: { tenantId, provider: 'META_INSTAGRAM' } },
        create: {
          id: connectionId,
          tenantId,
          provider: 'META_INSTAGRAM',
          status: 'CONNECTED',
          pageId: selected.pageId,
          externalAccountName: selected.pageName,
          instagramAccountId: selected.instagramAccountId,
          scopes: ['pages_show_list', 'pages_read_engagement', 'instagram_basic'],
          accessTokenEncrypted: encryptedToken,
          connectedById: userId,
          connectedAt: now,
          refreshMetadata: {
            tokenType: 'facebook',
            issuedAt: now.toISOString(),
            lastExchangeAt: now.toISOString(),
            graphApiVersion: 'v20.0',
          },
        },
        update: {
          status: 'CONNECTED',
          pageId: selected.pageId,
          externalAccountName: selected.pageName,
          instagramAccountId: selected.instagramAccountId,
          accessTokenEncrypted: encryptedToken,
          connectedById: userId,
          connectedAt: now,
          disconnectedAt: null,
          lastErrorCode: null,
          refreshMetadata: {
            tokenType: 'facebook',
            issuedAt: now.toISOString(),
            lastExchangeAt: now.toISOString(),
            graphApiVersion: 'v20.0',
          },
        },
      });

      // AuditLog
      await tx.auditLog.create({
        data: {
          action: 'SOCIAL_ACCOUNT_SELECTED',
          entity: 'SocialConnection',
          entityId: connectionId,
          actorId: userId,
          tenantId,
          metadata: {
            provider: 'META_INSTAGRAM',
            pageId: selected.pageId,
            instagramAccountId: selected.instagramAccountId,
            instagramUsername: selected.instagramUsername,
          },
        },
      });
    });

    this.logger.log(`[SelectSocialAccount] Connection established for tenant=${tenantId}`);
  }
}
