import { SetMetadata } from '@nestjs/common';

export const IS_TENANT_SCOPED_KEY = 'isTenantScoped';
export const TenantScoped = () => SetMetadata(IS_TENANT_SCOPED_KEY, true);
