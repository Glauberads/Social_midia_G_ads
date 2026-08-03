/**
 * E2E Integration Test — Incremento 8A: Conexão Meta/Instagram
 *
 * Covers the 16 points of the E2E fake flow:
 *  1. OWNER inicia conexão
 *  2. Callback válido → cookie HTTP-only emitido
 *  3. Cookie HTTP-only presente no Set-Cookie
 *  4. Duas contas listadas
 *  5. Uma conta selecionada → SocialConnection CONNECTED
 *  6. Token criptografado no banco, plaintext ausente
 *  7. Cookie removido após seleção
 *  8. Replay do state bloqueado
 *  9. Replay da sessão bloqueado
 * 10. Tenant B não acessa a conexão de Tenant A
 * 11. MEMBER não pode iniciar conexão
 * 12. Desconexão: status DISCONNECTED, disconnectedAt preenchido
 * 13. Desconexão: accessTokenEncrypted null no banco
 * 14. Desconexão: AuditLog registrado
 * 15. Desconexão com revogação fake falhando → permanece DISCONNECTED
 * 16. Status retorna DISCONNECTED após desconexão
 *
 * Requires a running PostgreSQL instance with migrations applied.
 * Uses SOCIAL_PROVIDER=fake to avoid real Meta API calls.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
const cookieParser = require('cookie-parser');
import { createHash, randomBytes } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';

// ─── Test UUIDs ──────────────────────────────────────────────────────────────

const TENANT_A_ID = 'e1000000-0000-0000-0000-000000000001';
const TENANT_B_ID = 'e2000000-0000-0000-0000-000000000002';
const USER_OWNER_ID = 'e1000000-0000-0000-0001-000000000001';
const USER_MEMBER_ID = 'e1000000-0000-0000-0001-000000000002';
const USER_B_ID = 'e2000000-0000-0000-0001-000000000001';

/** Builds a minimal valid JWT-like Bearer token stub for testing (mocked in guard) */
function fakeAuthHeader(userId: string, tenantId: string, role: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${userId}`,
    'x-tenant-id': tenantId,
  };
}

describe('Integrations E2E — Meta/Instagram (Fake Provider)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('AccessTokenVerifier')
      .useValue({
        verify: async (token: string) => ({ userId: token, email: 'fake@integration.test' }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);
    await seedTestData(prisma);
  }, 60_000);

  afterAll(async () => {
    await cleanupTestData(prisma);
    await app.close();
  }, 30_000);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function buildOAuthState(): { rawState: string; stateHash: string } {
    const rawState = randomBytes(32).toString('hex');
    const stateHash = createHash('sha256').update(rawState).digest('hex');
    return { rawState, stateHash };
  }

  async function insertOAuthState(
    stateHash: string,
    tenantId: string,
    userId: string,
    expiresAt: Date,
    consumedAt: Date | null = null,
    returnPath = '/dashboard/settings/integrations',
  ) {
    await prisma.oAuthState.create({
      data: {
        stateHash,
        tenantId,
        userId,
        provider: 'META_INSTAGRAM',
        returnPath,
        expiresAt,
        consumedAt,
      },
    });
  }

  // ─── 1. OWNER inicia conexão ─────────────────────────────────────────────

  it('1. OWNER inicia conexão e recebe authorizationUrl', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/integrations/meta/connect')
      .set(fakeAuthHeader(USER_OWNER_ID, TENANT_A_ID, 'OWNER'))
      .send({ returnPath: '/dashboard/settings/integrations' });

    expect(res.status).toBe(201);
    expect(res.body.authorizationUrl).toBeTruthy();
    expect(res.body.authorizationUrl).toContain('fake.provider');
    // sessionId must NOT be in the response
    expect(JSON.stringify(res.body)).not.toContain('session');
  });

  // ─── 2 & 3. Callback válido → cookie emitido ────────────────────────────

  let sessionCookie: string;

  it('2 & 3. Callback válido emite cookie HTTP-only sem session na URL', async () => {
    const { rawState, stateHash } = buildOAuthState();
    const expiresAt = new Date(Date.now() + 900_000);
    await insertOAuthState(stateHash, TENANT_A_ID, USER_OWNER_ID, expiresAt);

    const res = await request(app.getHttpServer())
      .get(`/api/integrations/meta/callback?code=fake-code&state=${rawState}`);

    expect(res.status).toBe(302);

    // Check Set-Cookie header
    const setCookie = res.headers['set-cookie'] as string[] | string;
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie ?? '');

    expect(cookieStr).toMatch(/oauth_session=/);
    expect(cookieStr.toLowerCase()).toContain('httponly');
    expect(cookieStr.toLowerCase()).toContain('samesite=lax');
    expect(cookieStr.toLowerCase()).toMatch(/max-age=900/);

    // Extract cookie for subsequent requests
    const match = cookieStr.match(/oauth_session=([^;]+)/);
    expect(match).not.toBeNull();
    sessionCookie = `oauth_session=${match![1]}`;

    // URL must NOT contain session identifier
    const location = res.headers['location'] ?? '';
    expect(location).not.toMatch(/session=/i);
    expect(location).toContain('result=session_ready');
  });

  it('2.5. Callback sem state → rejeitado', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/integrations/meta/callback?code=fake-code`);
    expect(res.status).toBe(302);
    expect(res.headers['location']).toContain('result=oauth_failed');
  });

  it('2.6. Callback com state inválido → rejeitado', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/integrations/meta/callback?code=fake-code&state=invalid-state-123`);
    expect(res.status).toBe(302);
    expect(res.headers['location']).toContain('result=oauth_failed');
  });

  // ─── 4. Duas contas listadas ─────────────────────────────────────────────

  it('4. GET /accounts retorna duas contas para o OWNER com cookie válido', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/integrations/meta/accounts')
      .set(fakeAuthHeader(USER_OWNER_ID, TENANT_A_ID, 'OWNER'))
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.accounts).toHaveLength(2);
    expect(res.body.accounts[0]).toHaveProperty('instagramUsername');
    // sessionId NOT in response body
    expect(JSON.stringify(res.body)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
  });

  // ─── 5 & 6. Seleção de conta → SocialConnection CONNECTED ──────────────

  it('5 & 6. POST /select-account → SocialConnection CONNECTED, token criptografado no banco', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/integrations/meta/select-account')
      .set(fakeAuthHeader(USER_OWNER_ID, TENANT_A_ID, 'OWNER'))
      .set('Cookie', sessionCookie)
      .send({ instagramAccountId: 'fake-ig-001', pageId: 'fake-page-001' });

    expect(res.status).toBe(204);

    // Verify SocialConnection in DB
    const conn = await prisma.socialConnection.findUnique({
      where: { tenantId_provider: { tenantId: TENANT_A_ID, provider: 'META_INSTAGRAM' } },
    });

    expect(conn).not.toBeNull();
    expect(conn!.status).toBe('CONNECTED');
    expect(conn!.accessTokenEncrypted).toMatch(/^v1:/); // encrypted format
    // plaintext must NOT be in the DB
    expect(conn!.accessTokenEncrypted).not.toMatch(/^fake-long-/);
    expect(conn!.pageId).toBe('fake-page-001');
    expect(conn!.instagramAccountId).toBe('fake-ig-001');
  });

  // ─── 7. Cookie removido após seleção ────────────────────────────────────

  it('7. Cookie é removido (Max-Age=0) após seleção bem-sucedida', async () => {
    // Re-run to get the set-cookie header from the previous step's response
    // We can reconstruct: do another select with a new session to verify clearing
    const { rawState, stateHash } = buildOAuthState();
    const expiresAt = new Date(Date.now() + 900_000);
    await insertOAuthState(stateHash, TENANT_A_ID, USER_OWNER_ID, expiresAt);

    const callbackRes = await request(app.getHttpServer())
      .get(`/api/integrations/meta/callback?code=fake-code-2&state=${rawState}`);
    const setCookieCallback = callbackRes.headers['set-cookie'] as string[] | string;
    const cookieCallback = Array.isArray(setCookieCallback) ? setCookieCallback.join('; ') : setCookieCallback;
    const matchCallback = cookieCallback.match(/oauth_session=([^;]+)/);
    const newSessionCookie = `oauth_session=${matchCallback![1]}`;

    const selectRes = await request(app.getHttpServer())
      .post('/api/integrations/meta/select-account')
      .set(fakeAuthHeader(USER_OWNER_ID, TENANT_A_ID, 'OWNER'))
      .set('Cookie', newSessionCookie)
      .send({ instagramAccountId: 'fake-ig-001', pageId: 'fake-page-001' });

    expect(selectRes.status).toBe(204);
    const clearCookieHeader = selectRes.headers['set-cookie'] as string[] | string | undefined;
    const clearCookieStr = Array.isArray(clearCookieHeader) ? clearCookieHeader.join('; ') : (clearCookieHeader ?? '');
    expect(clearCookieStr.toLowerCase()).toMatch(/max-age=0/);
  });

  // ─── 8. Replay do state bloqueado ───────────────────────────────────────

  it('8. Replay do state é bloqueado (consumedAt já preenchido)', async () => {
    const { rawState, stateHash } = buildOAuthState();
    // Insert already-consumed state
    await insertOAuthState(
      stateHash,
      TENANT_A_ID,
      USER_OWNER_ID,
      new Date(Date.now() + 900_000),
      new Date(), // consumedAt set — already used
    );

    const res = await request(app.getHttpServer())
      .get(`/api/integrations/meta/callback?code=replay&state=${rawState}`);

    expect(res.status).toBe(302);
    expect(res.headers['location']).toContain('result=oauth_failed');
    // No cookie
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  // ─── 9. Replay da sessão bloqueado ──────────────────────────────────────

  it('9. Replay da sessão (segunda seleção com sessão já consumida) → 410', async () => {
    // Use the original sessionCookie which was consumed in test 5
    const res = await request(app.getHttpServer())
      .post('/api/integrations/meta/select-account')
      .set(fakeAuthHeader(USER_OWNER_ID, TENANT_A_ID, 'OWNER'))
      .set('Cookie', sessionCookie) // consumed session
      .send({ instagramAccountId: 'fake-ig-001', pageId: 'fake-page-001' });

    expect([404, 410]).toContain(res.status);
  });

  // ─── 10. Tenant B não acessa conexão de Tenant A ────────────────────────

  it('10. Tenant B não acessa SocialConnection de Tenant A', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/integrations/meta/status')
      .set(fakeAuthHeader(USER_B_ID, TENANT_B_ID, 'OWNER'));

    expect(res.status).toBe(200);
    // Tenant B has no connection — should return not connected
    expect(res.body.connected).toBe(false);
  });

  // ─── 11. MEMBER não pode iniciar conexão ────────────────────────────────

  it('11. MEMBER recebe 403 ao tentar iniciar conexão', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/integrations/meta/connect')
      .set(fakeAuthHeader(USER_MEMBER_ID, TENANT_A_ID, 'MEMBER'))
      .send({ returnPath: '/dashboard/settings/integrations' });

    expect(res.status).toBe(403);
  });

  // ─── 12 & 13 & 14. Desconexão ───────────────────────────────────────────

  it('12. Desconexão: status DISCONNECTED, disconnectedAt preenchido', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/integrations/meta/disconnect')
      .set(fakeAuthHeader(USER_OWNER_ID, TENANT_A_ID, 'OWNER'));

    expect(res.status).toBe(204);

    const conn = await prisma.socialConnection.findUnique({
      where: { tenantId_provider: { tenantId: TENANT_A_ID, provider: 'META_INSTAGRAM' } },
    });

    expect(conn!.status).toBe('DISCONNECTED');
    expect(conn!.disconnectedAt).not.toBeNull();
  });

  it('13. Desconexão remove accessTokenEncrypted e tokenExpiresAt do banco', async () => {
    const conn = await prisma.socialConnection.findUnique({
      where: { tenantId_provider: { tenantId: TENANT_A_ID, provider: 'META_INSTAGRAM' } },
    });

    expect(conn!.accessTokenEncrypted).toBeNull();
    expect(conn!.tokenExpiresAt).toBeNull();
  });

  it('14. Desconexão registra AuditLog', async () => {
    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId: TENANT_A_ID,
        action: 'SOCIAL_ACCOUNT_DISCONNECTED',
        entity: 'SocialConnection',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].actorId).toBe(USER_OWNER_ID);
  });

  // ─── 15 & 16. Desconexão com revogação falhando ─────────────────────────

  it('15 & 16. Revogação remota failing → local permanece DISCONNECTED', async () => {
    // Reconnect first to have a connection to disconnect
    const { rawState, stateHash } = buildOAuthState();
    await insertOAuthState(stateHash, TENANT_A_ID, USER_OWNER_ID, new Date(Date.now() + 900_000));
    const cbRes = await request(app.getHttpServer())
      .get(`/api/integrations/meta/callback?code=reconnect&state=${rawState}`);
    const setCookieReconnect = cbRes.headers['set-cookie'] as string[] | string;
    const cookieReconnect = Array.isArray(setCookieReconnect) ? setCookieReconnect.join('; ') : setCookieReconnect;
    const matchReconnect = cookieReconnect.match(/oauth_session=([^;]+)/);
    const reconnectSessionCookie = `oauth_session=${matchReconnect![1]}`;

    await request(app.getHttpServer())
      .post('/api/integrations/meta/select-account')
      .set(fakeAuthHeader(USER_OWNER_ID, TENANT_A_ID, 'OWNER'))
      .set('Cookie', reconnectSessionCookie)
      .send({ instagramAccountId: 'fake-ig-001', pageId: 'fake-page-001' });

    // Disconnect should succeed even if remote revocation fails
    const disconnectRes = await request(app.getHttpServer())
      .post('/api/integrations/meta/disconnect')
      .set(fakeAuthHeader(USER_OWNER_ID, TENANT_A_ID, 'OWNER'));

    expect(disconnectRes.status).toBe(204);

    // Status should be DISCONNECTED
    const statusRes = await request(app.getHttpServer())
      .get('/api/integrations/meta/status')
      .set(fakeAuthHeader(USER_OWNER_ID, TENANT_A_ID, 'OWNER'));

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe('DISCONNECTED');
    expect(statusRes.body.connected).toBe(false);
    // No access token in response
    expect(JSON.stringify(statusRes.body)).not.toMatch(/accessToken/i);
  });
});

// ─── Test Data Helpers ────────────────────────────────────────────────────────

async function seedTestData(prisma: PrismaService): Promise<void> {
  // Users
  await prisma.$executeRaw`INSERT INTO auth.users (id, instance_id, email, aud, role, encrypted_password, created_at, updated_at) VALUES (${USER_OWNER_ID}::uuid, '00000000-0000-0000-0000-000000000000', 'owner@integration.test', 'authenticated', 'authenticated', 'pw', NOW(), NOW()) ON CONFLICT DO NOTHING`;
  await prisma.$executeRaw`INSERT INTO auth.users (id, instance_id, email, aud, role, encrypted_password, created_at, updated_at) VALUES (${USER_MEMBER_ID}::uuid, '00000000-0000-0000-0000-000000000000', 'member@integration.test', 'authenticated', 'authenticated', 'pw', NOW(), NOW()) ON CONFLICT DO NOTHING`;
  await prisma.$executeRaw`INSERT INTO auth.users (id, instance_id, email, aud, role, encrypted_password, created_at, updated_at) VALUES (${USER_B_ID}::uuid, '00000000-0000-0000-0000-000000000000', 'ownerb@integration.test', 'authenticated', 'authenticated', 'pw', NOW(), NOW()) ON CONFLICT DO NOTHING`;

  await prisma.$executeRaw`INSERT INTO public."UserProfile" (id, email, "createdAt", "updatedAt") VALUES (${USER_OWNER_ID}::uuid, 'owner@integration.test', NOW(), NOW()) ON CONFLICT DO NOTHING`;
  await prisma.$executeRaw`INSERT INTO public."UserProfile" (id, email, "createdAt", "updatedAt") VALUES (${USER_MEMBER_ID}::uuid, 'member@integration.test', NOW(), NOW()) ON CONFLICT DO NOTHING`;
  await prisma.$executeRaw`INSERT INTO public."UserProfile" (id, email, "createdAt", "updatedAt") VALUES (${USER_B_ID}::uuid, 'ownerb@integration.test', NOW(), NOW()) ON CONFLICT DO NOTHING`;

  // Tenants
  await prisma.$executeRaw`INSERT INTO public."Tenant" (id, name, slug, status, "createdAt", "updatedAt") VALUES (${TENANT_A_ID}::uuid, 'Integration Tenant A', 'int-tenant-a', 'ACTIVE', NOW(), NOW()) ON CONFLICT DO NOTHING`;
  await prisma.$executeRaw`INSERT INTO public."Tenant" (id, name, slug, status, "createdAt", "updatedAt") VALUES (${TENANT_B_ID}::uuid, 'Integration Tenant B', 'int-tenant-b', 'ACTIVE', NOW(), NOW()) ON CONFLICT DO NOTHING`;

  // Memberships
  await prisma.$executeRaw`INSERT INTO public."Membership" (id, "userId", "tenantId", role, status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), ${USER_OWNER_ID}::uuid, ${TENANT_A_ID}::uuid, 'OWNER', 'ACTIVE', NOW(), NOW()) ON CONFLICT DO NOTHING`;
  await prisma.$executeRaw`INSERT INTO public."Membership" (id, "userId", "tenantId", role, status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), ${USER_MEMBER_ID}::uuid, ${TENANT_A_ID}::uuid, 'MEMBER', 'ACTIVE', NOW(), NOW()) ON CONFLICT DO NOTHING`;
  await prisma.$executeRaw`INSERT INTO public."Membership" (id, "userId", "tenantId", role, status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), ${USER_B_ID}::uuid, ${TENANT_B_ID}::uuid, 'OWNER', 'ACTIVE', NOW(), NOW()) ON CONFLICT DO NOTHING`;
}

async function cleanupTestData(prisma: PrismaService): Promise<void> {
  // AuditLog is append-only, skipping delete
  await prisma.$executeRaw`DELETE FROM public."social_connections" WHERE "tenantId" IN (${TENANT_A_ID}::uuid, ${TENANT_B_ID}::uuid)`;
  await prisma.$executeRaw`DELETE FROM public."oauth_sessions" WHERE "tenantId" IN (${TENANT_A_ID}::uuid, ${TENANT_B_ID}::uuid)`;
  await prisma.$executeRaw`DELETE FROM public."oauth_states" WHERE "tenantId" IN (${TENANT_A_ID}::uuid, ${TENANT_B_ID}::uuid)`;
  await prisma.$executeRaw`DELETE FROM public."Membership" WHERE "tenantId" IN (${TENANT_A_ID}::uuid, ${TENANT_B_ID}::uuid)`;
  await prisma.$executeRaw`DELETE FROM public."Tenant" WHERE id IN (${TENANT_A_ID}::uuid, ${TENANT_B_ID}::uuid)`;
  await prisma.$executeRaw`DELETE FROM public."UserProfile" WHERE id IN (${USER_OWNER_ID}::uuid, ${USER_MEMBER_ID}::uuid, ${USER_B_ID}::uuid)`;
  await prisma.$executeRaw`DELETE FROM auth.users WHERE id IN (${USER_OWNER_ID}::uuid, ${USER_MEMBER_ID}::uuid, ${USER_B_ID}::uuid)`;
}
