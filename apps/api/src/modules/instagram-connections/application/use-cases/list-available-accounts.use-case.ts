import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
  GoneException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TenantTransactionService } from '../../../tenants/application/services/tenant-transaction.service';
import { TenantContextService } from '../../../tenants/application/tenant-context.service';
import { SOCIAL_PROVIDER_ADAPTER, SocialProviderAdapter, InstagramAccount } from '../../domain/ports/social-provider.adapter';
import { TokenEncryptionService } from '../../../core/utils/crypto.service';


@Injectable()
export class ListAvailableAccountsUseCase {
  private readonly logger = new Logger(ListAvailableAccountsUseCase.name);

  constructor(
    private readonly tenantTransaction: TenantTransactionService,
    private readonly tenantContext: TenantContextService,
    @Inject(SOCIAL_PROVIDER_ADAPTER)
    private readonly adapter: SocialProviderAdapter,
    private readonly encryption: TokenEncryptionService,
  ) {}

  async execute(sessionId: string): Promise<InstagramAccount[]> {
    const scope = this.tenantContext.getRequired();
    const { tenantId, userId } = scope;

    const session = await this.tenantTransaction.execute(scope, async (tx) => {
      const s = await tx.oAuthSession.findUnique({ where: { id: sessionId } });
      if (!s) {
        throw new NotFoundException('OAuth session not found.');
      }
      if (s.tenantId !== tenantId) {
        throw new ForbiddenException('Session does not belong to your tenant.');
      }
      if (s.provider !== 'META_INSTAGRAM') {
        throw new BadRequestException('Session provider mismatch.');
      }
      if (s.expiresAt < new Date()) {
        throw new BadRequestException('OAuth session has expired. Start flow again.');
      }
      if (s.userId !== userId) {
        throw new UnauthorizedException('OAuth session belongs to a different user.');
      }
      if (s.consumedAt !== null) {
        throw new GoneException('OAuth session has already been used.');
      }
      return s;
    });

    const plainToken = this.encryption.decrypt(session.accessTokenEncrypted, {
      kind: 'oauth-session',
      tenantId,
      sessionId,
      provider: 'META_INSTAGRAM',
    });

    let accounts: InstagramAccount[];
    try {
      accounts = await this.adapter.listAvailableAccounts(plainToken);
    } catch (err) {
      this.logger.error('[ListAvailableAccounts] provider error listing accounts');
      throw err;
    }

    return accounts;
  }
}
