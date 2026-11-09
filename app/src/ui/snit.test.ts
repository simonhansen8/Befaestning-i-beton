import { describe, expect, it } from 'vitest';
import { standardModel } from '../core/indlaes';
import { snitSvg } from './snit';

const m: any = structuredClone(standardModel('2026-01-01'));
describe('snit', () => {
  it('er et svg med målsætning af hef og h, for begge akser', () => {
    for (const a of ['x', 'y'] as const) {
      const s = snitSvg(m, a);
      expect(s.startsWith('<svg')).toBe(true);
      expect(s).toContain(`hef ${m.anker.hef}`);
      expect(s).toContain(`h ${m.beton.h}`);
      expect(s).toContain(`Snit i ${a}-z-planen`);
      expect(s).not.toContain('NaN');
    }
  });
  it('måler kantafstand når der er fri kant', () => {
    const i = structuredClone(m); i.beton.kanter.xNeg = 200;
    expect(snitSvg(i, 'x')).toMatch(/>c \d+</);
  });
});
