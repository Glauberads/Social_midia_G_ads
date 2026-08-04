import { FakeSocialProviderAdapter } from '../infrastructure/adapters/fake-social.adapter';

describe('FakeSocialProviderAdapter', () => {
  let adapter: FakeSocialProviderAdapter;

  beforeEach(() => {
    adapter = new FakeSocialProviderAdapter();
    adapter.scenario = 'two-accounts';
  });

  it('builds a valid authorization URL with state', () => {
    const url = adapter.buildAuthorizationUrl('mystate', 'http://localhost/callback', ['pages_show_list']);
    expect(url).toContain('fake.provider');
    expect(url).toContain('state=mystate');
  });

  it('exchanges code and returns a token', async () => {
    const result = await adapter.exchangeCode('code123', 'http://localhost/callback');
    expect(result.accessToken).toMatch(/^fake-short-/);
    expect(result.expiresIn).toBe(3600);
    expect(result.scopes).toContain('instagram_basic');
  });

  it('does not return a refresh_token in exchange result', async () => {
    const result = await adapter.exchangeCode('code', '');
    expect((result as any).refreshToken).toBeUndefined();
  });

  it('exchanges short-lived for long-lived token', async () => {
    const result = await adapter.exchangeForLongLivedToken('fake-short-abc');
    expect(result.accessToken).toMatch(/^fake-long-/);
    expect(result.expiresIn).toBe(5184000);
  });

  it('lists two accounts in default scenario', async () => {
    const accounts = await adapter.listAvailableAccounts('fake-token');
    expect(accounts).toHaveLength(2);
    expect(accounts[0]).toHaveProperty('instagramAccountId');
    expect(accounts[0]).toHaveProperty('instagramUsername');
    expect(accounts[0]).toHaveProperty('pageId');
    expect(accounts[0]).toHaveProperty('pageName');
  });

  it('lists one account in one-account scenario', async () => {
    adapter.scenario = 'one-account';
    const accounts = await adapter.listAvailableAccounts('fake-token');
    expect(accounts).toHaveLength(1);
  });

  it('lists no accounts in no-accounts scenario', async () => {
    adapter.scenario = 'no-accounts';
    const accounts = await adapter.listAvailableAccounts('fake-token');
    expect(accounts).toHaveLength(0);
  });

  it('throws on timeout', async () => {
    adapter.scenario = 'timeout';
    await expect(adapter.exchangeCode('code', '')).rejects.toThrow(/timed out/i);
  });

  it('throws on 429', async () => {
    adapter.scenario = '429';
    await expect(adapter.listAvailableAccounts('tok')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('throws on 500', async () => {
    adapter.scenario = '500';
    await expect(adapter.listAvailableAccounts('tok')).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
  });

  it('throws on malformed response', async () => {
    adapter.scenario = 'malformed';
    await expect(adapter.exchangeCode('code', '')).rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' });
  });

  it('throws TOKEN_INVALID on invalid token scenario', async () => {
    adapter.scenario = 'token-invalid';
    await expect(adapter.listAvailableAccounts('bad-token')).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
  });

  it('throws TOKEN_REVOKED on revoked token scenario', async () => {
    adapter.scenario = 'token-revoked';
    await expect(adapter.exchangeForLongLivedToken('revoked-token')).rejects.toMatchObject({ code: 'TOKEN_REVOKED' });
  });

  it('validates connection as invalid for token-invalid scenario', async () => {
    adapter.scenario = 'token-invalid';
    await expect(adapter.validateConnection('bad')).rejects.toThrow('Token is invalid');
  });

  it('validates connection as valid in normal scenario', async () => {
    const result = await adapter.validateConnection('good-token');
    expect(result.userId).toBe('fake-user-123');
  });

  it('generates different tokens on successive calls (randomBytes-based)', async () => {
    const r1 = await adapter.exchangeCode('code1', '');
    const r2 = await adapter.exchangeCode('code2', '');
    expect(r1.accessToken).not.toBe(r2.accessToken);
  });
});
