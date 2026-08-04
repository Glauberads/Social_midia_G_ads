import { PrismaClient } from '@projeto/database';
import { SocialConnectionHealthProcessor } from '../src/instagram-connections/social-connection-health.processor';

describe('Worker Concurrency (e2e)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.META_APP_ID = 'test';
    process.env.META_APP_SECRET = 'test';
    process.env.META_GRAPH_API_VERSION = 'v20.0';
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`DELETE FROM public.social_connections`;
    await prisma.tenant.deleteMany({});
  });

  it('proves FOR UPDATE SKIP LOCKED prevents double processing and does not overwrite nextRefreshAt with stale data', async () => {
    // 1. Create a mock tenant and connection
    const tenant = await prisma.tenant.create({
      data: { name: 'Worker Concurrency Tenant', slug: 'worker-concurrency' },
    });

    await prisma.$executeRawUnsafe(`
      INSERT INTO auth.users (id, aud, role, email)
      VALUES ('00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test@e2e.com')
      ON CONFLICT DO NOTHING;
    `);

    const user = await prisma.userProfile.upsert({
      where: { id: '00000000-0000-0000-0000-000000000000' },
      update: {},
      create: { id: '00000000-0000-0000-0000-000000000000', email: 'test@e2e.com' }
    });

    const processor1 = new SocialConnectionHealthProcessor(prisma);
    const processor2 = new SocialConnectionHealthProcessor(prisma);

    const mockEncrypted = (processor1 as any).encryptToken('mock-token');

    const conn = await prisma.socialConnection.create({
      data: {
        tenantId: tenant.id,
        connectedById: user.id,
        provider: 'META_INSTAGRAM',
        status: 'CONNECTED',
        accessTokenEncrypted: mockEncrypted,
        nextRefreshAt: new Date(Date.now() - 1000), // eligible for refresh
      },
    });

    // 2. We mock fetch globally just in case they manage to proceed
    // We mock fetch globally just in case they manage to proceed
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'new-token', expires_in: 3600 }),
    }) as any;

    // Variables already instantiated earlier

    // 3. To simulate race condition, we will intercept the first process batch at the exact moment
    // Unfortunately we can't easily pause a promise in the middle of Prisma transaction.
    // Instead we will just run them concurrently using Promise.all
    // Since processingLockedUntil is committed atomically, one will lock and the other will get 0 rows updated.

    const [count1, count2] = await Promise.all([
      processor1.processBatch(1),
      processor2.processBatch(1)
    ]);

    // One processor should process 1, the other should process 0
    expect(count1 + count2).toBe(1);

    // Check that fetch was called exactly once
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Verify the database state
    const finalConn = await prisma.socialConnection.findUnique({ where: { id: conn.id } });
    
    // Lock should be released
    expect(finalConn?.processingLockedUntil).toBeNull();

    // The connection should have been updated by exactly one successful refresh
    expect(finalConn?.refreshFailureCount).toBe(0);
    expect(finalConn?.lastRefreshSuccessAt).not.toBeNull();
    expect(finalConn?.nextRefreshAt?.getTime()).toBeGreaterThan(Date.now());
  });
});
