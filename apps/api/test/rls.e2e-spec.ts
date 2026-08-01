import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { Prisma } from '@projeto/database';

describe('RLS Physical Tests (Direct Database Tests)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [PrismaService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    await prisma.$connect();

    // Create a non-superuser role for testing if it doesn't exist
    await prisma.$executeRaw`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'api_user') THEN
          CREATE ROLE api_user NOLOGIN;
        END IF;
      END
      $$;
    `;
    await prisma.$executeRaw`GRANT USAGE ON SCHEMA public TO api_user`;
    await prisma.$executeRaw`GRANT ALL ON ALL TABLES IN SCHEMA public TO api_user`;
    await prisma.$executeRaw`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO api_user`;
    await prisma.$executeRaw`GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO api_user`;

    // Ensure postgres can set role
    await prisma.$executeRaw`GRANT api_user TO postgres`;
  });

  afterAll(async () => {
    // Delete test data
    await prisma.$executeRaw`ALTER TABLE public."AuditLog" DISABLE TRIGGER ALL`;
    await prisma.$executeRaw`TRUNCATE public."AuditLog" CASCADE`;
    await prisma.$executeRaw`ALTER TABLE public."AuditLog" ENABLE TRIGGER ALL`;
    
    await prisma.$executeRaw`DELETE FROM public."Invitation"`;
    await prisma.$executeRaw`DELETE FROM public."Membership"`;
    await prisma.$executeRaw`DELETE FROM public."Tenant"`;
    await prisma.$executeRaw`DELETE FROM auth.users WHERE email LIKE 'test%@test.com'`;
    await prisma.$disconnect();
  });

  // Helpers to run queries as api_user with context
  async function asUser<T>(userId: string, tenantId: string | null, callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE api_user`;
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
    await prisma.$executeRaw`INSERT INTO auth.users (id, instance_id, email, aud, role, encrypted_password, created_at, updated_at) VALUES (${userIdA}::uuid, '00000000-0000-0000-0000-000000000000', 'testA@test.com', 'authenticated', 'authenticated', 'pass', NOW(), NOW()) ON CONFLICT DO NOTHING`;
    await prisma.$executeRaw`INSERT INTO auth.users (id, instance_id, email, aud, role, encrypted_password, created_at, updated_at) VALUES (${userIdB}::uuid, '00000000-0000-0000-0000-000000000000', 'testB@test.com', 'authenticated', 'authenticated', 'pass', NOW(), NOW()) ON CONFLICT DO NOTHING`;

    await prisma.$executeRaw`INSERT INTO public."Tenant" (id, name, slug, status, "createdAt", "updatedAt") VALUES (${tenantAId}::uuid, 'Tenant A', 'tenant-a', 'ACTIVE', NOW(), NOW()) ON CONFLICT DO NOTHING`;
    await prisma.$executeRaw`INSERT INTO public."Tenant" (id, name, slug, status, "createdAt", "updatedAt") VALUES (${tenantBId}::uuid, 'Tenant B', 'tenant-b', 'ACTIVE', NOW(), NOW()) ON CONFLICT DO NOTHING`;

    await prisma.$executeRaw`INSERT INTO public."Membership" (id, "userId", "tenantId", role, status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), ${userIdA}::uuid, ${tenantAId}::uuid, 'OWNER', 'ACTIVE', NOW(), NOW()) ON CONFLICT DO NOTHING`;
    await prisma.$executeRaw`INSERT INTO public."Membership" (id, "userId", "tenantId", role, status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), ${userIdB}::uuid, ${tenantBId}::uuid, 'OWNER', 'ACTIVE', NOW(), NOW()) ON CONFLICT DO NOTHING`;
  });

  describe('SEM CONTEXTO', () => {
    it('SELECT retorna zero ou é bloqueado', async () => {
      await asUser('', '', async (tx) => {
        const mems = await tx.$queryRaw`SELECT * FROM public."Membership"`;
        expect((mems as any[]).length).toBe(0);
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
    it('DELETE é bloqueado', async () => {
      await asUser('', '', async (tx) => {
        const result = await tx.$executeRaw`DELETE FROM public."Membership"`;
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
    it('INSERT com tenantId B falha (sob contexto A)', async () => {
      await asUser(userIdA, tenantAId, async (tx) => {
        await expect(tx.$executeRaw`INSERT INTO public."Membership" (id, "userId", "tenantId", role, status, "createdAt", "updatedAt") VALUES (gen_random_uuid(), ${userIdA}::uuid, ${tenantBId}::uuid, 'MEMBER', 'ACTIVE', NOW(), NOW())`).rejects.toThrow();
      });
    });
    it('UPDATE de registro B falha ou afeta zero linhas', async () => {
      await asUser(userIdA, tenantAId, async (tx) => {
        const result = await tx.$executeRaw`UPDATE public."Membership" SET role = 'ADMIN' WHERE "tenantId" = ${tenantBId}::uuid`;
        expect(result).toBe(0); // Afeta zero linhas porque o SELECT da policy de update nao enxerga B
      });
    });
    it('DELETE de registro B falha ou afeta zero linhas', async () => {
      await asUser(userIdA, tenantAId, async (tx) => {
        const result = await tx.$executeRaw`DELETE FROM public."Membership" WHERE "tenantId" = ${tenantBId}::uuid`;
        expect(result).toBe(0);
      });
    });
    it('UPDATE movendo registro A para tenantId B falha', async () => {
      await asUser(userIdA, tenantAId, async (tx) => {
        await expect(tx.$executeRaw`UPDATE public."Membership" SET "tenantId" = ${tenantBId}::uuid WHERE "tenantId" = ${tenantAId}::uuid`).rejects.toThrow();
      });
    });
  });

  describe('USERPROFILE', () => {
    it('user A lê o próprio perfil e não lê B', async () => {
      await asUser(userIdA, '', async (tx) => {
        const profiles = await tx.$queryRaw<any[]>`SELECT * FROM public."UserProfile"`;
        expect(profiles.length).toBe(1);
        expect(profiles[0].id).toBe(userIdA);
      });
    });
    it('user A não altera user B', async () => {
      await asUser(userIdA, '', async (tx) => {
        const result = await tx.$executeRaw`UPDATE public."UserProfile" SET email = 'hacked@test.com' WHERE id = ${userIdB}::uuid`;
        expect(result).toBe(0);
      });
    });
    it('sem app.user_id, SELECT e UPDATE são bloqueados', async () => {
      await asUser('', '', async (tx) => {
        const profiles = await tx.$queryRaw<any[]>`SELECT * FROM public."UserProfile"`;
        expect(profiles.length).toBe(0);
        const result = await tx.$executeRaw`UPDATE public."UserProfile" SET email = 'hacked@test.com'`;
        expect(result).toBe(0);
      });
    });
  });

  describe('TENANT', () => {
    it('usuário acessa apenas tenant permitido pela policy', async () => {
      await asUser(userIdA, '', async (tx) => {
        const tenants = await tx.$queryRaw<any[]>`SELECT * FROM public."Tenant"`;
        expect(tenants.every(t => t.id === tenantAId)).toBe(true);
      });
    });
    it('UPDATE e DELETE diretos continuam negados', async () => {
      await asUser(userIdA, '', async (tx) => {
        const r1 = await tx.$executeRaw`UPDATE public."Tenant" SET name = 'Hacked' WHERE id = ${tenantAId}::uuid`;
        expect(r1).toBe(0);
        const r2 = await tx.$executeRaw`DELETE FROM public."Tenant" WHERE id = ${tenantAId}::uuid`;
        expect(r2).toBe(0);
      });
    });
  });

  describe('AUDITLOG', () => {
    it('insert tenant-scoped funciona no tenant ativo', async () => {
      await asUser(userIdA, tenantAId, async (tx) => {
        const result = await tx.$executeRaw`INSERT INTO public."AuditLog" (id, "tenantId", action, entity, "entityId") VALUES (gen_random_uuid(), ${tenantAId}::uuid, 'CREATE', 'Test', '1')`;
        expect(result).toBe(1);
      });
    });
    it('insert com tenantId diferente falha', async () => {
      await asUser(userIdA, tenantAId, async (tx) => {
        await expect(tx.$executeRaw`INSERT INTO public."AuditLog" (id, "tenantId", action, entity, "entityId") VALUES (gen_random_uuid(), ${tenantBId}::uuid, 'CREATE', 'Test', '1')`).rejects.toThrow();
      });
    });
    it('insert global direto pelo runtime falha', async () => {
      await asUser(userIdA, '', async (tx) => {
        await expect(tx.$executeRaw`INSERT INTO public."AuditLog" (id, action, entity, "entityId") VALUES (gen_random_uuid(), 'CREATE', 'Test', '1')`).rejects.toThrow();
      });
    });
    it('update falha', async () => {
      await asUser(userIdA, tenantAId, async (tx) => {
        const result = await tx.$executeRaw`UPDATE public."AuditLog" SET action = 'UPDATE'`;
        expect(result).toBe(0);
      });
    });
    it('delete falha', async () => {
      await asUser(userIdA, tenantAId, async (tx) => {
        const result = await tx.$executeRaw`DELETE FROM public."AuditLog"`;
        expect(result).toBe(0);
      });
    });
    it('função específica de log global funciona', async () => {
      await asUser(userIdA, '', async (tx) => {
        const result = await tx.$executeRaw`SELECT log_global_audit(gen_random_uuid(), 'CREATE', 'SystemTest', '123', ${userIdA}::uuid, '{}'::jsonb)`;
        expect(result).toBeDefined();
      });
    });
  });

  describe('POOL E ROLLBACK', () => {
    it('contexto A não persiste após rollback e não vaza', async () => {
      // 1. Transaction that sets context A then rolls back
      try {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SET LOCAL ROLE api_user`;
          await tx.$executeRaw`SET search_path = public`;
          await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantAId}, true)`;
          throw new Error("ROLLBACK");
        });
      } catch (e) {}

      // 2. Transaction following it should NOT have context A
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL ROLE api_user`;
        await tx.$executeRaw`SET search_path = public`;
        const result = await tx.$queryRaw<{current_setting: string}[]>`SELECT current_setting('app.tenant_id', true)`;
        expect(result[0].current_setting).toBe('');
      });
    });
    
    it('contexto A não persiste após commit', async () => {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL ROLE api_user`;
        await tx.$executeRaw`SET search_path = public`;
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantAId}, true)`;
      });

      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL ROLE api_user`;
        await tx.$executeRaw`SET search_path = public`;
        const result = await tx.$queryRaw<{current_setting: string}[]>`SELECT current_setting('app.tenant_id', true)`;
        expect(result[0].current_setting).toBe('');
      });
    });
  });

  describe('QUERY SEM FILTRO', () => {
    it('dentro do executor do tenant A retorna somente A', async () => {
      await asUser(userIdA, tenantAId, async (tx) => {
        // Query omitting where tenantId
        const mems = await tx.$queryRaw<any[]>`SELECT * FROM public."Membership"`;
        expect(mems.length).toBeGreaterThan(0);
        expect(mems.every(m => m.tenantId === tenantAId)).toBe(true);
      });
    });
    it('fora do executor não retorna dados protegidos', async () => {
      await asUser('', '', async (tx) => {
        const mems = await tx.$queryRaw<any[]>`SELECT * FROM public."Membership"`;
        expect(mems.length).toBe(0);
      });
    });
  });
});
