// Stålbrud (N_s) og udtrækning (N_p, indstøbt) i ny kerne mod facit – for den styrende lastkombination.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseIndstillinger } from './settings';
import { afledStaal } from './steel';
import { partialkoefficienter } from './partials';
import { fordelTraek, skalerLast } from './loads';
import { fckAf } from './concrete';
import { hovedareal, staalbrudTraek, traekOversigt, udtraekning } from './tension';

const G = JSON.parse(readFileSync(new URL('../../../golden/cases.json', import.meta.url), 'utf8'));
const cases = G.cases.filter((c: any) => c.resultat.tilstand === 'ok');
const naer = (a: number | null, b: number | null) => (a == null || b == null ? a === b : Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b)));

describe('trækbrud mod facit', () => {
  it.each(cases as any[])('model #$id', (c: any) => {
    const m = c.model;
    const { indstillinger } = parseIndstillinger(m.indstillinger);
    const st = afledStaal({ staalklasse: m.anker.staalklasse, d: m.anker.d, gevind: m.anker.gevind, As: m.anker.As });
    const p = partialkoefficienter(indstillinger, { type: m.anker.type, fuk: st.fuk, fyk: st.fyk, gammaInstIndlimet: m.anker.gammaInst });
    const lk = skalerLast(m.laster[c.resultat.styrendeKombination], p.kfi);
    const f = fordelTraek(m.opstilling.anker, st.As, m.plade, lk, { Es: indstillinger.Es, Ec: indstillinger.Ec, kanter: m.beton.kanter });
    const t = traekOversigt(m.opstilling.anker, f.F, f);
    const sammenlign = (id: string, got: any) => {
      const w = c.resultat.eftervisninger.find((e: any) => e.id === id);
      expect(got.relevant, `${id} relevant`).toBe(w.relevant);
      for (const k of ['NEd', 'NRd', 'NRk'] as const) expect(naer(got[k], w[k]), `${id}.${k}: ${got[k]} vs ${w[k]}`).toBe(true);
      expect(naer(got.udnyttelse, w.udnyttelse), `${id}.udnyttelse`).toBe(true);
      expect(got.styrendeAnker).toBe(w.styrendeAnker);
    };
    sammenlign('N_s', staalbrudTraek({ As: st.As, fuk: st.fuk, NRksEta: m.anker.NRksEta, gammaMs: p.gammaMs }, t));
    if (m.anker.type === 'indstoebt') {
      const fck = Math.min(fckAf(m.beton), 60);
      sammenlign('N_p', udtraekning({ fck, revnet: m.beton.revnet, ah: hovedareal(m.anker), gammaMp: p.gammaMp }, t));
    }
  });
});
