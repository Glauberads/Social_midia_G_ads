process.env.META_APP_ID = 'test-meta-app-id';
process.env.META_APP_SECRET = 'test-meta-app-secret';
process.env.META_REDIRECT_URI = 'http://localhost:3000/api/integrations/meta/callback';
process.env.META_GRAPH_API_VERSION = 'v20.0';
process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1 = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
jest.setTimeout(120000);