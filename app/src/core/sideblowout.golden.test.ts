// Udsprængning af sidebeton (N_cb) i ny kerne mod facit.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseIndstillinger } from './settings';
import { afledStaal } from './steel';
import { partialkoefficienter } from './partials';
import { fordelTraek, skalerLast } from './loads';
import { legacyKfi } from './facit-hjaelp';
import { fckAf } from './concrete';
import { hovedareal, traekOversigt } from './tension';
import { sideblowout } from './sideblowout';

const G = JSON.parse(readFileSync(new URL('../../../golden/cases.json', import.meta.url), 'utf8'));
const cases = G.cases.filter((c: any) => c.resultat.tilstand === 'ok' && c.model.anker.type === 'indstoebt');
const naer = (a: number | null, b: number | null) => (a == null || b == null ? a === b : Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b)));

describe('sideblowout mod facit', () => {
  it.each(cases as any[])('model #$id', (c: any) => {
    const m = c.model;
    const { indstillinger } = parseIndstillinger({ ...m.indstillinger, gamma3: undefined, Ec: null });
    const st = afledStaal({ staalklasse: m.anker.staalklasse, d: m.anker.d, gevind: m.anker.gevind, As: m.anker.As });
    const p = partialkoefficienter(indstillinger, { type: m.anker.type, fuk: st.fuk, fyk: st.fyk });
    const lk = skalerLast(m.laster[c.resultat.styrendeKombination], legacyKfi(m));
    const f = fordelTraek(m.opstilling.anker, st.As, m.plade, lk, { Es: indstillinger.Es, Ec: 30000, kanter: m.beton.kanter });
    const t = traekOversigt(m.opstilling.anker, f.F, f);
    const got = sideblowout({ fck: Math.min(fckAf(m.beton), 60), revnet: m.beton.revnet, ah: hovedareal(m.anker), hef: m.anker.hef, h: m.beton.h, kanter: m.beton.kanter, gammaMc: p.gammaMc }, t);
    const w = c.resultat.eftervisninger.find((e: any) => e.id === 'N_cb');
    expect(got.relevant, 'relevant').toBe(w.relevant);
    if (!w.relevant) return;
    for (const k of ['NEd', 'NRd', 'NRk'] as const) expect(naer(got[k], w[k]), `N_cb.${k}: ${got[k]} vs ${w[k]}`).toBe(true);
    expect(naer(got.udnyttelse, w.udnyttelse)).toBe(true);
  });
});
