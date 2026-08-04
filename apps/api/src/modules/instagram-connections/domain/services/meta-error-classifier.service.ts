import { SocialConnectionErrorCategory } from '@prisma/client';

export type ErrorClassificationResult = {
  category: SocialConnectionErrorCategory | 'VALID';
  isTransient: boolean;
  retryAfterSeconds?: number;
};

export class MetaErrorClassifier {
  /**
   * Parses the raw error thrown by fetch or Meta's graph API and classifies it.
   */
  static classify(error: unknown): ErrorClassificationResult {
    // If it's not an Error object, it's an unexpected response format
    if (!(error instanceof Error)) {
      return { category: 'INVALID_RESPONSE', isTransient: false };
    }

    const err = error as any;

    // Timeout or network-level fetch error (transient)
    if (err.code === 'TIMEOUT' || err.code === 'FETCH_ERROR') {
      return { category: 'TRANSIENT_ERROR', isTransient: true };
    }

    // Malformed JSON parsing issue
    if (err.code === 'MALFORMED_RESPONSE') {
      return { category: 'INVALID_RESPONSE', isTransient: false };
    }

    // HTTP-level rate limiting
    if (err.status === 429) {
      return { category: 'RATE_LIMITED', isTransient: true };
    }

    // HTTP-level 5xx errors (transient)
    if (err.status >= 500) {
      return { category: 'TRANSIENT_ERROR', isTransient: true };
    }

    // Graph API specific errors usually come parsed inside a custom error or body
    // If we threw it from our adapter, we might have attached the raw Graph API error details.
    // For this classifier, we assume the adapter passes the Graph API JSON in err.graphError or similar,
    // OR we can just parse the error code/subcode directly from the error if attached.

    const code = err.graphErrorCode;
    const subcode = err.graphErrorSubcode;

    if (code !== undefined) {
      // https://developers.facebook.com/docs/graph-api/handling-errors/
      
      // Rate limits inside Graph API body
      if (code === 4 || code === 17 || code === 32 || code === 613) {
        return { category: 'RATE_LIMITED', isTransient: true };
      }

      // App rate limits
      if (code === 2) {
        return { category: 'TRANSIENT_ERROR', isTransient: true }; // Service unavailable
      }

      // Token invalid / expired / revoked
      if (code === 190) {
        if (subcode === 463 || subcode === 460) {
          // 463: Expired, 460: Password changed (effectively expired)
          return { category: 'EXPIRED', isTransient: false };
        }
        if (subcode === 458 || subcode === 490) {
          // 458: App deauthorized
          return { category: 'REVOKED', isTransient: false };
        }
        // Other 190 usually means invalid token, treat as REVOKED as it requires user reconnection
        return { category: 'REVOKED', isTransient: false };
      }

      if (code === 10 || code === 200 || code === 2500) {
        // Permissions missing
        return { category: 'PERMISSION_ERROR', isTransient: false };
      }
    }

    // If it's a 4xx but not matched above, we consider it INVALID_RESPONSE or PERMISSION_ERROR
    // For safety, assume the token isn't revoked but the specific request was invalid
    if (err.status >= 400 && err.status < 500) {
      return { category: 'INVALID_RESPONSE', isTransient: false };
    }

    // Unknown error type
    return { category: 'INVALID_RESPONSE', isTransient: false };
  }
}
