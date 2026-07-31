import { HttpException, HttpStatus } from '@nestjs/common';

export class MembershipNotFoundException extends HttpException {
  constructor() {
    super('MEMBERSHIP_NOT_FOUND', HttpStatus.NOT_FOUND);
  }
}

export class MembershipAccessDeniedException extends HttpException {
  constructor() {
    super('MEMBERSHIP_ACCESS_DENIED', HttpStatus.FORBIDDEN);
  }
}

export class MembershipSuspendedException extends HttpException {
  constructor() {
    super('MEMBERSHIP_SUSPENDED', HttpStatus.FORBIDDEN);
  }
}

export class RoleChangeForbiddenException extends HttpException {
  constructor() {
    super('ROLE_CHANGE_FORBIDDEN', HttpStatus.FORBIDDEN);
  }
}

export class LastOwnerProtectedException extends HttpException {
  constructor() {
    super('LAST_OWNER_PROTECTED', HttpStatus.CONFLICT);
  }
}

export class CannotManageOwnerException extends HttpException {
  constructor() {
    super('CANNOT_MANAGE_OWNER', HttpStatus.FORBIDDEN);
  }
}

export class CannotManageAdminException extends HttpException {
  constructor() {
    super('CANNOT_MANAGE_ADMIN', HttpStatus.FORBIDDEN);
  }
}

export class CannotManageSelfException extends HttpException {
  constructor() {
    super('CANNOT_MANAGE_SELF', HttpStatus.FORBIDDEN);
  }
}

export class TenantContextRequiredException extends HttpException {
  constructor() {
    super('TENANT_CONTEXT_REQUIRED', HttpStatus.BAD_REQUEST);
  }
}
