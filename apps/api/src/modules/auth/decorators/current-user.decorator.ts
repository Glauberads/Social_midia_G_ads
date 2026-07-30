import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedIdentity } from '../services/access-token-verifier.interface';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedIdentity => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
