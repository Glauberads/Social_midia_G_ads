import { Injectable, Logger } from '@nestjs/common';
import { TenantTransactionService } from '../../../tenants/application/services/tenant-transaction.service';
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
    private readonly tenantTransaction: TenantTransactionService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(): Promise<SocialConnectionStatusResult | null> {
    const scope = this.tenantContext.getRequired();
    const { tenantId } = scope;

    return this.tenantTransaction.execute(scope, async (tx) => {
      const conn = await tx.socialConnection.findUnique({
        where: { tenantId_provider: { tenantId, provider: 'META_INSTAGRAM' } },
      });

      if (!conn) {
        return {
          status: 'NOT_CONNECTED',
          provider: 'META_INSTAGRAM',
        };
      }

      return {
        status: conn.status,
        provider: conn.provider,
        instagramUsername: conn.instagramAccountId,
        pageName: conn.externalAccountName,
        connectedAt: conn.connectedAt,
        lastValidatedAt: conn.lastValidatedAt,
        tokenExpiresAt: conn.tokenExpiresAt,
        updatedAt: conn.updatedAt,
        connectedById: conn.connectedById,
        lastErrorCode: conn.lastErrorCode,
      };
    });
  }
}
