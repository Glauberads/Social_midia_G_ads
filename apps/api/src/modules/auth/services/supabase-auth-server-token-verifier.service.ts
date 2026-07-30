import { Injectable, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessTokenVerifier, AuthenticatedIdentity } from './access-token-verifier.interface';
import { decodeJwt } from 'jose';

@Injectable()
export class SupabaseAuthServerTokenVerifier implements AccessTokenVerifier {
  constructor(private readonly configService: ConfigService) {}

  async verify(token: string): Promise<AuthenticatedIdentity> {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const publishableKey = this.configService.get<string>('SUPABASE_PUBLISHABLE_KEY');

    if (!supabaseUrl || !publishableKey) {
      throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required for auth-server verification mode');
    }

    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': publishableKey,
        },
        signal: AbortSignal.timeout(5000), // Timeout de 5s
      });

      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedException('Invalid token');
      }
      
      if (!response.ok) {
        throw new HttpException('Auth server unavailable', HttpStatus.SERVICE_UNAVAILABLE);
      }

      const user = await response.json();
      
      if (!user || !user.id) {
        throw new UnauthorizedException('Invalid user response');
      }

      const decoded = decodeJwt(token);

      return {
        userId: user.id,
        email: user.email,
        audience: decoded.aud as string,
        issuer: decoded.iss as string,
        expiresAt: new Date((decoded.exp as number) * 1000),
      };
    } catch (e: any) {
      if (e instanceof UnauthorizedException || e instanceof HttpException) {
        throw e;
      }
      throw new HttpException('Auth server error: ' + e.message, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
