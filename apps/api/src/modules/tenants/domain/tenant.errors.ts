import { ConflictException } from '@nestjs/common';

export const RESERVED_SLUGS = [
  'api', 'app', 'admin', 'auth', 'login', 'cadastro', 
  'dashboard', 'support', 'billing', 'system', 'root', 'www'
];

export class TenantSlugAlreadyExistsException extends ConflictException {
  constructor() {
    super('TENANT_SLUG_ALREADY_EXISTS');
  }
}

export class AuthProfileNotProvisionedException extends ConflictException {
  constructor() {
    super('AUTH_PROFILE_NOT_PROVISIONED');
  }
}
