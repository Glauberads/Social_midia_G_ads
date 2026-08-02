import { canSubmitGeneration, generationEndpoint, shouldPollGeneration } from './generation-state';

describe('generation UI state', () => {
  it.each(['DRAFT', 'REJECTED', 'FAILED'])('enables action for %s', (status) => expect(canSubmitGeneration(status)).toBe(true));
  it.each(['SUBMITTED', 'GENERATING', 'READY', 'ARCHIVED'])('disables action for %s', (status) => expect(canSubmitGeneration(status)).toBe(false));
  it('polls only while queued or processing', () => {
    expect(shouldPollGeneration('SUBMITTED')).toBe(true);
    expect(shouldPollGeneration('GENERATING')).toBe(true);
    expect(shouldPollGeneration('READY')).toBe(false);
    expect(shouldPollGeneration('FAILED')).toBe(false);
  });
  it('uses the explicit retry endpoint after failure', () => {
    expect(generationEndpoint('abc', 'FAILED')).toBe('/content-requests/abc/retry');
    expect(generationEndpoint('abc', 'DRAFT')).toBe('/content-requests/abc/submit');
  });
});
