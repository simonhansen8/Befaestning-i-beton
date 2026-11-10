import { describe, expect, it } from 'vitest';
import { danskTid, vurderVersion } from './ajour';

const pr = { number: 1, title: 'x', html_url: 'u' };
describe('ajour-mærkat', () => {
  it('offline', () => { expect(vurderVersion('2026-11-09.8', null).tilstand).toBe('off'); });
  it('ny version', () => { expect(vurderVersion('2026-11-09.8', { seneste: '2026-11-09.9', prs: [], commit: null }).tilstand).toBe('old'); });
  it('PR på vej', () => { const s = vurderVersion('a', { seneste: 'a', prs: [pr], commit: null }); expect(s.tilstand).toBe('pending'); expect(s.etiket).toContain('1 på vej'); });
  it('opdateret', () => { expect(vurderVersion('a', { seneste: 'a', prs: [], commit: null }).tilstand).toBe('ok'); });
  it('PR-liste kunne ikke hentes', () => { const s = vurderVersion('a', { seneste: 'a', prs: null, commit: null }); expect(s.tilstand).toBe('ok'); expect(s.prsUkendt).toBe(true); });
  it('dansk tid', () => { expect(danskTid('2026-11-10T07:45:06Z')).toBe('10.11.2026 kl. 08:45:06'); expect(danskTid('2026-07-10T07:45:06Z')).toBe('10.07.2026 kl. 09:45:06'); expect(danskTid(null)).toBe('ukendt'); });
});
