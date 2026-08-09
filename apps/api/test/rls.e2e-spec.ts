import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaClient, Prisma } from '@projeto/database';

describe('RLS Physical Tests (Direct Database Tests)', () => {
  let adminPrisma: PrismaService;
  let runtimePrisma: PrismaClient;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [PrismaService],
    }).compile();

    adminPrisma = module.get<PrismaService>(PrismaService);
    await adminPrisma.$connect();

    // Create a non-superuser role for testing if it doesn't exist
    await adminPrisma.$executeRaw`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'social_elite_runtime') THEN
          CREATE ROLE social_elite_runtime LOGIN PASSWORD 'test' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
        END IF;
      END
      $$;
    `;
    await adminPrisma.$executeRaw`ALTER ROLE social_elite_runtime NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION`;
    await adminPrisma.$executeRaw`GRANT USAGE ON SCHEMA public TO social_elite_runtime`;
    await adminPrisma.$executeRaw`GRANT ALL ON ALL TABLES IN SCHEMA public TO social_elite_runtime`;
    await adminPrisma.$executeRaw`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO social_elite_runtime`;
    await adminPrisma.$executeRaw`GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO social_elite_runtime`;

    // Connect runtimePrisma physically as social_elite_runtime
    const url = new URL(process.env.DATABASE_URL!);
    url.username = 'social_elite_runtime';
    url.password = 'test';
    
    runtimePrisma = new PrismaClient({
      datasources: {
        db: {
          url: url.toString(),
        },
      },
    });
    await runtimePrisma.$connect();

    // Clear data
    await adminPrisma.$executeRaw`DELETE FROM public."ContentRevision"`;
    await adminPrisma.$executeRaw`DELETE FROM public."GeneratedContent"`;
    await adminPrisma.$executeRaw`DELETE FROM public."ContentGeneration"`;
    await adminPrisma.$executeRaw`DELETE FROM public."ContentRequest"`;
    await adminPrisma.$executeRaw`DELETE FROM public."oauth_sessions"`;
    await adminPrisma.$executeRaw`DELETE FROM public."oauth_states"`;
    await adminPrisma.$executeRaw`DELETE FROM public."social_connections"`;
    await adminPrisma.$executeRaw`DELETE FROM public."Membership"`;
    await adminPrisma.$executeRaw`DELETE FROM public."Tenant"`;
    await adminPrisma.$executeRaw`DELETE FROM public."UserProfile"`;
    await adminPrisma.$executeRaw`DELETE FROM auth.users WHERE email LIKE 'test%@test.com'`;
  });

  afterAll(async () => {
    // Delete test data
    await adminPrisma.$executeRaw`ALTER TABLE public."AuditLog" DISABLE TRIGGER ALL`;
    await adminPrisma.$executeRaw`TRUNCATE public."AuditLog" CASCADE`;
    await adminPrisma.$executeRaw`ALTER TABLE public."AuditLog" ENABLE TRIGGER ALL`;

    await adminPrisma.$executeRaw`DELETE FROM public."Invitation"`;
    await adminPrisma.$executeRaw`DELETE FROM public."ContentRevision"`;
    await adminPrisma.$executeRaw`DELETE FROM public."GeneratedContent"`;
    await adminPrisma.$executeRaw`DELETE FROM public."ContentGeneration"`;
    await adminPrisma.$executeRaw`DELETE FROM public."oauth_sessions"`;
    await adminPrisma.$executeRaw`DELETE FROM public."oauth_states"`;
    await adminPrisma.$executeRaw`DELETE FROM public."social_connections"`;
    await adminPrisma.$executeRaw`DELETE FROM public."Membership"`;
    await adminPrisma.$executeRaw`DELETE FROM public."ContentRequest"`;
    await adminPrisma.$executeRaw`DELETE FROM public."Tenant"`;
    await adminPrisma.$executeRaw`DELETE FROM auth.users WHERE email LIKE 'test%@test.com'`;
    await adminPrisma.$executeRaw`DELETE FROM public."UserProfile"`;
    
    await runtimePrisma.$disconnect();
    await adminPrisma.$disconnect();
  });

  // Helpers to run queries as runtime user with context
  async function asUser<T>(userId: string, tenantId: string | null, callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return runtimePrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET search_path = public`;
      if (userId) {
        await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      } else {
        await tx.$executeRaw`SELECT set_config('app.user_id', '', true)`;
      }
      if (tenantId) {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      } else {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', '', true)`;
      }
      return callback(tx);
    });
  }

  const userIdA = 'c0000000-0000-0000-0000-000000000001';
  const userIdB = 'c0000000-0000-0000-0000-000000000002';
  const tenantAId = 'a0000000-0000-0000-0000-000000000001';
  const tenantBId = 'b0000000-0000-0000-0000-000000000002';

  beforeAll(async () => {
    // Seed basic data as SUPERUSER (bypassing RLS)
    await adminPrisma.$executeRaw`INSERT INTO auth.users (id, instance_id, email, aud, role, encrypted_password, created_at, updated_at) VALUES (${userIdA}::uuid, '00000000-0000-0000-0000-000000000000', 'testA@test.com', 'authenticated', 'authenticated', 'pass', NOW(), NOW()) ON CONFLICT DO NOTHING`;
    await adminPrisma.$executeRaw`INSERT INTO auth.users (id, instance_id, email, aud, role, encrypted_password, created_at, updated_at) VALUES (${userIdB}::uuid, '00000000-0000-0000-0000-000000000000', 'testB@test.com', 'authenticated', 'authenticated', 'pass', NOW(), NOW()) ON CONFLICT DO NOTHING`;
    await adminPrisma.$executeRaw`INSERT INTO public."UserProfile" (id, email, "createdAt", "updatedAt") VALUES (${userIdA}::uuid, 'testA@test.com', NOW(), NOW()) ON CONFLICT (id) DO NOTHING`;
    await adminPrisma.$executeRaw`INSERT INTO public."UserProfile" (id, email, "createdAt", "updatedAt") VALUES (${userIdB}::uuid, 'testB@test.com', NOW(), NOW()) ON CONFLICT (id) DO NOTHING`;

    await adminPrisma.$executeRaw`INSERT INTO public."Tenant" (id, name, slug, status, "createdAt", "updatedAt") VALUES (${tenantAId}::uuid, 'Tenant A', 'tenant-a', 'ACTIVE', NOW(), NOW()) ON CONFLICT DO NOTHING`;
    await adminPrisma.$executeRaw`INSERT INTO public."Tenant" (id, name, slug, status, "createdAt", "updatedAt") VALUES (${tenantBId}::uuid, 'Tenant B', 'tenant-b', 'ACTIVE', NOW(), NOW()) ON CONFLICT DO NOTHING`;

    await adminPrisma.$executeRaw`INSERT INTO public."Membership" (id, "userId", "tenantId", role, status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), ${userIdA}::uuid, ${tenantAId}::uuid, 'OWNER', 'ACTIVE', NOW(), NOW()) ON CONFLICT DO NOTHING`;
    await adminPrisma.$executeRaw`INSERT INTO public."Membership" (id, "userId", "tenantId", role, status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), ${userIdB}::uuid, ${tenantBId}::uuid, 'OWNER', 'ACTIVE', NOW(), NOW()) ON CONFLICT DO NOTHING`;
  });

  describe('RUNTIME CONNECTION', () => {
    it('is executing as social_elite_runtime NOBYPASSRLS', async () => {
      const userRes = await runtimePrisma.$queryRaw<{current_user: string}[]>`SELECT current_user`;
      expect(userRes[0].current_user).toBe('social_elite_runtime');
      
      const roleRes = await adminPrisma.$queryRaw<any[]>`SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication FROM pg_roles WHERE rolname = 'social_elite_runtime'`;
      expect(roleRes[0].rolsuper).toBe(false);
      expect(roleRes[0].rolbypassrls).toBe(false);
      expect(roleRes[0].rolcreatedb).toBe(false);
      expect(roleRes[0].rolcreaterole).toBe(false);
      expect(roleRes[0].rolreplication).toBe(false);
    });
  });

  describe('SECURITY DEFINER & OAUTH CALLBACK', () => {
    it('resolve_tenant_membership checks membership', async () => {
      const res = await runtimePrisma.$queryRaw<any[]>`SELECT * FROM public.resolve_tenant_membership(${userIdA}::uuid, ${tenantAId}::uuid)`;
      expect(res[0].resolve_tenant_membership.role).toBe('OWNER');

      const resBad = await runtimePrisma.$queryRaw<any[]>`SELECT * FROM public.resolve_tenant_membership(${userIdA}::uuid, ${tenantBId}::uuid)`;
      expect(resBad[0].resolve_tenant_membership).toBeNull();
    });

    it('consume_oauth_state is atomic and prevents replay', async () => {
      await adminPrisma.$executeRaw`INSERT INTO public.oauth_states ("stateHash", "tenantId", "userId", "provider", "expiresAt", "createdAt") VALUES ('unique_hash', ${tenantAId}::uuid, ${userIdA}::uuid, 'META_INSTAGRAM', NOW() + interval '1 hour', NOW())`;
      
      const res1 = await runtimePrisma.$queryRaw<any[]>`SELECT * FROM public.consume_oauth_state('unique_hash', 'META_INSTAGRAM')`;
      expect(res1.length).toBe(1);
      expect(res1[0].tenantId).toBe(tenantAId);

      // Replay
      const res2 = await runtimePrisma.$queryRaw<any[]>`SELECT * FROM public.consume_oauth_state('unique_hash', 'META_INSTAGRAM')`;
      expect(res2.length).toBe(0);
    });
  });

  describe('SEM CONTEXTO', () => {
    it('SELECT retorna zero ou é bloqueado', async () => {
      await asUser('', '', async (tx) => {
        const mems = await tx.$queryRaw<any[]>`SELECT * FROM public."Membership"`;
        expect(mems.length).toBe(0);
      });
    });
    it('INSERT é bloqueado', async () => {
      await asUser('', '', async (tx) => {
        await expect(tx.$executeRaw`INSERT INTO public."Membership" (id, "userId", "tenantId", role, status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), ${userIdA}::uuid, ${tenantAId}::uuid, 'MEMBER', 'ACTIVE', NOW(), NOW())`).rejects.toThrow();
      });
    });
    it('UPDATE é bloqueado', async () => {
      await asUser('', '', async (tx) => {
        const result = await tx.$executeRaw`UPDATE public."Membership" SET role = 'ADMIN'`;
        expect(result).toBe(0);
      });
    });
  });

  describe('TENANT A CONTRA TENANT B', () => {
    it('A lê somente A e B lê somente B', async () => {
      await asUser(userIdA, tenantAId, async (tx) => {
        const mems = await tx.$queryRaw<any[]>`SELECT * FROM public."Membership"`;
        expect(mems.every(m => m.tenantId === tenantAId)).toBe(true);
      });
      await asUser(userIdB, tenantBId, async (tx) => {
        const mems = await tx.$queryRaw<any[]>`SELECT * FROM public."Membership"`;
        expect(mems.every(m => m.tenantId === tenantBId)).toBe(true);
      });
    });
  });

  describe('POOL E ROLLBACK LEAKAGE', () => {
    it('contexto A não persiste após rollback', async () => {
      try {
        await runtimePrisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantAId}, true)`;
          throw new Error("ROLLBACK");
        });
      } catch (e) {}

      await runtimePrisma.$transaction(async (tx) => {
        const result = await tx.$queryRaw<{current_setting: string}[]>`SELECT current_setting('app.tenant_id', true)`;
        expect(result[0].current_setting).toBe('');
      });
    });

    it('contexto A não persiste após commit', async () => {
      await runtimePrisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantAId}, true)`;
      });

      await runtimePrisma.$transaction(async (tx) => {
        const result = await tx.$queryRaw<{current_setting: string}[]>`SELECT current_setting('app.tenant_id', true)`;
        expect(result[0].current_setting).toBe('');
      });
    });
  });
});
