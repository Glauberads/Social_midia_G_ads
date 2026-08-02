import { ContentGenerationInput } from '../providers/content-generation.provider';

export const CONTENT_PROMPT_VERSION = 'pt-BR-v1';

export function buildContentPrompt(input: ContentGenerationInput): string {
  return [
    'Você é um redator de redes sociais. Responda em português brasileiro.',
    `Plataforma: ${input.platform}. Tom: ${input.tone || 'claro e profissional'}.`,
    'Não invente fatos específicos, não produza conteúdo ofensivo e não inclua alegações não presentes no briefing.',
    'Retorne somente JSON válido com caption, callToAction e hashtags (array de 3 a 10 strings iniciadas por #).',
    'Legenda: no máximo 2.200 caracteres. CTA: no máximo 240 caracteres.',
    `Título: ${input.title}`,
    `Briefing: ${input.briefing}`,
    `Objetivo: ${input.objective || 'não informado'}`,
    `Público: ${input.audience || 'não informado'}`,
  ].join('\n');
}
