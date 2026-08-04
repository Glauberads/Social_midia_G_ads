import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  ExchangeCodeResult,
  InstagramAccount,
  SocialProviderAdapter,
} from '../../domain/ports/social-provider.adapter';

// ─── Zod schemas for Graph API response validation ───────────────────────────

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().int().positive().optional().nullable(),
});

const PageSchema = z.object({
  id: z.string(),
  name: z.string(),
  access_token: z.string().optional(),
  instagram_business_account: z.object({ id: z.string() }).optional().nullable(),
});

const PagesResponseSchema = z.object({
  data: z.array(PageSchema),
});

const IgAccountSchema = z.object({
  id: z.string(),
  username: z.string(),
});

const ValidateResponseSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
});

// ─── Retry helpers ────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function isTransient(status: number): boolean {
  return status >= 500 || status === 429;
}

// ─── Meta Instagram Adapter ───────────────────────────────────────────────────

@Injectable()
export class MetaInstagramAdapter implements SocialProviderAdapter, OnModuleInit {
  private readonly logger = new Logger(MetaInstagramAdapter.name);
  private appId!: string;
  private appSecret!: string;
  private redirectUri!: string;
  private apiVersion!: string;
  private readonly maxRetries = 3;
  private readonly timeoutMs = 15_000;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.appId = this.configService.getOrThrow<string>('META_APP_ID');
    this.appSecret = this.configService.getOrThrow<string>('META_APP_SECRET');
    this.redirectUri = this.configService.getOrThrow<string>('META_REDIRECT_URI');
    this.apiVersion = this.configService.getOrThrow<string>('META_GRAPH_API_VERSION');

    if (!/^v\d+\.\d+$/.test(this.apiVersion)) {
      throw new Error(`[MetaInstagramAdapter] META_GRAPH_API_VERSION is invalid: ${this.apiVersion}`);
    }

    this.logger.log(`MetaInstagramAdapter initialized. Graph API ${this.apiVersion}`);
  }

  private get baseUrl(): string {
    return `https://graph.facebook.com/${this.apiVersion}`;
  }

  buildAuthorizationUrl(state: string, _redirectUri: string, scopes: string[]): string {
    // redirect_uri is always taken from server config — not from caller
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      state,
      response_type: 'code',
      scope: scopes.join(','),
    });
    return `https://www.facebook.com/${this.apiVersion}/dialog/oauth?${params}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async exchangeCode(code: string, _redirectUri: string): Promise<ExchangeCodeResult> {
    const params = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: this.redirectUri,
      code,
    });
    const data = await this.fetchWithRetry<z.infer<typeof TokenResponseSchema>>(
      `${this.baseUrl}/oauth/access_token?${params}`,
      { method: 'GET' },
      TokenResponseSchema,
    );
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in ?? null,
      scopes: ['pages_show_list', 'pages_read_engagement', 'instagram_basic'],
    };
  }

  async exchangeForLongLivedToken(accessToken: string): Promise<ExchangeCodeResult> {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: accessToken,
    });
    const data = await this.fetchWithRetry<z.infer<typeof TokenResponseSchema>>(
      `${this.baseUrl}/oauth/access_token?${params}`,
      { method: 'GET' },
      TokenResponseSchema,
    );
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in ?? null,
      scopes: ['pages_show_list', 'pages_read_engagement', 'instagram_basic'],
    };
  }

  async listAvailableAccounts(accessToken: string): Promise<InstagramAccount[]> {
    const params = new URLSearchParams({
      fields: 'id,name,access_token,instagram_business_account',
      access_token: accessToken,
    });

    const pagesData = await this.fetchWithRetry<z.infer<typeof PagesResponseSchema>>(
      `${this.baseUrl}/me/accounts?${params}`,
      { method: 'GET' },
      PagesResponseSchema,
    );

    const accounts: InstagramAccount[] = [];

    for (const page of pagesData.data) {
      if (!page.instagram_business_account?.id) continue;

      const igId = page.instagram_business_account.id;
      const igParams = new URLSearchParams({
        fields: 'id,username',
        access_token: accessToken,
      });

      try {
        const igData = await this.fetchWithRetry<z.infer<typeof IgAccountSchema>>(
          `${this.baseUrl}/${igId}?${igParams}`,
          { method: 'GET' },
          IgAccountSchema,
        );
        accounts.push({
          pageId: page.id,
          pageName: page.name,
          instagramAccountId: igData.id,
          instagramUsername: igData.username,
        });
      } catch (err) {
        this.logger.warn(`[MetaInstagramAdapter] Could not fetch IG account ${igId}: ${(err as Error).message}`);
      }
    }

    return accounts;
  }

  async validateConnection(accessToken: string): Promise<{ userId: string }> {
    const params = new URLSearchParams({
      fields: 'id,name',
      access_token: accessToken,
    });
    const data = await this.fetchWithRetry<z.infer<typeof ValidateResponseSchema>>(
      `${this.baseUrl}/me?${params}`,
      { method: 'GET' },
      ValidateResponseSchema,
    );
    return { userId: data.id };
  }

  async revoke(accessToken: string): Promise<void> {
    const params = new URLSearchParams({ access_token: accessToken });
    // best effort — do not throw if revocation fails
    try {
      await this.fetchWithRetry<unknown>(
        `${this.baseUrl}/me/permissions?${params}`,
        { method: 'DELETE' },
        z.unknown(),
      );
    } catch (err) {
      this.logger.warn(`[MetaInstagramAdapter] Token revocation failed: ${(err as Error).message}`);
    }
  }

  private async fetchWithRetry<T>(
    url: string,
    init: RequestInit,
    schema: z.ZodType<T>,
    attempt = 1,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      clearTimeout(timeout);
      const isTimeout = (err as Error).name === 'AbortError';
      if (!isTimeout && attempt < this.maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 200 + Math.random() * 100;
        await sleep(delay);
        return this.fetchWithRetry(url, init, schema, attempt + 1);
      }
      throw Object.assign(new Error(isTimeout ? 'Request timed out' : (err as Error).message), {
        code: isTimeout ? 'TIMEOUT' : 'FETCH_ERROR',
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const status = response.status;
      // 429: respect Retry-After
      if (status === 429 && attempt < this.maxRetries) {
        const retryAfter = parseInt(response.headers.get('Retry-After') ?? '1', 10);
        await sleep(retryAfter * 1000);
        return this.fetchWithRetry(url, init, schema, attempt + 1);
      }
      // Transient 5xx — retry with backoff
      if (isTransient(status) && status !== 429 && attempt < this.maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 300 + Math.random() * 150;
        await sleep(delay);
        return this.fetchWithRetry(url, init, schema, attempt + 1);
      }
      let errCode: number | undefined;
      let errSubcode: number | undefined;
      let errType: string | undefined;
      try {
        const bodyText = await response.text();
        const bodyJson = JSON.parse(bodyText);
        errCode = bodyJson?.error?.code;
        errSubcode = bodyJson?.error?.error_subcode;
        errType = bodyJson?.error?.type;
      } catch {
        // ignore parsing errors
      }
      this.logger.error(`[MetaInstagramAdapter] HTTP ${status} — response body redacted`);
      throw Object.assign(new Error(`Meta Graph API error: HTTP ${status}`), { 
        code: 'PROVIDER_ERROR', 
        status, 
        graphErrorCode: errCode,
        graphErrorSubcode: errSubcode,
        graphErrorType: errType
      });
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw Object.assign(new Error('Malformed JSON from Meta Graph API'), { code: 'MALFORMED_RESPONSE' });
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      this.logger.error('[MetaInstagramAdapter] Response schema validation failed');
      throw Object.assign(new Error('Unexpected response schema from Meta Graph API'), { code: 'MALFORMED_RESPONSE' });
    }

    return parsed.data;
  }
}
