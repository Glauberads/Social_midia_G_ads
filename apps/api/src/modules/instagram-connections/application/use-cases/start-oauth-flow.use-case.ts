import { Injectable, Logger, Inject, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantContextService } from '../../../tenants/application/tenant-context.service';
import { SOCIAL_PROVIDER_ADAPTER, SocialProviderAdapter } from '../../domain/ports/social-provider.adapter';
import { randomBytes, createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';

const ALLOWED_RETURN_PATHS = ['/dashboard/settings/integrations'];
const OAUTH_STATE_TTL_MINUTES = 15;

// Required scopes for Instagram API with Facebook Login (read-only, no publish)
export const META_SCOPES = ['pages_show_list', 'pages_read_engagement', 'instagram_basic'];

export interface StartOAuthFlowResult {
  authorizationUrl: string;
}

@Injectable()
export class StartOAuthFlowUseCase {
  private readonly logger = new Logger(StartOAuthFlowUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(SOCIAL_PROVIDER_ADAPTER)
    private readonly adapter: SocialProviderAdapter,
    private readonly configService: ConfigService,
  ) {}

  async execute(returnPath?: string): Promise<StartOAuthFlowResult> {
    const scope = this.tenantContext.getRequired();
    const { tenantId, userId, role } = scope;

    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN can connect social accounts.');
    }

    // Validate returnPath against allow-list
    const resolvedReturn = returnPath ?? '/dashboard/settings/integrations';
    if (!ALLOWED_RETURN_PATHS.includes(resolvedReturn)) {
      throw new BadRequestException('Invalid returnPath.');
    }

    // Generate 32 random bytes, send raw to provider, store only SHA-256 hash
    const rawState = randomBytes(32).toString('hex');
    const stateHash = createHash('sha256').update(rawState).digest('hex');

    const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MINUTES * 60 * 1000);

    await this.prisma.oAuthState.create({
      data: {
        stateHash,
        tenantId,
        userId,
        provider: 'META_INSTAGRAM',
        returnPath: resolvedReturn,
        expiresAt,
      },
    });

    this.logger.log(`[StartOAuthFlow] state created for tenant=${tenantId}`);

    const redirectUri = this.configService.getOrThrow<string>('META_REDIRECT_URI');
    const authorizationUrl = this.adapter.buildAuthorizationUrl(rawState, redirectUri, META_SCOPES);

    return { authorizationUrl };
  }
}
