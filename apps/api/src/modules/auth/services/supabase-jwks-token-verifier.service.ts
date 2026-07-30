import { Injectable, UnauthorizedException, ServiceUnavailableException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AccessTokenVerifier, AuthenticatedIdentity } from './access-token-verifier.interface';

@Injectable()
export class SupabaseJwksTokenVerifier implements AccessTokenVerifier {
  private JWKS: any;

  constructor(private readonly configService: ConfigService) {
    const jwksUrl = this.configService.get<string>('SUPABASE_JWKS_URL');
    if (!jwksUrl) throw new Error('SUPABASE_JWKS_URL is required for jwks verification mode');
    // ETAPA 2: Timeout Explicito (5000ms)
    this.JWKS = createRemoteJWKSet(new URL(jwksUrl), {
      timeoutDuration: 5000,
    });
  }

  async verify(token: string): Promise<AuthenticatedIdentity> {
    try {
      const issuer = this.configService.get<string>('SUPABASE_JWT_ISSUER');
      const audience = this.configService.get<string>('SUPABASE_JWT_AUDIENCE');
      // Algoritmos suportados: ES256, RS256 configurados via variável se necessário.
      // Explicitamente limitando os permitidos
      const allowedAlgorithms = this.configService.get<string>('SUPABASE_ALLOWED_ALGORITHMS', 'ES256,RS256').split(',');
      
      const { payload } = await jwtVerify(token, this.JWKS, {
        issuer,
        audience,
        algorithms: allowedAlgorithms,
      });

      if (!payload.sub || typeof payload.sub !== 'string') {
        throw new UnauthorizedException('Missing or invalid subject (sub) in token');
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(payload.sub)) {
        throw new UnauthorizedException('Invalid subject format (not a UUID)');
      }

      if (payload.role === 'service_role') {
        throw new UnauthorizedException('Service role tokens are not allowed for users');
      }

      return {
        userId: payload.sub,
        email: payload.email as string,
        audience: payload.aud as string,
        issuer: payload.iss as string,
        expiresAt: new Date((payload.exp as number) * 1000),
      };
    } catch (e: any) {
      // Diferenciar erros JWKS (Rede/Timeout) x Erros de Validação JWT
      if (e.code === 'ERR_JOSE_GENERIC' || e.name === 'FetchError' || e.code === 'UND_ERR_CONNECT_TIMEOUT' || e.name === 'TypeError' || e.message?.includes('fetch failed')) {
        throw new ServiceUnavailableException('JWKS/Auth Provider indisponivel');
      }
      if (
        e.code === 'ERR_JWT_EXPIRED' ||
        e.code === 'ERR_JWT_INVALID' ||
        e.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' ||
        e.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' ||
        e instanceof UnauthorizedException
      ) {
        throw new UnauthorizedException('Invalid or expired token: ' + (e instanceof UnauthorizedException ? e.message : e.code));
      }
      
      // Erro inesperado -> 500 sanitizado
      throw new InternalServerErrorException('Erro interno inesperado');
    }
  }
}
