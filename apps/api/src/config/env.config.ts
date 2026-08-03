import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1024).max(65535).default(3001),
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_JWT_AUDIENCE: z.string().default('authenticated'),
  INVITATION_TOKEN_PEPPER: z.string().min(32, 'Pepper must be at least 32 characters long'),
  INVITATION_TTL_HOURS: z.coerce.number().min(1).max(720).default(48),
  INVITATION_EXPOSE_RAW_TOKEN: z.coerce.boolean().default(false),
  WEB_ORIGIN: z.string().url().or(z.string().regex(/^http:\/\/localhost:\d+$/)),
  SUPABASE_JWKS_URL: z.string().url().optional(),
  SUPABASE_JWT_VERIFICATION_MODE: z.enum(['jwks', 'auth-server']).default('jwks'),
  SUPABASE_ALLOWED_ALGORITHMS: z.string().default('ES256,RS256'),
  REDIS_URL: z.string().url().default('redis://127.0.0.1:6379'),
  QUEUE_PREFIX: z.string().min(1).default('glauberads:development'),
  GENERATION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  AI_PROVIDER: z.enum(['fake', 'openai-compatible']).default('fake'),
  AI_MODEL: z.string().min(1).default('fake-v1'),
  // Social / Meta integration
  SOCIAL_TOKEN_ENCRYPTION_KEY_V1: z.string().regex(/^[0-9a-fA-F]{64}$/, 'Must be 64 hex chars (32 bytes)').optional(),
  META_APP_ID: z.string().min(1).optional(),
  META_APP_SECRET: z.string().min(1).optional(),
  META_REDIRECT_URI: z.string().url().optional(),
  META_GRAPH_API_VERSION: z.string().regex(/^v\d+\.\d+$/, 'Must be in format v20.0').optional(),
  SOCIAL_PROVIDER: z.enum(['fake', 'meta']).default('fake'),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production') {
    if (data.INVITATION_EXPOSE_RAW_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'INVITATION_EXPOSE_RAW_TOKEN must be false in production',
        path: ['INVITATION_EXPOSE_RAW_TOKEN'],
      });
    }
    if (data.WEB_ORIGIN === '*' || data.WEB_ORIGIN.includes('*')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'WEB_ORIGIN cannot contain wildcards in production',
        path: ['WEB_ORIGIN'],
      });
    }
  }
});

export function validateEnv(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    result.error.issues.forEach((issue) => {
      console.error(`   - [${issue.path.join('.')}] ${issue.message}`);
    });
    // Do not throw the raw error that might expose sensitive values
    throw new Error('Invalid environment variables.');
  }
  return result.data;
}
