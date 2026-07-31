import { Injectable, ForbiddenException, ServiceUnavailableException, BadGatewayException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUserResolver, ResolvedAuthenticatedUser } from '../application/ports/authenticated-user.resolver';

@Injectable()
export class SupabaseAuthenticatedUserProvider implements AuthenticatedUserResolver {
  constructor(private readonly config: ConfigService) {}

  async resolve(accessToken: string): Promise<ResolvedAuthenticatedUser> {
    if (!accessToken) {
      throw new ConflictException('AUTH_EMAIL_REQUIRED');
    }

    const supabaseUrl = this.config.get<string>('SUPABASE_URL') || 'http://127.0.0.1:54321';
    const anonKey = this.config.get<string>('SUPABASE_ANON_KEY') || '';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': anonKey
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status === 401) throw new ForbiddenException('UNAUTHORIZED');
        throw new BadGatewayException('AUTH_PROVIDER_INVALID_RESPONSE');
      }

      const authUser = await res.json();

      if (!authUser.email) {
        throw new ConflictException('AUTH_EMAIL_REQUIRED');
      }

      if (!authUser.email_confirmed_at) {
        throw new ForbiddenException('AUTH_EMAIL_NOT_CONFIRMED');
      }

      return {
        email: authUser.email,
        emailConfirmedAt: new Date(authUser.email_confirmed_at)
      };
    } catch (e: any) {
      if (e instanceof ForbiddenException || e instanceof ConflictException || e instanceof BadGatewayException) {
        throw e;
      }
      if (e.name === 'AbortError' || e.code === 'ECONNREFUSED' || e.message?.includes('fetch failed')) {
        throw new ServiceUnavailableException('AUTH_PROVIDER_UNAVAILABLE');
      }
      throw new ServiceUnavailableException('AUTH_PROVIDER_UNAVAILABLE');
    }
  }
}
