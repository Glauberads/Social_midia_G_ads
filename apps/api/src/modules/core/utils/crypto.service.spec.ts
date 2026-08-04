import { TokenEncryptionService, EncryptionContext } from './crypto.service';
import { ConfigService } from '@nestjs/config';

describe('TokenEncryptionService', () => {
  let service: TokenEncryptionService;
  const validKey = 'a'.repeat(64); // 64 hex chars = 32 bytes
  const tenantId = 'tenant-abc-123';
  const connectionId = 'conn-def-456';
  const provider = 'META_INSTAGRAM';

  function makeService(keyHex: string | undefined) {
    const configService = {
      get: jest.fn().mockReturnValue(keyHex),
    } as unknown as ConfigService;
    const svc = new TokenEncryptionService(configService);
    svc.onModuleInit();
    return svc;
  }

  beforeEach(() => {
    service = makeService(validKey);
  });

  // ─── Bootstrap failures ───────────────────────────────────────────────────

  it('should throw when SOCIAL_TOKEN_ENCRYPTION_KEY_V1 is not set', () => {
    expect(() => makeService(undefined)).toThrow(/not set/i);
  });

  it('should throw when key is wrong length', () => {
    expect(() => makeService('abc123')).toThrow(/64-character/i);
  });

  it('should throw when key contains non-hex characters', () => {
    expect(() => makeService('z'.repeat(64))).toThrow(/64-character/i);
  });

  // ─── Encryption / Decryption ──────────────────────────────────────────────

  it('encrypts and decrypts a social-token successfully', () => {
    const ctx: EncryptionContext = { kind: 'social-token', tenantId, connectionId, provider };
    const plaintext = 'EAAtest_access_token_12345';
    const encrypted = service.encrypt(plaintext, ctx);
    expect(encrypted).toMatch(/^v1:/);
    const decrypted = service.decrypt(encrypted, ctx);
    expect(decrypted).toBe(plaintext);
  });

  it('encrypts and decrypts an oauth-session token', () => {
    const ctx: EncryptionContext = { kind: 'oauth-session', tenantId, sessionId: 'session-xyz', provider };
    const plaintext = 'EAASHORTTOKENHERE';
    const encrypted = service.encrypt(plaintext, ctx);
    const decrypted = service.decrypt(encrypted, ctx);
    expect(decrypted).toBe(plaintext);
  });

  it('generates different ciphertext for same plaintext (random IV)', () => {
    const ctx: EncryptionContext = { kind: 'social-token', tenantId, connectionId, provider };
    const enc1 = service.encrypt('token', ctx);
    const enc2 = service.encrypt('token', ctx);
    expect(enc1).not.toBe(enc2);
  });

  it('fails decryption when AAD is wrong (wrong tenantId)', () => {
    const ctx: EncryptionContext = { kind: 'social-token', tenantId, connectionId, provider };
    const encrypted = service.encrypt('sensitive_token', ctx);
    const wrongCtx: EncryptionContext = { kind: 'social-token', tenantId: 'different-tenant', connectionId, provider };
    expect(() => service.decrypt(encrypted, wrongCtx)).toThrow();
  });

  it('fails decryption when ciphertext is altered', () => {
    const ctx: EncryptionContext = { kind: 'social-token', tenantId, connectionId, provider };
    const encrypted = service.encrypt('sensitive_token', ctx);
    const tampered = encrypted.slice(0, -2) + 'XX';
    expect(() => service.decrypt(tampered, ctx)).toThrow();
  });

  it('fails decryption for unknown version prefix', () => {
    const ctx: EncryptionContext = { kind: 'social-token', tenantId, connectionId, provider };
    const encrypted = service.encrypt('token', ctx);
    const v2 = 'v2' + encrypted.slice(2);
    expect(() => service.decrypt(v2, ctx)).toThrow(/Unsupported token version/i);
  });

  it('fails decryption for malformed token (wrong parts)', () => {
    const ctx: EncryptionContext = { kind: 'social-token', tenantId, connectionId, provider };
    expect(() => service.decrypt('v1:onlytwoparts', ctx)).toThrow(/Malformed/i);
  });

  it('does not log plaintext (no console.log calls with token value)', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const ctx: EncryptionContext = { kind: 'social-token', tenantId, connectionId, provider };
    service.encrypt('super_secret_token', ctx);
    const calls = spy.mock.calls.map((c) => c.join(''));
    expect(calls.some((c) => c.includes('super_secret_token'))).toBe(false);
    spy.mockRestore();
  });
});
