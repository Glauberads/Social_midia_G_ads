import { activeEditorialRevision, canDecideEditorial, canEditEditorial } from './editorial-state';

describe('editorial review state', () => {
  it('selects the active draft even when it is not first', () => {
    expect(activeEditorialRevision([{ version: 3, status: 'REJECTED' }, { version: 2, status: 'DRAFT' }])?.version).toBe(2);
  });
  it.each(['READY', 'REJECTED'])('allows manual revisions in %s', (status) => expect(canEditEditorial(status)).toBe(true));
  it.each(['APPROVED', 'GENERATING', 'ARCHIVED'])('blocks manual revisions in %s', (status) => expect(canEditEditorial(status)).toBe(false));
  it('allows decisions only for the active READY draft', () => {
    expect(canDecideEditorial('READY', 'DRAFT')).toBe(true);
    expect(canDecideEditorial('READY', 'REJECTED')).toBe(false);
    expect(canDecideEditorial('APPROVED', 'DRAFT')).toBe(false);
  });
});
