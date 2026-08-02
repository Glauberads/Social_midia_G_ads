import { z } from 'zod';
import { buildContentPrompt } from '../prompt/content-prompt';
import { ContentGenerationInput, ContentGenerationProvider, GeneratedContentResult, ProviderError } from './content-generation.provider';

const resultSchema = z.object({
  caption: z.string().min(1).max(2200),
  callToAction: z.string().min(1).max(240),
  hashtags: z.array(z.string().regex(/^#[\p{L}\p{N}_]+$/u)).min(3).max(10),
});

export class OpenAiCompatibleProvider implements ContentGenerationProvider {
  constructor(private readonly apiKey: string, private readonly model: string, private readonly baseUrl: string, private readonly timeoutMs: number) {}

  async generate(input: ContentGenerationInput): Promise<GeneratedContentResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, temperature: 0.4, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: buildContentPrompt(input) }] }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const transient = response.status === 408 || response.status === 429 || response.status >= 500;
        throw new ProviderError(transient ? 'PROVIDER_TRANSIENT_HTTP' : 'PROVIDER_REJECTED_REQUEST', transient, `Provider returned HTTP ${response.status}`);
      }
      const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new ProviderError('PROVIDER_INVALID_RESPONSE', false, 'Provider response has no content');
      const parsed = resultSchema.safeParse(JSON.parse(content));
      if (!parsed.success) throw new ProviderError('PROVIDER_INVALID_RESPONSE', false, 'Provider response failed validation');
      return parsed.data;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (error instanceof SyntaxError) throw new ProviderError('PROVIDER_INVALID_RESPONSE', false, 'Provider returned invalid JSON');
      if (error instanceof Error && error.name === 'AbortError') throw new ProviderError('PROVIDER_TIMEOUT', true, 'Provider timed out');
      throw new ProviderError('PROVIDER_NETWORK_ERROR', true, 'Provider network failure');
    } finally {
      clearTimeout(timer);
    }
  }
}
