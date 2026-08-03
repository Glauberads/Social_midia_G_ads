import { Module } from '@nestjs/common';
import { validateEnv } from './config/env.config';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { HealthModule } from './modules/health/health.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserThrottlerGuard } from './modules/core/guards/user-throttler.guard';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AppController } from './app.controller';

import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { TenantContextInterceptor } from './modules/tenants/presentation/tenant-context.interceptor';

import { ContentModule } from './modules/content/content.module';
import { CoreModule } from './modules/core/core.module';
import { InstagramConnectionsModule } from './modules/instagram-connections/instagram-connections.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        'apps/api/.env', // Executed from monorepo root
        '.env',          // Executed from apps/api directory
      ],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    PrismaModule,
    AuthModule,
    TenantsModule,
    MembershipsModule,
    InvitationsModule,
    HealthModule,
    ContentModule,
    CoreModule,
    InstagramConnectionsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: UserThrottlerGuard,
    }
  ],
})
export class AppModule {}
