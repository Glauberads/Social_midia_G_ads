export interface ContentGenerationInput {
  title: string;
  briefing: string;
  objective: string | null;
  audience: string | null;
  tone: string | null;
  platform: string;
}

export interface GeneratedContentResult {
  caption: string;
  callToAction: string;
  hashtags: string[];
}

export interface ContentGenerationProvider {
  generate(input: ContentGenerationInput): Promise<GeneratedContentResult>;
}

export class ProviderError extends Error {
  constructor(public readonly code: string, public readonly transient: boolean, message: string) {
    super(message);
    this.name = 'ProviderError';
  }
}
