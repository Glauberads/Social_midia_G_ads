import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  ExchangeCodeResult,
  InstagramAccount,
  SocialProviderAdapter,
} from '../../domain/ports/social-provider.adapter';

function generateFakeToken(prefix: string): string {
  return `${prefix}-${randomBytes(16).toString('hex')}`;
}

@Injectable()
export class FakeSocialProviderAdapter implements SocialProviderAdapter {
  private readonly logger = new Logger(FakeSocialProviderAdapter.name);

  /** Controls behaviour for tests — inject before calling methods. */
  public scenario: 'two-accounts' | 'one-account' | 'no-accounts' | 'no-ig-linked' | 'timeout'
    | '429' | '500' | 'malformed' | 'token-invalid' | 'token-revoked' | 'token-expired' = 'two-accounts';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  buildAuthorizationUrl(state: string, redirectUri: string, _scopes: string[]): string {
    return `https://fake.provider/auth?state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async exchangeCode(_code: string, _redirectUri: string): Promise<ExchangeCodeResult> {
    this.logger.debug('[fake] exchangeCode called');
    await this._maybeThrow();
    return {
      accessToken: generateFakeToken('fake-short'),
      expiresIn: 3600,
      scopes: ['pages_show_list', 'pages_read_engagement', 'instagram_basic'],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async exchangeForLongLivedToken(_accessToken: string): Promise<ExchangeCodeResult> {
    this.logger.debug('[fake] exchangeForLongLivedToken');
    await this._maybeThrow();
    if (this.scenario === 'token-revoked') {
      throw Object.assign(new Error('Token has been revoked'), { code: 'TOKEN_REVOKED' });
    }
    return {
      accessToken: generateFakeToken('fake-long'),
      expiresIn: 5184000, // 60 days
      scopes: ['pages_show_list', 'pages_read_engagement', 'instagram_basic'],
    };
  }

  async listAvailableAccounts(accessToken: string): Promise<InstagramAccount[]> {
    this.logger.debug(`[fake] listAvailableAccounts for token prefix: ${accessToken.slice(0, 12)}…`);
    await this._maybeThrow();

    if (this.scenario === 'token-invalid') {
      throw Object.assign(new Error('Token is invalid'), { code: 'TOKEN_INVALID', status: 401 });
    }

    if (this.scenario === 'no-accounts') {
      return [];
    }
    if (this.scenario === 'no-ig-linked') {
      return []; // Page exists but no IG account linked
    }
    if (this.scenario === 'one-account') {
      return [
        {
          pageId: 'fake-page-001',
          pageName: 'Fake Business Page',
          instagramAccountId: 'fake-ig-001',
          instagramUsername: 'fake_business',
        },
      ];
    }
    // two-accounts (default)
    return [
      {
        pageId: 'fake-page-001',
        pageName: 'Fake Business Page One',
        instagramAccountId: 'fake-ig-001',
        instagramUsername: 'fake_business_one',
      },
      {
        pageId: 'fake-page-002',
        pageName: 'Fake Business Page Two',
        instagramAccountId: 'fake-ig-002',
        instagramUsername: 'fake_business_two',
      },
    ];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async validateConnection(_accessToken: string): Promise<{ userId: string }> {
    await this._maybeThrow();
    if (this.scenario === 'token-invalid') {
      throw Object.assign(new Error('Token is invalid'), { graphErrorCode: 190 });
    }
    if (this.scenario === 'token-revoked') {
      throw Object.assign(new Error('Token is revoked'), { graphErrorCode: 190, graphErrorSubcode: 458 });
    }
    if (this.scenario === 'token-expired') {
      throw Object.assign(new Error('Token is expired'), { graphErrorCode: 190, graphErrorSubcode: 463 });
    }
    return { userId: 'fake-user-123' };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async revoke(_accessToken: string): Promise<void> {
    this.logger.debug('[fake] revoke called');
    if (this.scenario === '500') {
      throw Object.assign(new Error('Revocation endpoint error'), { code: 'PROVIDER_ERROR', status: 500 });
    }
  }

  private async _maybeThrow(): Promise<void> {
    if (this.scenario === 'timeout') {
      await new Promise<void>((_, reject) =>
        setTimeout(() => reject(Object.assign(new Error('Request timed out'), { code: 'TIMEOUT' })), 50),
      );
    }
    if (this.scenario === '429') {
      throw Object.assign(new Error('Rate limit exceeded'), { code: 'RATE_LIMITED', status: 429 });
    }
    if (this.scenario === '500') {
      throw Object.assign(new Error('Internal server error'), { code: 'PROVIDER_ERROR', status: 500 });
    }
    if (this.scenario === 'malformed') {
      throw Object.assign(new Error('Malformed response from provider'), { code: 'MALFORMED_RESPONSE' });
    }
  }
}
