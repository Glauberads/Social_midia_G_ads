import { Controller, Get, Logger, ConflictException } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedIdentity } from './services/access-token-verifier.interface';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async getMe(@CurrentUser() identity: AuthenticatedIdentity) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { id: identity.userId },
    });

    if (!profile) {
      this.logger.warn({
        message: 'Auth profile not provisioned',
        userId: identity.userId,
        reason: 'Sync divergence',
      });
      
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'UserProfile is not provisioned',
        code: 'AUTH_PROFILE_NOT_PROVISIONED',
      });
    }

    return {
      id: profile.id,
      email: profile.email,
    };
  }
}
