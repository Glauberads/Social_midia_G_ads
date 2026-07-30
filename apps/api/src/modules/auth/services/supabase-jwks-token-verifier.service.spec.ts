import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseJwksTokenVerifier } from './supabase-jwks-token-verifier.service';
import * as jose from 'jose';

// Mock jose
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

describe('SupabaseJwksTokenVerifier', () => {
  let verifier: SupabaseJwksTokenVerifier;
  let mockConfigService: any;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'SUPABASE_JWKS_URL') return 'http://localhost/jwks';
        if (key === 'SUPABASE_JWT_ISSUER') return 'issuer';
        if (key === 'SUPABASE_JWT_AUDIENCE') return 'audience';
        if (key === 'SUPABASE_ALLOWED_ALGORITHMS') return 'ES256,RS256';
        return null;
      }),
    };

    verifier = new SupabaseJwksTokenVerifier(mockConfigService as ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const getPayload = (sub: any) => ({
    sub,
    email: 'test@example.com',
    aud: 'audience',
    iss: 'issuer',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  it('deve falhar se sub estiver ausente', async () => {
    (jose.jwtVerify as jest.Mock).mockResolvedValue({ payload: getPayload(undefined) });
    await expect(verifier.verify('token')).rejects.toThrow(UnauthorizedException);
    await expect(verifier.verify('token')).rejects.toThrow('Missing or invalid subject (sub) in token');
  });

  it('deve falhar se sub for vazio', async () => {
    (jose.jwtVerify as jest.Mock).mockResolvedValue({ payload: getPayload('') });
    await expect(verifier.verify('token')).rejects.toThrow(UnauthorizedException);
    await expect(verifier.verify('token')).rejects.toThrow('Missing or invalid subject (sub) in token');
  });

  it('deve falhar se sub não for string', async () => {
    (jose.jwtVerify as jest.Mock).mockResolvedValue({ payload: getPayload(12345) });
    await expect(verifier.verify('token')).rejects.toThrow(UnauthorizedException);
    await expect(verifier.verify('token')).rejects.toThrow('Missing or invalid subject (sub) in token');
  });

  it('deve falhar se sub for string não UUID', async () => {
    (jose.jwtVerify as jest.Mock).mockResolvedValue({ payload: getPayload('not-a-uuid') });
    await expect(verifier.verify('token')).rejects.toThrow(UnauthorizedException);
    await expect(verifier.verify('token')).rejects.toThrow('Invalid subject format (not a UUID)');
  });

  it('deve passar se sub for UUID válido', async () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    (jose.jwtVerify as jest.Mock).mockResolvedValue({ payload: getPayload(validUuid) });
    const identity = await verifier.verify('token');
    expect(identity.userId).toBe(validUuid);
  });
});
