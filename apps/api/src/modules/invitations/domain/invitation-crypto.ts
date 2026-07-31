import * as crypto from 'crypto';

export class InvitationTokenGenerator {
  static generate(): string {
    return crypto.randomBytes(32).toString('base64url');
  }
}

export class InvitationTokenHasher {
  static hash(token: string, pepper: string): string {
    return crypto
      .createHmac('sha256', pepper)
      .update(token)
      .digest('base64url');
  }
}
