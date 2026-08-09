import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url().default('redis://127.0.0.1:6379'),
  QUEUE_PREFIX: z.string().min(1).default('glauberads:development'),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(2),
  AI_PROVIDER: z.enum(['fake', 'openai-compatible']).default('fake'),
  AI_API_KEY: z.string().optional(),
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be a 64-character hex string'),
  META_APP_ID: z.string().min(1).optional(),
  META_APP_SECRET: z.string().min(1).optional(),
  META_GRAPH_API_VERSION: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).default('fake-v1'),
  AI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production' && value.AI_PROVIDER === 'fake') ctx.addIssue({ code: 'custom', path: ['AI_PROVIDER'], message: 'fake provider is forbidden in production' });
  if (value.AI_PROVIDER === 'openai-compatible' && !value.AI_API_KEY) ctx.addIssue({ code: 'custom', path: ['AI_API_KEY'], message: 'AI_API_KEY is required' });
});

export type WorkerConfig = z.infer<typeof schema>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const result = schema.safeParse(env);
  if (!result.success) throw new Error(`Invalid worker configuration: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}`);
  return result.data;
}

export function isMetaConfigured(config: WorkerConfig): boolean {
  const isValid = (val: string | undefined): boolean => {
    if (!val) return false;
    const t = val.trim();
    return (
      t !== '' &&
      t !== 'CHANGE_ME' &&
      t !== 'your_staging_meta_app_id' &&
      t !== 'your_staging_meta_app_secret' &&
      !t.startsWith('seu_')
    );
  };
  return isValid(config.META_APP_ID) && isValid(config.META_APP_SECRET) && isValid(config.META_GRAPH_API_VERSION);
}
