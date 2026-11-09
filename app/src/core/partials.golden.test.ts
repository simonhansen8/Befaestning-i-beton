// Sammenligner ny kerne (indstillinger, stål, partialkoefficienter) med facit fra den gamle kerne.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseIndstillinger } from './settings';
import { afledStaal } from './steel';
import { partialkoefficienter } from './partials';

const G = JSON.parse(readFileSync(new URL('../../../golden/cases.json', import.meta.url), 'utf8'));

describe('partialkoefficienter mod facit', () => {
  const cases = G.cases.filter((c: any) => c.resultat.tilstand === 'ok');
  it('har beregnede facit-modeller', () => expect(cases.length).toBeGreaterThan(100));
  it.each(cases as any[])('model #$id', (c: any) => {
    const m = c.model, { indstillinger } = parseIndstillinger({ ...m.indstillinger, gamma3: undefined, Ec: null }) /* gammel import: gamma3 fulgte kontrolklassen; Ec var fast */;
    const st = afledStaal({ staalklasse: m.anker.staalklasse, d: m.anker.d, gevind: m.anker.gevind, As: m.anker.As });
    expect(st.fuk).toBe(m.anker.fuk); expect(st.fyk).toBe(m.anker.fyk); expect(st.As).toBeCloseTo(m.anker.As, 9);
    const p = partialkoefficienter(indstillinger, { type: m.anker.type, fuk: st.fuk, fyk: st.fyk, gammaInstIndlimet: m.anker.gammaInst });
    for (const [k, v] of Object.entries(c.resultat.partialkoefficienter as Record<string, number | boolean>)) {
      const got = (p as any)[k];
      typeof v === 'number' ? expect(got).toBeCloseTo(v, 12) : expect(got).toBe(v);
    }
  });
});
