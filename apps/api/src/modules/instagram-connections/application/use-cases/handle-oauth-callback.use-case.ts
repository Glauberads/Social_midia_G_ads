import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantTransactionService } from '../../../tenants/application/services/tenant-transaction.service';
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
    private readonly tenantTransaction: TenantTransactionService,
    @Inject(SOCIAL_PROVIDER_ADAPTER)
    private readonly adapter: SocialProviderAdapter,
    private readonly encryption: TokenEncryptionService,
  ) {}

  async execute(rawState: string, code: string): Promise<HandleOAuthCallbackResult> {
    // Compute stateHash from raw state — never log rawState
    const stateHash = createHash('sha256').update(rawState).digest('hex');

    // 1. Consume state via SECURITY DEFINER (global but secure context)
    const stateRows = await this.prisma.$queryRaw<{ tenantId: string; userId: string; returnPath: string | null }[]>`
      SELECT * FROM consume_oauth_state(${stateHash}, 'META_INSTAGRAM');
    `;

    if (stateRows.length === 0) {
      throw new BadRequestException('Invalid, consumed, expired, or mismatched OAuth state.');
    }

    const oAuthState = stateRows[0];

    // 2. Network exchange (OUTSIDE of any transaction)
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

    // 3. Prepare session data
    const sessionId = randomUUID();

    const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);

    const encrypted = this.encryption.encrypt(longResult.accessToken, {
      kind: 'oauth-session',
      tenantId: oAuthState.tenantId,
      sessionId,
      provider: 'META_INSTAGRAM',
    });

    // 4. Create Session within secure RLS tenant context
    const returnPathVal = (oAuthState.returnPath ?? '/dashboard/settings/integrations') + '?result=session_ready';

    await this.tenantTransaction.execute(oAuthState as any, async (tx) => {
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
    });

    this.logger.log(`[HandleOAuthCallback] session created for tenant=${oAuthState.tenantId}`);
    return { 
      sessionId, 
      returnPath: returnPathVal 
    };
  }
}
