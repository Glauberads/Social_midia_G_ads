import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import * as jwt from 'jsonwebtoken';

describe('Invitations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let memberToken: string;
  let noTenantToken: string;
  let tenantId: string;
  let ownerId: string;
  let memberId: string;

  const generateToken = async (email: string) => {
    let anonKey = '';
    const envPath = require('path').resolve(__dirname, '../../../apps/web/.env.example');
    const envContent = require('fs').readFileSync(envPath, 'utf-8');
    const match = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY="?(.*)"?/);
    if (match && match[1]) anonKey = match[1].replace(/"/g, '');

    const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';

    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'apikey': anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error('Signup failed: ' + JSON.stringify(data));
    }

    return { token: data.access_token, id: data.user.id };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Clean up
    await prisma.membership.deleteMany({});
    await prisma.invitation.deleteMany({});
    await prisma.tenant.deleteMany({});

    const timestamp = Date.now();
    const ownerEmail = `owner_inv_${timestamp}@e2e.com`;
    const memberEmail = `member_inv_${timestamp}@e2e.com`;
    const noTenantEmail = `notenant_inv_${timestamp}@e2e.com`;

    const ownerRes = await generateToken(ownerEmail);
    ownerToken = ownerRes.token;
    ownerId = ownerRes.id;

    const memberRes = await generateToken(memberEmail);
    memberToken = memberRes.token;
    memberId = memberRes.id;

    const noTenantRes = await generateToken(noTenantEmail);
    noTenantToken = noTenantRes.token;

    const tenant = await prisma.tenant.create({
      data: { name: 'E2E Tenant', slug: 'e2e-tenant' },
    });
    tenantId = tenant.id;

    await prisma.membership.createMany({
      data: [
        { userId: ownerId, tenantId: tenantId, role: 'OWNER' },
        { userId: memberId, tenantId: tenantId, role: 'MEMBER' },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Global Guards & Fail-Closed', () => {
    it('privada sem JWT -> 401', () => {
      return request(app.getHttpServer())
        .post('/invitations')
        .set('x-tenant-id', tenantId)
        .send({ email: 'test@e2e.com', role: 'MEMBER' })
        .expect(401);
    });

    it('tenant-scoped sem header -> 400', () => {
      return request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'test@e2e.com', role: 'MEMBER' })
        .expect(400); // TENANT_CONTEXT_REQUIRED or BadRequest
    });

    it('tenant inexistente -> 404', () => {
      return request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-id', '00000000-0000-0000-0000-000000000000')
        .send({ email: 'test@e2e.com', role: 'MEMBER' })
        .expect(404);
    });

    it('membership inexistente -> 403 (ou 404 para não revelar)', () => {
      return request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${noTenantToken}`)
        .set('x-tenant-id', tenantId)
        .send({ email: 'test@e2e.com', role: 'MEMBER' })
        .expect(403);
    });

    it('MEMBER e VIEWER bloqueados -> 403', () => {
      return request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-tenant-id', tenantId)
        .send({ email: 'test@e2e.com', role: 'MEMBER' })
        .expect(403);
    });

    it('OWNER cria convite -> permitido (201)', () => {
      return request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-id', tenantId)
        .send({ email: 'newmember@e2e.com', role: 'MEMBER' })
        .expect(201);
    });
  });
});
