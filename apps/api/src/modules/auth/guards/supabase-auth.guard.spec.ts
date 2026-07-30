import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { Reflector } from '@nestjs/core';
import { UnauthorizedException } from '@nestjs/common';
import { AccessTokenVerifier } from '../services/access-token-verifier.interface';

describe('SupabaseAuthGuard', () => {
  let guard: SupabaseAuthGuard;
  let reflector: Reflector;
  let tokenVerifier: AccessTokenVerifier;

  beforeEach(async () => {
    const mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const mockTokenVerifier = {
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseAuthGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: 'AccessTokenVerifier', useValue: mockTokenVerifier },
      ],
    }).compile();

    guard = module.get<SupabaseAuthGuard>(SupabaseAuthGuard);
    reflector = module.get<Reflector>(Reflector);
    tokenVerifier = module.get<AccessTokenVerifier>('AccessTokenVerifier');
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow public routes', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const mockContext: any = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    };
    
    expect(await guard.canActivate(mockContext)).toBe(true);
  });

  it('should throw UnauthorizedException if header is absent', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const mockContext: any = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
        }),
      }),
    };

    await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if scheme is not Bearer', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const mockContext: any = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Basic token123' },
        }),
      }),
    };

    await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
  });

  it('should set request.user and allow if token is valid', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const req = { headers: { authorization: 'Bearer valid_token' } };
    const mockContext: any = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    };

    jest.spyOn(tokenVerifier, 'verify').mockResolvedValue({
      userId: 'test-user',
      audience: 'authenticated',
      issuer: 'supabase',
      expiresAt: new Date(),
    });

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
    expect((req as any)['user'].userId).toBe('test-user');
  });

  it('should throw UnauthorizedException if token is invalid', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const mockContext: any = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer invalid_token' },
        }),
      }),
    };

    jest.spyOn(tokenVerifier, 'verify').mockRejectedValue(new Error('Invalid token'));

    await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
  });
});
