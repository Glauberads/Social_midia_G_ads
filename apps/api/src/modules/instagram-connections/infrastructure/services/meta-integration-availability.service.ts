import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MetaIntegrationAvailabilityService {
  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    const appId = this.configService.get<string>('META_APP_ID');
    const appSecret = this.configService.get<string>('META_APP_SECRET');
    const redirectUri = this.configService.get<string>('META_REDIRECT_URI');
    const apiVersion = this.configService.get<string>('META_GRAPH_API_VERSION');

    const isValid = (val: string | undefined): boolean => {
      if (!val) return false;
      const t = val.trim();
      return (
        t !== '' &&
        t !== 'CHANGE_ME' &&
        t !== 'your_staging_meta_app_id' &&
        t !== 'your_staging_meta_app_secret' &&
        !t.startsWith('seu_')
      );
    };

    return isValid(appId) && isValid(appSecret) && isValid(redirectUri) && isValid(apiVersion);
  }
}
