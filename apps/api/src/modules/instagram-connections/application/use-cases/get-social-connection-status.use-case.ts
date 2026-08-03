import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantContextService } from '../../../tenants/application/tenant-context.service';


export interface SocialConnectionStatusResult {
  status: string;
  provider: string;
  instagramUsername?: string | null;
  pageName?: string | null;
  connectedAt?: Date | null;
  lastValidatedAt?: Date | null;
  tokenExpiresAt?: Date | null;
}

@Injectable()
export class GetSocialConnectionStatusUseCase {
  private readonly logger = new Logger(GetSocialConnectionStatusUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(): Promise<SocialConnectionStatusResult | null> {
    const { tenantId } = this.tenantContext.getRequired();

    const conn = await this.prisma.socialConnection.findUnique({
      where: { tenantId_provider: { tenantId, provider: 'META_INSTAGRAM' } },
      select: {
        status: true,
        provider: true,
        externalAccountName: true,
        instagramAccountId: true,
        connectedAt: true,
        lastValidatedAt: true,
        tokenExpiresAt: true,
        // Never return accessTokenEncrypted
      },
    });

    if (!conn) return null;

    return {
      status: conn.status,
      provider: conn.provider,
      instagramUsername: conn.instagramAccountId,
      pageName: conn.externalAccountName,
      connectedAt: conn.connectedAt,
      lastValidatedAt: conn.lastValidatedAt,
      tokenExpiresAt: conn.tokenExpiresAt,
    };
  }
}
