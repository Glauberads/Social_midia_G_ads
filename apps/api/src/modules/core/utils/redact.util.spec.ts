import { redactLog } from './redact.util';

describe('redactLog', () => {
  it('should redact simple keys', () => {
    const log = { authorization: 'Bearer 1234', safe: 'value' };
    expect(redactLog(log)).toEqual({ authorization: '[REDACTED]', safe: 'value' });
  });

  it('should redact array of objects', () => {
    const log = [{ cookie: 'secret' }, { no: 'prob' }];
    expect(redactLog(log)).toEqual([{ cookie: '[REDACTED]' }, { no: 'prob' }]);
  });

  it('should handle circular references', () => {
    const log: any = { password: '123' };
    log.self = log;
    const redacted = redactLog(log);
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.self).toBe('[Circular]');
  });

  it('should redact case insensitive keys', () => {
    const log = { Authorization: 'token', APIKEY: 'secret' };
    expect(redactLog(log)).toEqual({ Authorization: '[REDACTED]', APIKEY: '[REDACTED]' });
  });
});
