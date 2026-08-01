import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
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

  const generateToken = (userId: string, email: string) => {
    return jwt.sign({
      sub: userId,
      email: email,
      role: 'authenticated',
      aud: 'authenticated',
    }, process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long');
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
    await prisma.userProfile.deleteMany({});

    ownerId = 'o0000000-0000-0000-0000-000000000000';
    memberId = 'm0000000-0000-0000-0000-000000000000';
    const noTenantId = 'n0000000-0000-0000-0000-000000000000';

    await prisma.userProfile.createMany({
      data: [
        { id: ownerId, email: 'owner@e2e.com' },
        { id: memberId, email: 'member@e2e.com' },
        { id: noTenantId, email: 'notenant@e2e.com' },
      ],
    });

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

    ownerToken = generateToken(ownerId, 'owner@e2e.com');
    memberToken = generateToken(memberId, 'member@e2e.com');
    noTenantToken = generateToken(noTenantId, 'notenant@e2e.com');
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
