import { Injectable, Inject, ConflictException, ForbiddenException } from '@nestjs/common';
import { InvitationRepository } from '../../application/ports/invitation.repository';
import { TenantScope } from '../../../tenants/domain/tenant.types';
import { CreateInvitationDto } from '../../presentation/dto/create-invitation.dto';
import { InvitationTokenGenerator, InvitationTokenHasher } from '../../domain/invitation-crypto';
import { EmailNormalizer } from '../../domain/email-normalizer';
import { Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CreateInvitationUseCase {
  constructor(
    @Inject('InvitationRepository') private readonly invitationRepo: InvitationRepository,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async execute(scope: TenantScope, dto: CreateInvitationDto) {
    const actorRole = scope.role as Role;
    const targetRole = dto.role as Role;

    // RBAC for invitations
    if (actorRole === Role.ADMIN) {
      if (targetRole === Role.OWNER || targetRole === Role.ADMIN) {
        throw new ForbiddenException('ADMIN cannot invite OWNER or ADMIN');
      }
    }

    const normalizedEmail = EmailNormalizer.normalize(dto.email);
    const rawToken = InvitationTokenGenerator.generate();
    const pepper = this.config.get<string>('INVITATION_TOKEN_PEPPER');
    if (!pepper) throw new Error('INVITATION_TOKEN_PEPPER is not configured');

    const tokenHash = InvitationTokenHasher.hash(rawToken, pepper);
    const ttlHours = this.config.get<number>('INVITATION_TTL_HOURS') || 168; // 7 days default
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    try {
      const invitation = await this.invitationRepo.create(scope, {
        email: normalizedEmail,
        role: targetRole,
        tokenHash,
        expiresAt,
        status: 'PENDING',
        invitedById: scope.userId,
        tenantId: scope.tenantId
      });

      // Audit log out of transaction because create doesn't support tx yet in this repo method
      // Wait, we can just do it in one tx or create after
      await this.prisma.auditLog.create({
        data: {
          action: 'INVITATION_CREATED',
          entity: 'Invitation',
          entityId: invitation.id,
          actorId: scope.userId,
          tenantId: scope.tenantId,
          metadata: {
            targetEmail: normalizedEmail,
            targetRole,
            expiresAt
          }
        }
      });

      const exposeToken = this.config.get<string>('INVITATION_EXPOSE_RAW_TOKEN') === 'true';
      const isDevOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

      const response: any = {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt
      };

      if (exposeToken && isDevOrTest) {
        response.rawToken = rawToken;
      }

      return response;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('INVITATION_ALREADY_PENDING');
      }
      throw error;
    }
  }
}
