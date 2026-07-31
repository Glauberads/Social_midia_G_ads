import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InvitationsController } from './presentation/controllers/invitations.controller';
import { CreateInvitationUseCase } from './application/use-cases/create-invitation.use-case';
import { AcceptInvitationUseCase } from './application/use-cases/accept-invitation.use-case';
import { RevokeInvitationUseCase } from './application/use-cases/revoke-invitation.use-case';
import { ListInvitationsUseCase } from './application/use-cases/list-invitations.use-case';
import { PrismaInvitationRepository } from './infrastructure/prisma-invitation.repository';
import { SupabaseAuthenticatedUserProvider } from './infrastructure/supabase-authenticated-user.provider';

@Module({
  imports: [PrismaModule],
  controllers: [InvitationsController],
  providers: [
    CreateInvitationUseCase,
    AcceptInvitationUseCase,
    RevokeInvitationUseCase,
    ListInvitationsUseCase,
    {
      provide: 'InvitationRepository',
      useClass: PrismaInvitationRepository
    },
    {
      provide: 'AuthenticatedUserResolver',
      useClass: SupabaseAuthenticatedUserProvider
    }
  ],
  exports: []
})
export class InvitationsModule {}
