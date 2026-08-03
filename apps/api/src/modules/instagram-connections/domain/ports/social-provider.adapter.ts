export interface InstagramAccount {
  pageId: string;
  pageName: string;
  instagramAccountId: string;
  instagramUsername: string;
}

export interface ExchangeCodeResult {
  accessToken: string;
  expiresIn: number | null;
  scopes: string[];
}

export interface SocialProviderAdapter {
  /** Builds the authorization URL to redirect the user to. */
  buildAuthorizationUrl(state: string, redirectUri: string, scopes: string[]): string;

  /** Exchanges the authorization code for a short-lived access token. */
  exchangeCode(code: string, redirectUri: string): Promise<ExchangeCodeResult>;

  /** Exchanges short-lived token for a long-lived user access token. */
  exchangeForLongLivedToken(accessToken: string): Promise<ExchangeCodeResult>;

  /** Lists Instagram Professional accounts linked to Facebook Pages accessible by the user. */
  listAvailableAccounts(accessToken: string): Promise<InstagramAccount[]>;

  /** Validates that the token is still valid and the connection is healthy. */
  validateConnection(accessToken: string): Promise<{ valid: boolean; userId?: string }>;

  /** Attempts to revoke the token (best-effort). */
  revoke(accessToken: string): Promise<void>;
}

export const SOCIAL_PROVIDER_ADAPTER = Symbol('SOCIAL_PROVIDER_ADAPTER');
