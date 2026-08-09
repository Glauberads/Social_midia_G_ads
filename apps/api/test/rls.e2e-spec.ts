import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaClient, Prisma } from '@projeto/database';
import { randomBytes } from 'crypto';
import { TenantResolverGuard } from '../src/modules/auth/guards/tenant-resolver.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SocialConnectionHealthProcessor } from '../../worker/src/instagram-connections/social-connection-health.processor';

describe('RLS Physical Tests (Direct Database Tests)', () => {
  let adminPrisma: PrismaService;
  let runtimePrisma: PrismaClient;
  let e2ePassword = '';
  let e2eRole = 'social_elite_runtime';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [PrismaService],
    }).compile();

    adminPrisma = module.get<PrismaService>(PrismaService);
    await adminPrisma.$connect();

    // 1. Generate CSPRNG password
    e2ePassword = randomBytes(32).toString('hex');

    // Create a non-superuser role
    await adminPrisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = '${e2eRole}') THEN
          ALTER ROLE ${e2eRole} WITH PASSWORD '${e2ePassword}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
        ELSE
          CREATE ROLE ${e2eRole} LOGIN PASSWORD '${e2ePassword}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
        END IF;
      END
      $$;
    `);

    // 2. Minimum Privileges
    await adminPrisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${e2eRole}`);
    
    const tables = [
      'UserProfile', 'Tenant', 'Membership', 'Invitation', 'AuditLog', 
      'ContentRequest', 'ContentGeneration', 'GeneratedContent', 
      'ContentRevision', 'ContentSchedule', 'oauth_states', 
      'oauth_sessions', 'social_connections'
    ];

    for (const table of tables) {
      await adminPrisma.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."${table}" TO ${e2eRole}`);
    }

    // Grant execute ONLY on specific functions
    await adminPrisma.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION public.resolve_tenant_membership(UUID, UUID) TO ${e2eRole}`);
    await adminPrisma.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION public.get_due_content_schedules_candidates(INT) TO ${e2eRole}`);
    await adminPrisma.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION public.get_social_connection_health_candidates(INT) TO ${e2eRole}`);
    await adminPrisma.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION public.consume_oauth_state(TEXT, TEXT) TO ${e2eRole}`);

    // Revoke from public just in case
    await adminPrisma.$executeRawUnsafe(`REVOKE EXECUTE ON FUNCTION public.resolve_tenant_membership(UUID, UUID) FROM PUBLIC`);
    await adminPrisma.$executeRawUnsafe(`REVOKE EXECUTE ON FUNCTION public.get_due_content_schedules_candidates(INT) FROM PUBLIC`);
    await adminPrisma.$executeRawUnsafe(`REVOKE EXECUTE ON FUNCTION public.get_social_connection_health_candidates(INT) FROM PUBLIC`);
    await adminPrisma.$executeRawUnsafe(`REVOKE EXECUTE ON FUNCTION public.consume_oauth_state(TEXT, TEXT) FROM PUBLIC`);

    // Connect runtimePrisma physically as social_elite_runtime
    const url = new URL(process.env.DATABASE_URL!);
    url.username = e2eRole;
    url.password = e2ePassword;
    
    runtimePrisma = new PrismaClient({
      datasources: {
        db: {
          url: url.toString(),
        },
      },
    });
    await runtimePrisma.$connect();

    // Clear data
    const cleanupTables = [...tables].reverse();
    for (const table of cleanupTables) {
      if (table === 'AuditLog') {
        await adminPrisma.$executeRawUnsafe(`ALTER TABLE public."AuditLog" DISABLE TRIGGER ALL`);
        await adminPrisma.$executeRawUnsafe(`TRUNCATE public."AuditLog" CASCADE`);
        await adminPrisma.$executeRawUnsafe(`ALTER TABLE public."AuditLog" ENABLE TRIGGER ALL`);
      } else {
        await adminPrisma.$executeRawUnsafe(`DELETE FROM public."${table}"`);
      }
    }
    await adminPrisma.$executeRaw`DELETE FROM auth.users WHERE email LIKE 'test%@test.com'`;
  });

  afterAll(async () => {
    // Delete test data
    const tables = [
      'UserProfile', 'Tenant', 'Membership', 'Invitation', 'AuditLog', 
      'ContentRequest', 'ContentGeneration', 'GeneratedContent', 
      'ContentRevision', 'ContentSchedule', 'oauth_states', 
      'oauth_sessions', 'social_connections'
    ].reverse();

    for (const table of tables) {
      if (table === 'AuditLog') {
        await adminPrisma.$executeRawUnsafe(`ALTER TABLE public."AuditLog" DISABLE TRIGGER ALL`);
        await adminPrisma.$executeRawUnsafe(`TRUNCATE public."AuditLog" CASCADE`);
        await adminPrisma.$executeRawUnsafe(`ALTER TABLE public."AuditLog" ENABLE TRIGGER ALL`);
      } else {
        await adminPrisma.$executeRawUnsafe(`DELETE FROM public."${table}"`);
      }
    }
    
    await adminPrisma.$executeRaw`DELETE FROM auth.users WHERE email LIKE 'test%@test.com'`;
    
    await runtimePrisma.$disconnect();
    await adminPrisma.$disconnect();
  });

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

  describe('RUNTIME CONNECTION & ROLE ATTRIBUTES', () => {
    it('Gate 26: role continua NOBYPASSRLS durante a suite', async () => {
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

  describe('CROSS TENANT & CONTEXT LEAKAGE', () => {
    it('Gate 1: tenant A lê tenant A', async () => {
      await asUser(userIdA, tenantAId, async (tx) => {
        const mems = await tx.$queryRaw<any[]>`SELECT * FROM public."Membership"`;
        expect(mems.every(m => m.tenantId === tenantAId)).toBe(true);
      });
    });

    it('Gate 2: tenant A não lê tenant B', async () => {
      await asUser(userIdA, tenantAId, async (tx) => {
        const mems = await tx.$queryRaw<any[]>`SELECT * FROM public."Membership" WHERE "tenantId" = ${tenantBId}::uuid`;
        expect(mems.length).toBe(0);
      });
    });

    it('Gate 3: tenant A não altera tenant B', async () => {
      await asUser(userIdA, tenantAId, async (tx) => {
        const result = await tx.$executeRaw`UPDATE public."Membership" SET role = 'ADMIN' WHERE "tenantId" = ${tenantBId}::uuid`;
        expect(result).toBe(0);
      });
    });

    it('Gate 4: tenant B não lê tenant A', async () => {
      await asUser(userIdB, tenantBId, async (tx) => {
        const mems = await tx.$queryRaw<any[]>`SELECT * FROM public."Membership" WHERE "tenantId" = ${tenantAId}::uuid`;
        expect(mems.length).toBe(0);
      });
    });

    it('Gate 5: sem tenant context não vaza dados', async () => {
      await asUser(userIdA, '', async (tx) => {
        const mems = await tx.$queryRaw<any[]>`SELECT * FROM public."Membership"`;
        expect(mems.length).toBe(0);
      });
    });

    it('Gate 6: sem user context não amplia acesso', async () => {
      await asUser('', tenantAId, async (tx) => {
        const mems = await tx.$queryRaw<any[]>`SELECT * FROM public."Membership"`;
        expect(mems.length).toBe(0);
      });
    });

    it('Gate 7: contexto incorreto não vaza dados', async () => {
      await asUser(userIdA, tenantBId, async (tx) => {
        const mems = await tx.$queryRaw<any[]>`SELECT * FROM public."Membership"`;
        expect(mems.length).toBe(0);
      });
    });

    it('Gate 8: contexto não vaza após COMMIT', async () => {
      await asUser(userIdA, tenantAId, async (tx) => {
        await tx.$executeRaw`SELECT 1`;
      });
      await runtimePrisma.$transaction(async (tx) => {
        const result = await tx.$queryRaw<{current_setting: string}[]>`SELECT current_setting('app.tenant_id', true)`;
        expect(result[0].current_setting).toBe('');
      });
    });

    it('Gate 9: contexto não vaza após ROLLBACK', async () => {
      try {
        await asUser(userIdA, tenantAId, async (tx) => {
          throw new Error('ROLLBACK');
        });
      } catch {}
      await runtimePrisma.$transaction(async (tx) => {
        const result = await tx.$queryRaw<{current_setting: string}[]>`SELECT current_setting('app.tenant_id', true)`;
        expect(result[0].current_setting).toBe('');
      });
    });

    it('Gate 10: concorrência A/B não cruza contexto', async () => {
      const p1 = asUser(userIdA, tenantAId, async (tx) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return (await tx.$queryRaw<any[]>`SELECT * FROM public."Membership"`).length;
      });
      const p2 = asUser(userIdB, tenantBId, async (tx) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return (await tx.$queryRaw<any[]>`SELECT * FROM public."Membership"`).length;
      });

      const [resA, resB] = await Promise.all([p1, p2]);
      expect(resA).toBeGreaterThan(0);
      expect(resB).toBeGreaterThan(0);
    });
  });

  describe('TENANT RESOLVER GUARD', () => {
    it('Gate 11: TenantResolverGuard funciona (user A + tenant A => autorizado, user A + tenant B => negado)', async () => {
      const guard = new TenantResolverGuard(runtimePrisma as any);

      // Mock ExecutionContext
      const mockContext = (userId: string, tenantId: string) => ({
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: userId },
            headers: { 'x-tenant-id': tenantId }
          })
        })
      }) as unknown as ExecutionContext;

      // Gate 11.1 User A + Tenant A
      const reqA = mockContext(userIdA, tenantAId).switchToHttp().getRequest();
      await expect(guard.canActivate(mockContext(userIdA, tenantAId))).resolves.toBe(true);
      expect(reqA.tenant.tenantId).toBe(tenantAId);

      // Gate 11.2 User A + Tenant B => negado
      await expect(guard.canActivate(mockContext(userIdA, tenantBId))).rejects.toThrow(ForbiddenException);

      // Gate 12: usuário sem membership => negado
      const fakeUser = 'c0000000-0000-0000-0000-000000000999';
      await expect(guard.canActivate(mockContext(fakeUser, tenantAId))).rejects.toThrow(ForbiddenException);

      // Gate 11.3 tenant inválido => negado
      const fakeTenant = 'a0000000-0000-0000-0000-000000000999';
      await expect(guard.canActivate(mockContext(userIdA, fakeTenant))).rejects.toThrow(ForbiddenException);
    });

    it('Gate 13: resolve_tenant_membership não enumera tenants', async () => {
      const res = await runtimePrisma.$queryRaw<any[]>`SELECT * FROM public.resolve_tenant_membership(${userIdA}::uuid, ${tenantBId}::uuid)`;
      expect(res[0].resolve_tenant_membership).toBeNull(); // Do not leak existence
    });
  });

  describe('OAUTH STATES & SESSIONS', () => {
    const hash = 'test_hash_123';
    
    beforeAll(async () => {
      await adminPrisma.$executeRaw`INSERT INTO public.oauth_states ("stateHash", "tenantId", "userId", "provider", "expiresAt", "createdAt") VALUES (${hash}, ${tenantAId}::uuid, ${userIdA}::uuid, 'META_INSTAGRAM', NOW() + interval '1 hour', NOW())`;
      await adminPrisma.$executeRaw`INSERT INTO public.oauth_sessions ("id", "tenantId", "userId", "provider", "accessTokenEncrypted", "expiresAt", "createdAt") VALUES ('f1000000-0000-0000-0000-000000000001'::uuid, ${tenantAId}::uuid, ${userIdA}::uuid, 'META_INSTAGRAM', 'enc', NOW(), NOW())`;
    });

    it('Gate 14: consume_oauth_state válido funciona', async () => {
      const res = await runtimePrisma.$queryRaw<any[]>`SELECT * FROM public.consume_oauth_state(${hash}, 'META_INSTAGRAM')`;
      expect(res.length).toBe(1);
      expect(res[0].tenantId).toBe(tenantAId);
    });

    it('Gate 15: consume_oauth_state replay falha', async () => {
      const res = await runtimePrisma.$queryRaw<any[]>`SELECT * FROM public.consume_oauth_state(${hash}, 'META_INSTAGRAM')`;
      expect(res.length).toBe(0);
    });

    it('Gate 16: state expirado falha', async () => {
      await adminPrisma.$executeRaw`INSERT INTO public.oauth_states ("stateHash", "tenantId", "userId", "provider", "expiresAt", "createdAt") VALUES ('expired_hash', ${tenantAId}::uuid, ${userIdA}::uuid, 'META_INSTAGRAM', NOW() - interval '1 hour', NOW())`;
      const res = await runtimePrisma.$queryRaw<any[]>`SELECT * FROM public.consume_oauth_state('expired_hash', 'META_INSTAGRAM')`;
      expect(res.length).toBe(0);
    });

    it('Gate 17: OAuth tenant A não expõe tenant B', async () => {
      await asUser(userIdB, tenantBId, async (tx) => {
        expect((await tx.$queryRaw<any[]>`SELECT * FROM public.oauth_states WHERE "tenantId" = ${tenantAId}::uuid`).length).toBe(0);
      });
    });

    it('Gate 18: oauth_sessions respeitam RLS', async () => {
      await asUser(userIdA, tenantAId, async (tx) => {
        expect((await tx.$queryRaw<any[]>`SELECT * FROM public.oauth_sessions`).length).toBe(1);
      });
      await asUser(userIdB, tenantBId, async (tx) => {
        expect((await tx.$queryRaw<any[]>`SELECT * FROM public.oauth_sessions`).length).toBe(0);
      });
    });
  });

  describe('WORKER PROCESSOR RLS', () => {
    const connA = 'e1000000-0000-0000-0000-000000000001';
    
    beforeAll(async () => {
      // Create with accessTokenEncrypted to pass early return
      await adminPrisma.$executeRaw`INSERT INTO public.social_connections ("id", "tenantId", "provider", "status", "connectedById", "createdAt", "updatedAt", "nextRefreshAt", "accessTokenEncrypted") VALUES (${connA}::uuid, ${tenantAId}::uuid, 'META_INSTAGRAM', 'CONNECTED', ${userIdA}::uuid, NOW(), NOW(), NOW() - interval '1 day', 'enc')`;
    });

    it('Gate 19: social_connections respeitam RLS', async () => {
      await asUser(userIdB, tenantBId, async (tx) => {
        expect((await tx.$queryRaw<any[]>`SELECT * FROM public.social_connections`).length).toBe(0);
      });
    });

    it('Gate 20: worker discovery funciona via RPC sem SET ROLE', async () => {
      const res = await runtimePrisma.$queryRaw<any[]>`SELECT * FROM public.get_social_connection_health_candidates(10)`;
      expect(res.length).toBe(1);
      expect(res[0].id).toBe(connA);
    });

    it('Gate 21 & 22 & 23: worker processa tenant correto com lock e unlock dentro do contexto RLS', async () => {
      const processor = new SocialConnectionHealthProcessor(runtimePrisma as any);
      // Mocking fetch or internal refresh to avoid real network
      (processor as any).handleValidate = jest.fn().mockResolvedValue(true);
      (processor as any).decryptToken = jest.fn().mockReturnValue('fake-token');

      const count = await processor.processBatch(10);
      expect(count).toBe(1);

      // Verify it was unlocked
      const res = await adminPrisma.$queryRaw<any[]>`SELECT "processingLockedUntil" FROM public.social_connections WHERE id = ${connA}::uuid`;
      expect(res[0].processingLockedUntil).toBeNull();
    });

    it('Gate 24: concorrência worker não duplica processamento', async () => {
      const processor = new SocialConnectionHealthProcessor(runtimePrisma as any);
      (processor as any).decryptToken = jest.fn().mockReturnValue('fake-token');
      
      let validateCalls = 0;
      (processor as any).handleValidate = async () => {
        validateCalls++;
        await new Promise(r => setTimeout(r, 100)); // Hold lock artificially
      };
      
      const p1 = processor.processBatch(10);
      const p2 = processor.processBatch(10);
      
      const [r1, r2] = await Promise.all([p1, p2]);
      
      expect(validateCalls).toBe(1);
      
      // One of them acquires lock and processes exactly 1 candidate, the other gets 0 because lock prevents it.
      // Wait, both might discover it simultaneously, but only one acquires lock. 
      // The one acquiring lock processes 1, the other skips.
      const totalProcessed = r1 + r2;
      expect(totalProcessed).toBe(1);
    });

    it('Gate 25: retry/falha não vaza contexto', async () => {
      const processor = new SocialConnectionHealthProcessor(runtimePrisma as any);
      (processor as any).decryptToken = jest.fn().mockReturnValue('fake-token');
      
      // Forçar falha REAL após passar pelo lock, decryptToken, etc
      (processor as any).handleValidate = jest.fn().mockRejectedValue(new Error('FAKE_ERROR'));
      
      const count = await processor.processBatch(10);
      expect(count).toBe(1); // Foi capturado pelo discovery e logou a falha internamente
      expect((processor as any).handleValidate).toHaveBeenCalledTimes(1);

      // Ensure no context leaked by running immediately a manual check without context
      await runtimePrisma.$transaction(async (tx) => {
        const res = await tx.$queryRaw<{current_setting: string}[]>`SELECT current_setting('app.tenant_id', true)`;
        expect(res[0].current_setting).toBe('');
        
        const resUser = await tx.$queryRaw<{current_setting: string}[]>`SELECT current_setting('app.user_id', true)`;
        expect(resUser[0].current_setting).toBe('');
      });
      
      // Nova tentativa (Retry) para outro tenant ou o mesmo: garante ambiente limpo
      const pRetry = asUser(userIdB, tenantBId, async (tx) => {
         const result = await tx.$queryRaw<{current_setting: string}[]>`SELECT current_setting('app.tenant_id', true)`;
         return result[0].current_setting;
      });
      expect(await pRetry).toBe(tenantBId);
    });
  });
});
