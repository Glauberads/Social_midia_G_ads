import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException } from '@nestjs/common';
import { AuthenticatedIdentity } from './services/access-token-verifier.interface';

describe('AuthController', () => {
  let controller: AuthController;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const userProfile = {
      findUnique: jest.fn(),
    };
    const mockPrismaService = {
      userProfile,
      $transaction: jest.fn(async (work) => work({
        $executeRaw: jest.fn(),
        userProfile,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should throw ConflictException if profile is absent', async () => {
    jest.spyOn(prismaService.userProfile, 'findUnique').mockResolvedValue(null);
    const identity: AuthenticatedIdentity = {
      userId: 'uuid-1',
      audience: 'authenticated',
      issuer: 'supa',
      expiresAt: new Date(),
    };
    
    await expect(controller.getMe(identity)).rejects.toThrow(ConflictException);
  });

  it('should return profile if present', async () => {
    jest.spyOn(prismaService.userProfile, 'findUnique').mockResolvedValue({
      id: 'uuid-1',
      email: 'test@test.com',
    } as any);

    const identity: AuthenticatedIdentity = {
      userId: 'uuid-1',
      audience: 'authenticated',
      issuer: 'supa',
      expiresAt: new Date(),
    };

    const result = await controller.getMe(identity);
    expect(result).toEqual({ id: 'uuid-1', email: 'test@test.com' });
  });
});
