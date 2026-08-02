import { loadConfig } from './config';
import { sanitizeError } from './processor';
import { FakeContentGenerationProvider } from './providers/fake.provider';
import { buildContentPrompt, CONTENT_PROMPT_VERSION } from './prompt/content-prompt';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';

const input = { title: 'Lançamento', briefing: 'Apresente nosso novo serviço', objective: 'pedir uma demonstração', audience: 'pequenas empresas', tone: 'amigável', platform: 'INSTAGRAM_FEED' };

describe('content generation worker', () => {
  afterEach(() => jest.restoreAllMocks());
  it('generates deterministic structured content with the fake provider', async () => {
    const provider = new FakeContentGenerationProvider();
    await expect(provider.generate(input)).resolves.toEqual({
      caption: expect.stringContaining('Lançamento'),
      callToAction: expect.stringContaining('pedir uma demonstração'),
      hashtags: ['#ConteudoDigital', '#Marketing', '#RedesSociais'],
    });
    await expect(provider.generate(input)).resolves.toEqual(await provider.generate(input));
  });

  it.each([
    ['[[fake:timeout]]', 'PROVIDER_TIMEOUT', true],
    ['[[fake:transient]]', 'PROVIDER_TEMPORARY_FAILURE', true],
    ['[[fake:permanent]]', 'PROVIDER_REJECTED_INPUT', false],
  ])('classifies fake failure %s', async (briefing, code, transient) => {
    await expect(new FakeContentGenerationProvider().generate({ ...input, briefing })).rejects.toMatchObject({ code, transient });
  });

  it('blocks fake provider in production and requires a key for the real provider', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://db', AI_PROVIDER: 'fake' })).toThrow('AI_PROVIDER');
    expect(() => loadConfig({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://db', AI_PROVIDER: 'openai-compatible' })).toThrow('AI_API_KEY');
  });

  it('versions the prompt and avoids instructions to invent facts', () => {
    expect(CONTENT_PROMPT_VERSION).toBe('pt-BR-v1');
    expect(buildContentPrompt(input)).toContain('Não invente fatos específicos');
  });

  it('redacts tokens from persisted error messages', () => {
    expect(sanitizeError(`Bearer ${'s'.repeat(40)}`)).toBe('Bearer [REDACTED]');
  });

  it.each([[429, true], [500, true], [400, false]])('classifies provider HTTP %s', async (status, transient) => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, status } as Response);
    await expect(new OpenAiCompatibleProvider('test-key', 'test-model', 'https://provider.test/v1', 1000).generate(input)).rejects.toMatchObject({ transient });
  });

  it('rejects an invalid structured provider response without retry', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: '{"caption":"only"}' } }] }) } as Response);
    await expect(new OpenAiCompatibleProvider('test-key', 'test-model', 'https://provider.test/v1', 1000).generate(input)).rejects.toMatchObject({ code: 'PROVIDER_INVALID_RESPONSE', transient: false });
  });
});
