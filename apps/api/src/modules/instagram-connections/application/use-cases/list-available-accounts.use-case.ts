import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
  GoneException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantContextService } from '../../../tenants/application/tenant-context.service';
import { SOCIAL_PROVIDER_ADAPTER, SocialProviderAdapter, InstagramAccount } from '../../domain/ports/social-provider.adapter';
import { TokenEncryptionService } from '../../../core/utils/crypto.service';


@Injectable()
export class ListAvailableAccountsUseCase {
  private readonly logger = new Logger(ListAvailableAccountsUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(SOCIAL_PROVIDER_ADAPTER)
    private readonly adapter: SocialProviderAdapter,
    private readonly encryption: TokenEncryptionService,
  ) {}

  async execute(sessionId: string): Promise<InstagramAccount[]> {
    const scope = this.tenantContext.getRequired();
    const { tenantId, userId } = scope;

    const session = await this.prisma.oAuthSession.findUnique({ where: { id: sessionId } });

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
