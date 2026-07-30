import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextService } from '../application/tenant-context.service';
import { TenantScope } from '../domain/tenant.types';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContextService: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const scope = request.tenantScope as TenantScope | undefined;

    if (scope) {
      // If we have a tenant scope from the guard, run the rest of the request inside the ALS
      return this.tenantContextService.run(scope, () => next.handle());
    }

    // Otherwise, just proceed (e.g. global routes)
    return next.handle();
  }
}
