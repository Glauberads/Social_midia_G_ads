import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantContextService } from '../../../tenants/application/tenant-context.service';

export interface SocialConnectionHealthResult {
  status: string;
  lastValidatedAt: Date | null;
  tokenExpiresAt: Date | null;
  nextRefreshAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorCategory: string | null;
  refreshFailureCount: number;
}

@Injectable()
export class GetSocialConnectionHealthUseCase {
  private readonly logger = new Logger(GetSocialConnectionHealthUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(): Promise<SocialConnectionHealthResult | null> {
    const { tenantId } = this.tenantContext.getRequired();

    const conn = await this.prisma.socialConnection.findUnique({
      where: { tenantId_provider: { tenantId, provider: 'META_INSTAGRAM' } },
      select: {
        status: true,
        lastValidatedAt: true,
        tokenExpiresAt: true,
        nextRefreshAt: true,
        lastErrorAt: true,
        lastErrorCategory: true,
        refreshFailureCount: true,
      },
    });

    if (!conn) return null;

    return {
      status: conn.status,
      lastValidatedAt: conn.lastValidatedAt,
      tokenExpiresAt: conn.tokenExpiresAt,
      nextRefreshAt: conn.nextRefreshAt,
      lastErrorAt: conn.lastErrorAt,
      lastErrorCategory: conn.lastErrorCategory,
      refreshFailureCount: conn.refreshFailureCount,
    };
  }
}
