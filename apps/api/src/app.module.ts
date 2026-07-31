import { Module } from '@nestjs/common';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AppController } from './app.controller';

import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantContextInterceptor } from './modules/tenants/presentation/tenant-context.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    TenantsModule,
    MembershipsModule,
    InvitationsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    }
  ],
})
export class AppModule {}
