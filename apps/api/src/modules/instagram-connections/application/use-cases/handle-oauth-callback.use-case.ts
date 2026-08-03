import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SOCIAL_PROVIDER_ADAPTER, SocialProviderAdapter } from '../../domain/ports/social-provider.adapter';
import { TokenEncryptionService } from '../../../core/utils/crypto.service';
import { createHash, randomUUID } from 'crypto';


export interface HandleOAuthCallbackResult {
  sessionId: string;
  returnPath: string;
}

const SESSION_TTL_MINUTES = 15;

@Injectable()
export class HandleOAuthCallbackUseCase {
  private readonly logger = new Logger(HandleOAuthCallbackUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SOCIAL_PROVIDER_ADAPTER)
    private readonly adapter: SocialProviderAdapter,
    private readonly encryption: TokenEncryptionService,
  ) {}

  async execute(rawState: string, code: string): Promise<HandleOAuthCallbackResult> {
    // Compute stateHash from raw state — never log rawState
    const stateHash = createHash('sha256').update(rawState).digest('hex');

    // Atomically consume the OAuthState and create OAuthSession in one transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const oAuthState = await tx.oAuthState.findUnique({ where: { stateHash } });

      if (!oAuthState) {
        throw new BadRequestException('Invalid state parameter.');
      }
      if (oAuthState.consumedAt !== null) {
        throw new BadRequestException('OAuth state has already been used (replay detected).');
      }
      if (oAuthState.expiresAt < new Date()) {
        throw new BadRequestException('OAuth state has expired.');
      }
      if (oAuthState.provider !== 'META_INSTAGRAM') {
        throw new BadRequestException('OAuth state provider mismatch.');
      }

      // Mark state as consumed
      await tx.oAuthState.update({
        where: { stateHash },
        data: { consumedAt: new Date() },
      });

      // Exchange code for short-lived token then upgrade to long-lived
      let shortResult: Awaited<ReturnType<SocialProviderAdapter['exchangeCode']>>;
      try {
        shortResult = await this.adapter.exchangeCode(code, '');
      } catch {
        this.logger.error('[HandleOAuthCallback] exchangeCode failed');
        throw new BadRequestException('Failed to exchange authorization code.');
      }

      let longResult: Awaited<ReturnType<SocialProviderAdapter['exchangeForLongLivedToken']>>;
      try {
        longResult = await this.adapter.exchangeForLongLivedToken(shortResult.accessToken);
      } catch {
        this.logger.error('[HandleOAuthCallback] exchangeForLongLivedToken failed');
        throw new BadRequestException('Failed to obtain long-lived token.');
      }

      const sessionId = randomUUID();
      const tokenExpiresAt = longResult.expiresIn != null
        ? new Date(Date.now() + longResult.expiresIn * 1000)
        : new Date(Date.now() + 5_184_000_000); // default 60 days if missing

      const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);

      const encrypted = this.encryption.encrypt(longResult.accessToken, {
        kind: 'oauth-session',
        tenantId: oAuthState.tenantId,
        sessionId,
        provider: 'META_INSTAGRAM',
      });

      await tx.oAuthSession.create({
        data: {
          id: sessionId,
          tenantId: oAuthState.tenantId,
          userId: oAuthState.userId,
          provider: 'META_INSTAGRAM',
          accessTokenEncrypted: encrypted,
          expiresAt: sessionExpiresAt,
        },
      });

      return {
        sessionId,
        // The frontend detects completion via ?result=session_ready (no session identifier in URL)
        returnPath: (oAuthState.returnPath ?? '/dashboard/settings/integrations') + '?result=session_ready',
        tenantId: oAuthState.tenantId,
        tokenExpiresAt,
      };
    });

    this.logger.log(`[HandleOAuthCallback] session created for tenant=${result.tenantId}`);
    return { sessionId: result.sessionId, returnPath: result.returnPath };
  }
}
