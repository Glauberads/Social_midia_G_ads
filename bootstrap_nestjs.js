const fs = require('fs');
const path = require('path');

const apiPath = path.join('apps', 'api', 'src');

const dirs = [
  'infrastructure/database',
  'infrastructure/auth',
  'infrastructure/context',
  'infrastructure/logger',
  'infrastructure/filters',
  'modules/identity',
  'modules/tenants',
  'modules/memberships',
  'modules/audit-logs'
];

dirs.forEach(d => fs.mkdirSync(path.join(apiPath, d), { recursive: true }));

// main.ts
fs.writeFileSync(path.join(apiPath, 'main.ts'), `
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './infrastructure/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new GlobalExceptionFilter());
  // RequestId middleware can be added here
  await app.listen(3001);
}
bootstrap();
`.trim() + '\n');

// app.module.ts
fs.writeFileSync(path.join(apiPath, 'app.module.ts'), `
import { Module } from '@nestjs/core';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
`.trim() + '\n');

// PrismaModule & Service
fs.writeFileSync(path.join(apiPath, 'infrastructure/database/prisma.service.ts'), `
import { Injectable, OnModuleInit } from '@nestjs/core';
import { PrismaClient } from '@projeto/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
`.trim() + '\n');

fs.writeFileSync(path.join(apiPath, 'infrastructure/database/prisma.module.ts'), `
import { Global, Module } from '@nestjs/core';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
`.trim() + '\n');

// Filter
fs.writeFileSync(path.join(apiPath, 'infrastructure/filters/global-exception.filter.ts'), `
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/core';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
    });
  }
}
`.trim() + '\n');

// Package API deps
const apiPkgPath = path.join('apps', 'api', 'package.json');
const apiPkg = JSON.parse(fs.readFileSync(apiPkgPath, 'utf8'));
apiPkg.dependencies = {
  ...apiPkg.dependencies,
  "@nestjs/common": "^10.0.0",
  "@nestjs/core": "^10.0.0",
  "@nestjs/platform-express": "^10.0.0",
  "@nestjs/config": "^3.0.0",
  "@projeto/database": "workspace:*",
  "reflect-metadata": "^0.2.0",
  "rxjs": "^7.8.0"
};
fs.writeFileSync(apiPkgPath, JSON.stringify(apiPkg, null, 2));

// Update migration.sql with raw sql
const migrationPath = path.join('packages', 'database', 'migration.sql');
let migrationSql = fs.readFileSync(migrationPath, 'utf8');

const rawSql = \`
-- Adicionar Foreign Key para auth.users
ALTER TABLE "public"."UserProfile" ADD CONSTRAINT "UserProfile_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- Indice parcial unico para PENDING
CREATE UNIQUE INDEX "Invitation_email_tenantId_pending_key" ON "public"."Invitation"(lower("email"), "tenantId") WHERE "status" = 'PENDING';

-- Politica Append-Only
CREATE RULE "prevent_auditlog_delete" AS ON DELETE TO "public"."AuditLog" DO INSTEAD NOTHING;
CREATE RULE "prevent_auditlog_update" AS ON UPDATE TO "public"."AuditLog" DO INSTEAD NOTHING;
\`;

fs.writeFileSync(migrationPath, migrationSql + '\\n' + rawSql);

console.log("NestJS Bootstrap complete.");
