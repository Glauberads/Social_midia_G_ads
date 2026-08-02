import { ContentGenerationProvider, ContentGenerationInput, GeneratedContentResult, ProviderError } from './content-generation.provider';

export class FakeContentGenerationProvider implements ContentGenerationProvider {
  async generate(input: ContentGenerationInput): Promise<GeneratedContentResult> {
    if (input.briefing.includes('[[fake:timeout]]')) {
      throw new ProviderError('PROVIDER_TIMEOUT', true, 'Provider timed out');
    }
    if (input.briefing.includes('[[fake:transient]]')) {
      throw new ProviderError('PROVIDER_TEMPORARY_FAILURE', true, 'Temporary provider failure');
    }
    if (input.briefing.includes('[[fake:permanent]]')) {
      throw new ProviderError('PROVIDER_REJECTED_INPUT', false, 'Provider rejected the input');
    }
    const platform = input.platform.toLowerCase().replaceAll('_', ' ');
    return {
      caption: `${input.title}\n\n${input.briefing}\n\nConteúdo preparado para ${platform}, com uma mensagem clara e relevante.`,
      callToAction: input.objective ? `Saiba mais e ${input.objective.toLowerCase()}.` : 'Conte para nós o que você achou.',
      hashtags: ['#ConteudoDigital', '#Marketing', '#RedesSociais'],
    };
  }
}
