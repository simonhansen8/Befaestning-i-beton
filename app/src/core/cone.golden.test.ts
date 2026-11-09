// Betonkeglebrud (N_c) i ny kerne mod facit for den styrende lastkombination.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseIndstillinger } from './settings';
import { afledStaal } from './steel';
import { partialkoefficienter } from './partials';
import { fordelTraek, skalerLast } from './loads';
import { legacyKfi } from './facit-hjaelp';
import { fckAf } from './concrete';
import { traekOversigt } from './tension';
import { eftervisBetonkegle } from './cone';
import { minKantafstand } from './geometry';

const G = JSON.parse(readFileSync(new URL('../../../golden/cases.json', import.meta.url), 'utf8'));
const cases = G.cases.filter((c: any) => c.resultat.tilstand === 'ok');
const naer = (a: number | null, b: number | null) => (a == null || b == null ? a === b : Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b)));

describe('betonkegle mod facit', () => {
  it.each(cases as any[])('model #$id', (c: any) => {
    const m = c.model;
    const { indstillinger } = parseIndstillinger({ ...m.indstillinger, gamma3: undefined, Ec: null }) /* gammel import: gamma3 fulgte kontrolklassen; Ec var fast */;
    const st = afledStaal({ staalklasse: m.anker.staalklasse, d: m.anker.d, gevind: m.anker.gevind, As: m.anker.As });
    const p = partialkoefficienter(indstillinger, { type: m.anker.type, fuk: st.fuk, fyk: st.fyk, gammaInstIndlimet: m.anker.gammaInst });
    const lk = skalerLast(m.laster[c.resultat.styrendeKombination], legacyKfi(m));
    const f = fordelTraek(m.opstilling.anker, st.As, m.plade, lk, { Es: indstillinger.Es, Ec: 30000 /* facit: gammel kerne med fast Ec */, kanter: m.beton.kanter });
    const t = traekOversigt(m.opstilling.anker, f.F, f);
    const w = c.resultat.eftervisninger.find((e: any) => e.id === 'N_c');
    const got = eftervisBetonkegle({
      ankre: t.traekAnkre, e1: t.eN1, e2: t.eN2, hef: m.anker.hef, fck: Math.min(fckAf(m.beton), 60),
      revnet: m.beton.revnet, indlimet: m.anker.type === 'indlimet', kcrN: m.anker.kcrN, kucrN: m.anker.kucrN,
      ccrN: m.anker.ccrN, scrN: m.anker.scrN, kanter: m.beton.kanter, afskalning: m.beton.armering.afskalning,
      momentfaktor: { C: f.C, NEd_g: t.NEd_g, z: t.z, cMinAlle: minKantafstand(m.opstilling.anker, m.beton.kanter) },
    }, p.gammaMc, t);
    expect(got.relevant).toBe(w.relevant);
    if (!w.relevant) return; // facit har ingen tal for irrelevante brudformer
    for (const k of ['NEd', 'NRd', 'NRk'] as const) expect(naer(got[k], w[k]), `N_c.${k}: ${got[k]} vs ${w[k]}`).toBe(true);
    expect(naer(got.udnyttelse, w.udnyttelse)).toBe(true);
  });
});
