// Samlet eftervisning (alle brudformer + interaktion) i ny kerne mod facit for den styrende lastkombination.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseIndstillinger } from './settings';
import { afledStaal } from './steel';
import { partialkoefficienter } from './partials';
import { skalerLast } from './loads';
import { legacyKfi } from './facit-hjaelp';
import { beregnKombination, vaelgArmeringsKant } from './kombination';

const G = JSON.parse(readFileSync(new URL('../../../golden/cases.json', import.meta.url), 'utf8'));
const cases = G.cases.filter((c: any) => c.resultat.tilstand === 'ok');
const norm = (x: number | null) => (x != null && !Number.isFinite(x) ? null : x);
const naer = (a: number | null, b: number | null) => { a = norm(a); b = norm(b); return a == null || b == null ? a === b : Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b)); };

describe('samlet kombination mod facit', () => {
  it.each(cases as any[])('model #$id', (c: any) => {
    const m = c.model;
    const { indstillinger } = parseIndstillinger({ ...m.indstillinger, gamma3: undefined, Ec: null });
    const st = afledStaal({ staalklasse: m.anker.staalklasse, d: m.anker.d, gevind: m.anker.gevind, As: m.anker.As });
    const p = partialkoefficienter(indstillinger, { type: m.anker.type, fuk: st.fuk, fyk: st.fyk, gammaInstIndlimet: m.anker.gammaInst });
    const raa = m.laster[c.resultat.styrendeKombination];
    const lk = skalerLast(raa, legacyKfi(m));
    const alle = m.laster.map((l: any) => ({ last: skalerLast(l, legacyKfi(m)), alphaSus: l.alphaSus ?? m.anker.alphaSus }));
    const valgt = vaelgArmeringsKant(m, st, p, indstillinger, alle, 30000);
    const mm = valgt ? { ...m, beton: { ...m.beton, armering: { ...m.beton.armering, ankerarmeringForskydning: { ...m.beton.armering.ankerarmeringForskydning, kant: valgt.kant } } } } : m;
    const r = beregnKombination(mm, st, p, indstillinger, lk, 30000, raa.alphaSus ?? m.anker.alphaSus);
    for (const w of c.resultat.eftervisninger) {
      const g = r.brudformer.find((b) => b.id === w.id);
      if (!g) { expect(w.relevant, `${w.id} mangler i ny kerne men er relevant i facit`).toBe(false); continue; }
      expect(g.relevant, `${w.id} relevant`).toBe(w.relevant);
      if (!w.relevant) continue;
      const ed = w.NEd ?? w.VEd, rd = w.NRd ?? w.VRd, rk = w.NRk ?? w.VRk;
      if (!/^NV/.test(w.id)) {
        if (ed !== undefined) expect(naer(g.Ed, ed), `${w.id}.Ed ${g.Ed} vs ${ed}`).toBe(true);
        if (rd !== undefined) expect(naer(g.Rd, rd), `${w.id}.Rd ${g.Rd} vs ${rd}`).toBe(true);
        if (rk !== undefined && w.id !== 'N_a' && w.id !== 'V_a') expect(naer(g.Rk, rk), `${w.id}.Rk ${g.Rk} vs ${rk}`).toBe(true);
      }
      expect(naer(g.udnyttelse, w.udnyttelse), `${w.id}.udnyttelse ${g.udnyttelse} vs ${w.udnyttelse}`).toBe(true);
    }
    expect(r.styrendeBrudform, 'styrende brudform').toBe(c.resultat.styrendeBrudform);
    expect(naer(r.maksUdnyttelse, c.resultat.maksUdnyttelse), `maks ${r.maksUdnyttelse} vs ${c.resultat.maksUdnyttelse}`).toBe(true);
  });
});
