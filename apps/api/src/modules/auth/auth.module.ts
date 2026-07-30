import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { SupabaseJwksTokenVerifier } from './services/supabase-jwks-token-verifier.service';
import { SupabaseAuthServerTokenVerifier } from './services/supabase-auth-server-token-verifier.service';
import { PrismaModule } from '../prisma/prisma.module';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AuthController],
  providers: [
    {
      provide: 'AccessTokenVerifier',
      useFactory: (configService: ConfigService) => {
        const mode = configService.get<string>('SUPABASE_AUTH_VERIFICATION_MODE', 'jwks');
        if (mode === 'auth-server') {
          return new SupabaseAuthServerTokenVerifier(configService);
        }
        return new SupabaseJwksTokenVerifier(configService);
      },
      inject: [ConfigService],
    },
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    },
  ],
  exports: ['AccessTokenVerifier'],
})
export class AuthModule {}
