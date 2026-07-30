import { startWorker } from './index';
describe('Worker', () => {
  it('should start', () => {
    expect(startWorker()).toBe('worker started');
  });
});
