import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MetaIntegrationAvailabilityService } from './meta-integration-availability.service';

describe('MetaIntegrationAvailabilityService', () => {
  let service: MetaIntegrationAvailabilityService;
  let mockConfigService: Partial<ConfigService>;
  let configMap: Record<string, string | undefined> = {};

  beforeEach(async () => {
    configMap = {};
    mockConfigService = {
      get: jest.fn((key: string) => configMap[key]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetaIntegrationAvailabilityService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MetaIntegrationAvailabilityService>(MetaIntegrationAvailabilityService);
  });

  it('should return false if any variable is missing', () => {
    expect(service.isConfigured()).toBe(false);

    configMap['META_APP_ID'] = 'valid';
    expect(service.isConfigured()).toBe(false);
  });

  it('should return false if variables have placeholder values', () => {
    configMap = {
      META_APP_ID: 'CHANGE_ME',
      META_APP_SECRET: 'your_staging_meta_app_secret',
      META_REDIRECT_URI: 'seu_dominio.com/callback',
      META_GRAPH_API_VERSION: 'v20.0',
    };
    expect(service.isConfigured()).toBe(false);
  });

  it('should return true if all variables are valid', () => {
    configMap = {
      META_APP_ID: 'valid_id',
      META_APP_SECRET: 'valid_secret',
      META_REDIRECT_URI: 'https://valid.com/callback',
      META_GRAPH_API_VERSION: 'v20.0',
    };
    expect(service.isConfigured()).toBe(true);
  });
});
