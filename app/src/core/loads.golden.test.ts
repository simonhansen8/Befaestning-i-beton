// Lastfordeling i ny kerne mod facit fra den gamle kerne (ankerkræfter, trykzone, forskydning pr. lastkombination).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseIndstillinger } from './settings';
import { afledStaal } from './steel';
import { partialkoefficienter } from './partials';
import { fordelForskydning, fordelTraek, skalerLast, slidsStivhed } from './loads';
import { legacyKfi } from './facit-hjaelp';

const G = JSON.parse(readFileSync(new URL('../../../golden/cases.json', import.meta.url), 'utf8'));
const cases = G.cases.filter((c: any) => c.resultat.tilstand === 'ok' && c.resultat.kombinationer);

const rel = (a: number, b: number, tol: number, scale: number) => Math.abs(a - b) <= tol * Math.max(scale, 1);

describe('lastfordeling mod facit', () => {
  it('har facit med kombinationer', () => expect(cases.length).toBeGreaterThan(100));
  it.each(cases as any[])('model #$id', (c: any) => {
    const m = c.model;
    const { indstillinger } = parseIndstillinger({ ...m.indstillinger, gamma3: undefined, Ec: null }) /* gammel import: gamma3 fulgte kontrolklassen; Ec var fast */;
    const st = afledStaal({ staalklasse: m.anker.staalklasse, d: m.anker.d, gevind: m.anker.gevind, As: m.anker.As });
    const p = partialkoefficienter(indstillinger, { type: m.anker.type, fuk: st.fuk, fyk: st.fyk, gammaInstIndlimet: m.anker.gammaInst });
    c.resultat.kombinationer.forEach((k: any, i: number) => {
      const lk = skalerLast(m.laster[i], legacyKfi(m));
      const f = fordelTraek(m.opstilling.anker, st.As, m.plade, lk, { Es: indstillinger.Es, Ec: 30000 /* facit: gammel kerne med fast Ec */, kanter: m.beton.kanter });
      const { kx, ky } = slidsStivhed(m.opstilling.anker);
      const v = fordelForskydning(m.opstilling.anker, kx, ky, lk);
      const skala = Math.abs(lk.N) + Math.abs(lk.Vx) + Math.abs(lk.Vy) + 1;
      k.ankerkraefter.forEach((a: any, j: number) => {
        expect(rel(f.F[j]!, a.N, 1e-7, skala), `N anker ${a.id}: ${f.F[j]} vs ${a.N}`).toBe(true);
        expect(rel(v.Vx[j]!, a.Vx, 1e-7, skala), `Vx anker ${a.id}`).toBe(true);
        expect(rel(v.Vy[j]!, a.Vy, 1e-7, skala), `Vy anker ${a.id}`).toBe(true);
      });
      expect(rel(f.C, k.trykzone.C, 1e-6, skala), `C ${f.C} vs ${k.trykzone.C}`).toBe(true);
      expect(f.konvergeret).toBe(k.fordeling.konvergeret);
    });
  });
});
