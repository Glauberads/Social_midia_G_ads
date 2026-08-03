/**
 * Cookie and Session Security Tests — Incremento 8A
 *
 * Tests that:
 * 1. The HTTP-only cookie is emitted correctly on callback success.
 * 2. SameSite=Lax is present.
 * 3. Secure attribute is controlled by NODE_ENV.
 * 4. The sessionId never appears in the redirect URL, response body, or any header
 *    other than Set-Cookie.
 * 5. GET /accounts requires the cookie and rejects absent, malformed, expired,
 *    consumed, and cross-tenant sessions.
 * 6. POST /select-account clears the cookie on success.
 * 7. Second POST /select-account with the same (consumed) session is rejected.
 *
 * All tests use the FakeSocialProviderAdapter and mock the database layer
 * so no real database connection is required for the unit test suite.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { InstagramConnectionsController } from '../presentation/controllers/instagram-connections.controller';
import { StartOAuthFlowUseCase } from '../application/use-cases/start-oauth-flow.use-case';
import { HandleOAuthCallbackUseCase } from '../application/use-cases/handle-oauth-callback.use-case';
import { ListAvailableAccountsUseCase } from '../application/use-cases/list-available-accounts.use-case';
import { SelectSocialAccountUseCase } from '../application/use-cases/select-social-account.use-case';
import { GetSocialConnectionStatusUseCase } from '../application/use-cases/get-social-connection-status.use-case';
import { DisconnectSocialConnectionUseCase } from '../application/use-cases/disconnect-social-connection.use-case';

// ─── Mock Use Cases ───────────────────────────────────────────────────────────

const FAKE_SESSION_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const mockHandleCallback = { execute: jest.fn() };
const mockListAccounts = { execute: jest.fn() };
const mockSelectAccount = { execute: jest.fn() };
const mockStartOAuth = { execute: jest.fn() };
const mockGetStatus = { execute: jest.fn() };
const mockDisconnect = { execute: jest.fn() };

async function buildApp(nodeEnv = 'test'): Promise<INestApplication> {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;

  const module: TestingModule = await Test.createTestingModule({
    controllers: [InstagramConnectionsController],
    providers: [
      { provide: StartOAuthFlowUseCase, useValue: mockStartOAuth },
      { provide: HandleOAuthCallbackUseCase, useValue: mockHandleCallback },
      { provide: ListAvailableAccountsUseCase, useValue: mockListAccounts },
      { provide: SelectSocialAccountUseCase, useValue: mockSelectAccount },
      { provide: GetSocialConnectionStatusUseCase, useValue: mockGetStatus },
      { provide: DisconnectSocialConnectionUseCase, useValue: mockDisconnect },
    ],
  }).compile();

  const app = module.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');
  await app.init();

  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InstagramConnections — Cookie Security', () => {
  let app: INestApplication;
  let originalEnv: string | undefined;

  beforeAll(async () => {
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    app = await buildApp('test');
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalEnv;
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Callback: Cookie emission ─────────────────────────────────────────────

  describe('GET /api/integrations/meta/callback', () => {
    it('emits HTTP-only Set-Cookie with sessionId on success', async () => {
      mockHandleCallback.execute.mockResolvedValue({
        sessionId: FAKE_SESSION_ID,
        returnPath: '/dashboard/settings/integrations?result=session_ready',
        tenantId: 'tenant-111',
        tokenExpiresAt: new Date(Date.now() + 5_184_000_000),
      });

      const res = await request(app.getHttpServer())
        .get('/api/integrations/meta/callback?code=abc&state=xyz');

      expect(res.status).toBe(302);

      const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie ?? '');

      // Cookie must be present
      expect(cookieStr).toMatch(/oauth_session=/);

      // Must be HttpOnly
      expect(cookieStr.toLowerCase()).toContain('httponly');

      // Must be SameSite=Lax
      expect(cookieStr.toLowerCase()).toContain('samesite=lax');

      // Must have Max-Age (15 min = 900s)
      expect(cookieStr.toLowerCase()).toMatch(/max-age=900/);

      // Must restrict path
      expect(cookieStr.toLowerCase()).toContain('path=/api/integrations/meta');
    });

    it('does NOT put sessionId in the redirect Location header', async () => {
      mockHandleCallback.execute.mockResolvedValue({
        sessionId: FAKE_SESSION_ID,
        returnPath: '/dashboard/settings/integrations?result=session_ready',
        tenantId: 'tenant-111',
        tokenExpiresAt: new Date(Date.now() + 5_184_000_000),
      });

      const res = await request(app.getHttpServer())
        .get('/api/integrations/meta/callback?code=abc&state=xyz');

      const location = res.headers['location'] ?? '';
      // sessionId must not appear in URL
      expect(location).not.toContain(FAKE_SESSION_ID);
      expect(location).not.toMatch(/session=/i);
      // Result should be a clean redirect with ?result=session_ready
      expect(location).toContain('result=session_ready');
    });

    it('does NOT put sessionId in response body', async () => {
      mockHandleCallback.execute.mockResolvedValue({
        sessionId: FAKE_SESSION_ID,
        returnPath: '/dashboard/settings/integrations?result=session_ready',
        tenantId: 'tenant-111',
        tokenExpiresAt: new Date(Date.now() + 5_184_000_000),
      });

      const res = await request(app.getHttpServer())
        .get('/api/integrations/meta/callback?code=abc&state=xyz');

      const body = JSON.stringify(res.body);
      expect(body).not.toContain(FAKE_SESSION_ID);
    });

    it('Secure flag is ABSENT in non-production (NODE_ENV=test)', async () => {
      mockHandleCallback.execute.mockResolvedValue({
        sessionId: FAKE_SESSION_ID,
        returnPath: '/dashboard/settings/integrations?result=session_ready',
        tenantId: 'tenant-111',
        tokenExpiresAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .get('/api/integrations/meta/callback?code=abc&state=xyz');

      const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie ?? '');
      // In test environment Secure should NOT be set
      expect(cookieStr.toLowerCase()).not.toContain('; secure');
    });

    it('redirects with ?result=oauth_denied when error query present', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/integrations/meta/callback?error=access_denied');

      expect(res.status).toBe(302);
      expect(res.headers['location']).toContain('result=oauth_denied');
      // No cookie emitted
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeUndefined();
    });

    it('redirects with ?result=oauth_failed when use case throws', async () => {
      mockHandleCallback.execute.mockRejectedValue(new Error('invalid_state'));

      const res = await request(app.getHttpServer())
        .get('/api/integrations/meta/callback?code=bad&state=bad');

      expect(res.status).toBe(302);
      expect(res.headers['location']).toContain('result=oauth_failed');
      // No cookie emitted on failure
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeUndefined();
    });

    it('redirects with ?result=oauth_failed when code or state missing', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/integrations/meta/callback');

      expect(res.status).toBe(302);
      expect(res.headers['location']).toContain('result=oauth_failed');
    });
  });

  // ─── Accounts: requires cookie ─────────────────────────────────────────────

  describe('GET /api/integrations/meta/accounts', () => {
    it('returns 401 when no cookie is present', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/integrations/meta/accounts')
        .set('x-tenant-id', 'tenant-aaa');

      expect(res.status).toBe(401);
    });

    it('returns 400 when cookie value is not a valid UUID', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/integrations/meta/accounts')
        .set('x-tenant-id', 'tenant-aaa')
        .set('Cookie', 'oauth_session=not-a-uuid-at-all');

      expect(res.status).toBe(400);
    });

    it('returns 401 when cookie is an empty string', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/integrations/meta/accounts')
        .set('x-tenant-id', 'tenant-aaa')
        .set('Cookie', 'oauth_session=');

      expect(res.status).toBe(401);
    });

    it('propagates 410 (GoneException) when session is expired', async () => {
      const { GoneException } = await import('@nestjs/common');
      mockListAccounts.execute.mockRejectedValue(new GoneException('OAuth session has expired.'));

      const res = await request(app.getHttpServer())
        .get('/api/integrations/meta/accounts')
        .set('x-tenant-id', 'tenant-aaa')
        .set('Cookie', `oauth_session=${FAKE_SESSION_ID}`);

      expect(res.status).toBe(410);
    });

    it('propagates 410 when session is already consumed', async () => {
      const { GoneException } = await import('@nestjs/common');
      mockListAccounts.execute.mockRejectedValue(new GoneException('OAuth session has already been used.'));

      const res = await request(app.getHttpServer())
        .get('/api/integrations/meta/accounts')
        .set('x-tenant-id', 'tenant-aaa')
        .set('Cookie', `oauth_session=${FAKE_SESSION_ID}`);

      expect(res.status).toBe(410);
    });

    it('propagates 404 when session belongs to another tenant', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockListAccounts.execute.mockRejectedValue(new NotFoundException('OAuth session not found.'));

      const res = await request(app.getHttpServer())
        .get('/api/integrations/meta/accounts')
        .set('x-tenant-id', 'tenant-bbb')
        .set('Cookie', `oauth_session=${FAKE_SESSION_ID}`);

      expect(res.status).toBe(404);
    });

    it('propagates 401 when session belongs to another user', async () => {
      const { UnauthorizedException } = await import('@nestjs/common');
      mockListAccounts.execute.mockRejectedValue(
        new UnauthorizedException('OAuth session belongs to a different user.'),
      );

      const res = await request(app.getHttpServer())
        .get('/api/integrations/meta/accounts')
        .set('x-tenant-id', 'tenant-aaa')
        .set('Cookie', `oauth_session=${FAKE_SESSION_ID}`);

      expect(res.status).toBe(401);
    });

    it('returns accounts list when session is valid', async () => {
      mockListAccounts.execute.mockResolvedValue([
        { pageId: 'p1', pageName: 'Page One', instagramAccountId: 'ig1', instagramUsername: 'user_one' },
        { pageId: 'p2', pageName: 'Page Two', instagramAccountId: 'ig2', instagramUsername: 'user_two' },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/integrations/meta/accounts')
        .set('x-tenant-id', 'tenant-aaa')
        .set('Cookie', `oauth_session=${FAKE_SESSION_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.accounts).toHaveLength(2);
      // sessionId must NOT be in the response body
      expect(JSON.stringify(res.body)).not.toContain(FAKE_SESSION_ID);
    });
  });

  // ─── Select Account: clears cookie on success ──────────────────────────────

  describe('POST /api/integrations/meta/select-account', () => {
    it('returns 401 when no cookie is present', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/integrations/meta/select-account')
        .set('x-tenant-id', 'tenant-aaa')
        .send({ instagramAccountId: 'ig1', pageId: 'p1' });

      expect(res.status).toBe(401);
    });

    it('clears the session cookie (Max-Age=0) upon success', async () => {
      mockSelectAccount.execute.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer())
        .post('/api/integrations/meta/select-account')
        .set('x-tenant-id', 'tenant-aaa')
        .set('Cookie', `oauth_session=${FAKE_SESSION_ID}`)
        .send({ instagramAccountId: 'ig1', pageId: 'p1' });

      expect(res.status).toBe(204);

      const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie ?? '');
      // The clearing Set-Cookie must appear
      expect(cookieStr).toMatch(/oauth_session=/);
      expect(cookieStr.toLowerCase()).toMatch(/max-age=0/);
    });

    it('propagates 410 on replay (session already consumed)', async () => {
      const { GoneException } = await import('@nestjs/common');
      mockSelectAccount.execute.mockRejectedValue(new GoneException('OAuth session has already been used.'));

      const res = await request(app.getHttpServer())
        .post('/api/integrations/meta/select-account')
        .set('x-tenant-id', 'tenant-aaa')
        .set('Cookie', `oauth_session=${FAKE_SESSION_ID}`)
        .send({ instagramAccountId: 'ig1', pageId: 'p1' });

      expect(res.status).toBe(410);
    });

    it('sessionId is NOT present in request body to the use case', async () => {
      mockSelectAccount.execute.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post('/api/integrations/meta/select-account')
        .set('x-tenant-id', 'tenant-aaa')
        .set('Cookie', `oauth_session=${FAKE_SESSION_ID}`)
        .send({ instagramAccountId: 'ig1', pageId: 'p1' });

      // The use case receives sessionId from cookie injection, not from the HTTP body
      const callArg = mockSelectAccount.execute.mock.calls[0]?.[0];
      expect(callArg?.sessionId).toBe(FAKE_SESSION_ID);
      // instagramAccountId from body
      expect(callArg?.instagramAccountId).toBe('ig1');
      expect(callArg?.pageId).toBe('p1');
    });
  });

  // ─── Disconnect: clears cookie ─────────────────────────────────────────────

  describe('POST /api/integrations/meta/disconnect', () => {
    it('clears the session cookie if present during disconnect', async () => {
      mockDisconnect.execute.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer())
        .post('/api/integrations/meta/disconnect')
        .set('x-tenant-id', 'tenant-aaa')
        .set('Cookie', `oauth_session=${FAKE_SESSION_ID}`);

      expect(res.status).toBe(204);

      const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie ?? '');
      expect(cookieStr.toLowerCase()).toMatch(/max-age=0/);
    });
  });

  // ─── Security: sessionId never in URL, DOM, localStorage, sessionStorage ───

  describe('Security invariants', () => {
    it('callback success: sessionId absent from all response headers except Set-Cookie', async () => {
      mockHandleCallback.execute.mockResolvedValue({
        sessionId: FAKE_SESSION_ID,
        returnPath: '/dashboard/settings/integrations?result=session_ready',
        tenantId: 'tenant-111',
        tokenExpiresAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .get('/api/integrations/meta/callback?code=x&state=y');

      const headersJson = JSON.stringify(
        Object.fromEntries(
          Object.entries(res.headers).filter(([key]) => key !== 'set-cookie'),
        ),
      );
      expect(headersJson).not.toContain(FAKE_SESSION_ID);
    });

    it('accounts response: sessionId absent from JSON body', async () => {
      mockListAccounts.execute.mockResolvedValue([
        { pageId: 'p1', pageName: 'Page', instagramAccountId: 'ig1', instagramUsername: 'user' },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/integrations/meta/accounts')
        .set('x-tenant-id', 'tenant-aaa')
        .set('Cookie', `oauth_session=${FAKE_SESSION_ID}`);

      expect(JSON.stringify(res.body)).not.toContain(FAKE_SESSION_ID);
    });
  });
});

// ─── Production cookie tests ─────────────────────────────────────────────────

describe('InstagramConnections — Cookie Secure flag in Production', () => {
  let app: INestApplication;
  let originalEnv: string | undefined;

  beforeAll(async () => {
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    app = await buildApp('production');
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalEnv;
    await app.close();
  });

  it('Secure flag IS present in production', async () => {
    mockHandleCallback.execute.mockResolvedValue({
      sessionId: FAKE_SESSION_ID,
      returnPath: '/dashboard/settings/integrations?result=session_ready',
      tenantId: 'tenant-111',
      tokenExpiresAt: new Date(),
    });

    const res = await request(app.getHttpServer())
      .get('/api/integrations/meta/callback?code=abc&state=xyz');

    const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie ?? '');
    // In production the Secure flag must be present
    expect(cookieStr.toLowerCase()).toContain('secure');
  });
});
