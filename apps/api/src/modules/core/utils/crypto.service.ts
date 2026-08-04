import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export type EncryptionContext =
  | { kind: 'social-token'; tenantId: string; connectionId: string; provider: string }
  | { kind: 'oauth-session'; tenantId: string; sessionId: string; provider: string };

function buildAad(ctx: EncryptionContext): Buffer {
  if (ctx.kind === 'social-token') {
    return Buffer.from(
      `social-token:v1:${ctx.tenantId}:${ctx.connectionId}:${ctx.provider}`,
      'utf8',
    );
  }
  return Buffer.from(
    `oauth-session:v1:${ctx.tenantId}:${ctx.sessionId}:${ctx.provider}`,
    'utf8',
  );
}

@Injectable()
export class TokenEncryptionService implements OnModuleInit {
  private readonly logger = new Logger(TokenEncryptionService.name);
  private key!: Buffer;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const keyHex = this.configService.get<string>('SOCIAL_TOKEN_ENCRYPTION_KEY_V1');

    if (!keyHex) {
      throw new Error('[TokenEncryptionService] SOCIAL_TOKEN_ENCRYPTION_KEY_V1 is not set.');
    }

    if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
      throw new Error(
        '[TokenEncryptionService] SOCIAL_TOKEN_ENCRYPTION_KEY_V1 must be a 64-character lowercase hex string (32 bytes).',
      );
    }

    this.key = Buffer.from(keyHex, 'hex');

    if (this.key.length !== 32) {
      throw new Error(
        '[TokenEncryptionService] Derived key length must be exactly 32 bytes.',
      );
    }

    this.logger.log('TokenEncryptionService initialized.');
  }

  /** Encrypts plaintext using AES-256-GCM with context-bound AAD. */
  encrypt(plaintext: string, ctx: EncryptionContext): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(buildAad(ctx));

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  /** Decrypts a v1-formatted token. Throws if AAD doesn't match, version unknown, or integrity fails. */
  decrypt(encryptedToken: string, ctx: EncryptionContext): string {
    const parts = encryptedToken.split(':');

    if (parts.length !== 4) {
      throw new Error('[TokenEncryptionService] Malformed encrypted token.');
    }

    const [version, ivB64, authTagB64, ciphertextB64] = parts;

    if (version !== 'v1') {
      throw new Error(`[TokenEncryptionService] Unsupported token version: ${version}`);
    }

    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    decipher.setAAD(buildAad(ctx));

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
