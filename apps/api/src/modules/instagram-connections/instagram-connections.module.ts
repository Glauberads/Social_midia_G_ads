import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InstagramConnectionsController } from './presentation/controllers/instagram-connections.controller';
import { StartOAuthFlowUseCase } from './application/use-cases/start-oauth-flow.use-case';
import { HandleOAuthCallbackUseCase } from './application/use-cases/handle-oauth-callback.use-case';
import { ListAvailableAccountsUseCase } from './application/use-cases/list-available-accounts.use-case';
import { SelectSocialAccountUseCase } from './application/use-cases/select-social-account.use-case';
import { GetSocialConnectionStatusUseCase } from './application/use-cases/get-social-connection-status.use-case';
import { DisconnectSocialConnectionUseCase } from './application/use-cases/disconnect-social-connection.use-case';
import { GetSocialConnectionHealthUseCase } from './application/use-cases/get-social-connection-health.use-case';
import { ValidateSocialConnectionUseCase } from './application/use-cases/validate-social-connection.use-case';
import { RefreshSocialConnectionUseCase } from './application/use-cases/refresh-social-connection.use-case';
import { FakeSocialProviderAdapter } from './infrastructure/adapters/fake-social.adapter';
import { MetaIntegrationAvailabilityService } from './infrastructure/services/meta-integration-availability.service';
import { MetaInstagramAdapter } from './infrastructure/adapters/meta-instagram.adapter';
import { SOCIAL_PROVIDER_ADAPTER } from './domain/ports/social-provider.adapter';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [ConfigModule, TenantsModule],
  controllers: [InstagramConnectionsController],
  providers: [
    StartOAuthFlowUseCase,
    HandleOAuthCallbackUseCase,
    ListAvailableAccountsUseCase,
    SelectSocialAccountUseCase,
    GetSocialConnectionStatusUseCase,
    DisconnectSocialConnectionUseCase,
    GetSocialConnectionHealthUseCase,
    ValidateSocialConnectionUseCase,
    RefreshSocialConnectionUseCase,
    FakeSocialProviderAdapter,
    MetaInstagramAdapter,
    MetaIntegrationAvailabilityService,
    {
      provide: SOCIAL_PROVIDER_ADAPTER,
      useFactory: (config: ConfigService, fake: FakeSocialProviderAdapter, meta: MetaInstagramAdapter) => {
        return config.get('NODE_ENV') === 'test' ? fake : meta;
      },
      inject: [ConfigService, FakeSocialProviderAdapter, MetaInstagramAdapter],
    },
  ],
})
export class InstagramConnectionsModule {}
