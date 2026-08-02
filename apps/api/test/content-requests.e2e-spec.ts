import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import * as jwt from 'jsonwebtoken';

describe('ContentRequests (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let memberToken: string;
  let noTenantToken: string;
  let tenantId: string;
  let ownerId: string;
  let memberId: string;
  let createdContentId: string;

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
    await prisma.contentRequest.deleteMany({});
    await prisma.membership.deleteMany({});
    await prisma.invitation.deleteMany({});
    await prisma.tenant.deleteMany({});

    const timestamp = Date.now();
    const ownerEmail = `owner_cr_${timestamp}@e2e.com`;
    const memberEmail = `member_cr_${timestamp}@e2e.com`;
    const noTenantEmail = `notenant_cr_${timestamp}@e2e.com`;

    const ownerRes = await generateToken(ownerEmail);
    ownerToken = ownerRes.token;
    ownerId = ownerRes.id;

    const memberRes = await generateToken(memberEmail);
    memberToken = memberRes.token;
    memberId = memberRes.id;

    const noTenantRes = await generateToken(noTenantEmail);
    noTenantToken = noTenantRes.token;

    // (UserProfile já é criado via trigger do Supabase no auth.users)

    const tenant = await prisma.tenant.create({
      data: { name: 'E2E Tenant CR', slug: 'e2e-tenant-cr' },
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
    await prisma.contentRequest.deleteMany({});
    await prisma.membership.deleteMany({});
    await prisma.invitation.deleteMany({});
    await prisma.tenant.deleteMany({});
    await prisma.userProfile.deleteMany({});
    await app.close();
  });

  describe('Global Guards & Fail-Closed', () => {
    it('privada sem JWT -> 401', () => {
      return request(app.getHttpServer())
        .post('/content-requests')
        .set('x-tenant-id', tenantId)
        .send({ title: 'Test', briefing: 'Long enough briefing string', platform: 'INSTAGRAM_FEED' })
        .expect(401);
    });

    it('tenant-scoped sem header -> 400', () => {
      return request(app.getHttpServer())
        .post('/content-requests')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Test', briefing: 'Long enough briefing string', platform: 'INSTAGRAM_FEED' })
        .expect(400);
    });

    it('tenant inexistente -> 404', () => {
      return request(app.getHttpServer())
        .post('/content-requests')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-id', '00000000-0000-0000-0000-000000000000')
        .send({ title: 'Test', briefing: 'Long enough briefing string', platform: 'INSTAGRAM_FEED' })
        .expect(404);
    });
  });

  describe('Create & List & Get Content Requests', () => {
    it('OWNER cria Content Request -> 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/content-requests')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-id', tenantId)
        .send({ title: 'Ad Campaign', briefing: 'Please create an ad for our product. Needs to be engaging.', platform: 'INSTAGRAM_REEL' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Ad Campaign');
      expect(res.body.status).toBe('DRAFT');
      createdContentId = res.body.id;
    });

    it('MEMBER também cria Content Request -> 201', async () => {
      await request(app.getHttpServer())
        .post('/content-requests')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-tenant-id', tenantId)
        .send({ title: 'Member Post', briefing: 'Another great post briefing here.', platform: 'INSTAGRAM_FEED' })
        .expect(201);
    });

    it('List retorna requests do tenant -> 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/content-requests')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it('Get retorna detalhe -> 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/content-requests/${createdContentId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(res.body.id).toBe(createdContentId);
    });
  });

  describe('Update & Archive Content Requests', () => {
    it('Update altera request DRAFT -> 200', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/content-requests/${createdContentId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-id', tenantId)
        .send({ title: 'Updated Ad Campaign' })
        .expect(200);

      expect(res.body.title).toBe('Updated Ad Campaign');
    });

    it('Archive marca como ARCHIVED -> 201 (since Post route)', async () => {
      await request(app.getHttpServer())
        .post(`/content-requests/${createdContentId}/archive`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-id', tenantId)
        .expect(201);
    });

    it('Update de request ARCHIVED deve falhar (Forbidden) -> 403', async () => {
      await request(app.getHttpServer())
        .patch(`/content-requests/${createdContentId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-id', tenantId)
        .send({ title: 'Try to update archived' })
        .expect(403);
    });
  });
});
