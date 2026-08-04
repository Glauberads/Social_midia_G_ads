import { MetaErrorClassifier } from './meta-error-classifier.service';

describe('MetaErrorClassifier', () => {
  it('should return TRANSIENT_ERROR for TIMEOUT', () => {
    const error = Object.assign(new Error('Timeout'), { code: 'TIMEOUT' });
    const result = MetaErrorClassifier.classify(error);
    expect(result).toEqual({ category: 'TRANSIENT_ERROR', isTransient: true });
  });

  it('should return RATE_LIMITED for HTTP 429', () => {
    const error = Object.assign(new Error('Rate limited'), { status: 429 });
    const result = MetaErrorClassifier.classify(error);
    expect(result).toEqual({ category: 'RATE_LIMITED', isTransient: true });
  });

  it('should return TRANSIENT_ERROR for HTTP 500', () => {
    const error = Object.assign(new Error('Server Error'), { status: 500 });
    const result = MetaErrorClassifier.classify(error);
    expect(result).toEqual({ category: 'TRANSIENT_ERROR', isTransient: true });
  });

  it('should return EXPIRED for code 190 and subcode 463', () => {
    const error = Object.assign(new Error('Expired'), {
      graphErrorCode: 190,
      graphErrorSubcode: 463,
    });
    const result = MetaErrorClassifier.classify(error);
    expect(result).toEqual({ category: 'EXPIRED', isTransient: false });
  });

  it('should return EXPIRED for code 190 and subcode 460', () => {
    const error = Object.assign(new Error('Password changed'), {
      graphErrorCode: 190,
      graphErrorSubcode: 460,
    });
    const result = MetaErrorClassifier.classify(error);
    expect(result).toEqual({ category: 'EXPIRED', isTransient: false });
  });

  it('should return REVOKED for code 190 and subcode 458', () => {
    const error = Object.assign(new Error('App deauthorized'), {
      graphErrorCode: 190,
      graphErrorSubcode: 458,
    });
    const result = MetaErrorClassifier.classify(error);
    expect(result).toEqual({ category: 'REVOKED', isTransient: false });
  });

  it('should return REVOKED for generic code 190', () => {
    const error = Object.assign(new Error('Invalid token'), {
      graphErrorCode: 190,
      graphErrorSubcode: 490,
    });
    const result = MetaErrorClassifier.classify(error);
    expect(result).toEqual({ category: 'REVOKED', isTransient: false });
  });

  it('should return RATE_LIMITED for Graph API rate limit codes', () => {
    const error = Object.assign(new Error('Limit reached'), { graphErrorCode: 613 });
    const result = MetaErrorClassifier.classify(error);
    expect(result).toEqual({ category: 'RATE_LIMITED', isTransient: true });
  });

  it('should return PERMISSION_ERROR for code 10', () => {
    const error = Object.assign(new Error('No permission'), { graphErrorCode: 10 });
    const result = MetaErrorClassifier.classify(error);
    expect(result).toEqual({ category: 'PERMISSION_ERROR', isTransient: false });
  });

  it('should return INVALID_RESPONSE for non-Error object', () => {
    const result = MetaErrorClassifier.classify({ status: 400 });
    expect(result).toEqual({ category: 'INVALID_RESPONSE', isTransient: false });
  });

  it('should return INVALID_RESPONSE for generic HTTP 400 without specific Graph API codes', () => {
    const error = Object.assign(new Error('Bad request'), { status: 400 });
    const result = MetaErrorClassifier.classify(error);
    expect(result).toEqual({ category: 'INVALID_RESPONSE', isTransient: false });
  });
});
