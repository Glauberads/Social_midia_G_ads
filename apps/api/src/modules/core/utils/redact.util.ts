const SENSITIVE_KEYS = [
  'authorization',
  'cookie',
  'set-cookie',
  'access_token',
  'refresh_token',
  'token',
  'rawToken',
  'tokenHash',
  'password',
  'pepper',
  'secret',
  'apiKey',
  'apikey',
];

export function redactLog(obj: any, seen = new WeakSet()): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'object') {
    if (seen.has(obj)) {
      return '[Circular]';
    }
    seen.add(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactLog(item, seen));
  }

  if (typeof obj === 'object') {
    const redacted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactLog(value, seen);
      }
    }
    return redacted;
  }

  return obj;
}
