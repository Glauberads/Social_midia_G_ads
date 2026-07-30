import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { TenantScope } from '../domain/tenant.types';

@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<TenantScope>();

  run<R>(scope: TenantScope, callback: () => R): R {
    return this.als.run(scope, callback);
  }

  getOptional(): TenantScope | undefined {
    return this.als.getStore();
  }

  getRequired(): TenantScope {
    const scope = this.als.getStore();
    if (!scope) {
      throw new UnauthorizedException('Tenant context is required but not found in current execution scope.');
    }
    return scope;
  }
}
