// Spaltning (N_sp) i ny kerne mod facit for den styrende lastkombination.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseIndstillinger } from './settings';
import { afledStaal } from './steel';
import { partialkoefficienter } from './partials';
import { fordelTraek, skalerLast } from './loads';
import { fckAf } from './concrete';
import { hovedareal, traekOversigt, udtraekning } from './tension';
import { spaltning } from './splitting';

const G = JSON.parse(readFileSync(new URL('../../../golden/cases.json', import.meta.url), 'utf8'));
const cases = G.cases.filter((c: any) => c.resultat.tilstand === 'ok');
const naer = (a: number | null, b: number | null) => (a == null || b == null ? a === b : Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b)));

describe('spaltning mod facit', () => {
  it.each(cases as any[])('model #$id', (c: any) => {
    const m = c.model;
    const { indstillinger } = parseIndstillinger({ ...m.indstillinger, gamma3: undefined, Ec: null }) /* gammel import: gamma3 fulgte kontrolklassen; Ec var fast */;
    const st = afledStaal({ staalklasse: m.anker.staalklasse, d: m.anker.d, gevind: m.anker.gevind, As: m.anker.As });
    const p = partialkoefficienter(indstillinger, { type: m.anker.type, fuk: st.fuk, fyk: st.fyk, gammaInstIndlimet: m.anker.gammaInst });
    const lastRaa = m.laster[c.resultat.styrendeKombination];
    const lk = skalerLast(lastRaa, p.kfi);
    const f = fordelTraek(m.opstilling.anker, st.As, m.plade, lk, { Es: indstillinger.Es, Ec: 30000 /* facit: gammel kerne med fast Ec */, kanter: m.beton.kanter });
    const t = traekOversigt(m.opstilling.anker, f.F, f);
    const fck = Math.min(fckAf(m.beton), 60);
    const indl = m.anker.type === 'indlimet';
    const NRkp = indl ? undefined : udtraekning({ fck, revnet: m.beton.revnet, ah: hovedareal(m.anker), gammaMp: p.gammaMp }, t).NRk;
    const got = spaltning({
      produkt: { indlimet: indl, ccrSp: m.anker.ccrSp, scrSp: m.anker.scrSp, hmin: m.anker.hmin, d: m.anker.d, d0: m.anker.d0, th: m.anker.th },
      hef: m.anker.hef, h: m.beton.h, cnom: m.beton.cnom, fck, revnet: m.beton.revnet, kanter: m.beton.kanter,
      afskalning: m.beton.armering.afskalning, splitArmering: m.beton.armering.splitArmering,
      kcrN: m.anker.kcrN, kucrN: m.anker.kucrN, tauRkCr: m.anker.tauRkCr, tauRkUcr: m.anker.tauRkUcr, psiC: m.anker.psiC, psi0Sus: m.anker.psi0Sus,
      alphaSus: lastRaa.alphaSus ?? m.anker.alphaSus, NRkp, gammaMsp: p.gammaMsp, gammaMsRe: p.gammaMsRe,
    }, t);
    const w = c.resultat.eftervisninger.find((e: any) => e.id === 'N_sp');
    expect(got.relevant, 'relevant').toBe(w.relevant);
    if (!w.relevant) return;
    for (const k of ['NEd', 'NRd', 'NRk'] as const) expect(naer(got[k], w[k]), `N_sp.${k}: ${got[k]} vs ${w[k]}`).toBe(true);
    expect(naer(got.udnyttelse, w.udnyttelse)).toBe(true);
  });
});
