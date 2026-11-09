// Forskydningsbrud (V_s, V_cp) i ny kerne mod facit for den styrende lastkombination.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseIndstillinger } from './settings';
import { afledStaal } from './steel';
import { partialkoefficienter } from './partials';
import { fordelForskydning, fordelTraek, skalerLast, slidsStivhed } from './loads';
import { legacyKfi } from './facit-hjaelp';
import { fckAf } from './concrete';
import { staalbrudTraek, traekOversigt } from './tension';
import { harLoeftestang, pryout, staalbrudForskydning } from './shear';

const G = JSON.parse(readFileSync(new URL('../../../golden/cases.json', import.meta.url), 'utf8'));
const cases = G.cases.filter((c: any) => c.resultat.tilstand === 'ok');
const naer = (a: number | null, b: number | null) => { const f = (x: number | null) => (x != null && !Number.isFinite(x) ? null : x); a = f(a); b = f(b); return a == null || b == null ? a === b : Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b)); };

function opsaet(c: any) {
  const m = c.model;
  const { indstillinger } = parseIndstillinger({ ...m.indstillinger, gamma3: undefined, Ec: null });
  const st = afledStaal({ staalklasse: m.anker.staalklasse, d: m.anker.d, gevind: m.anker.gevind, As: m.anker.As });
  const p = partialkoefficienter(indstillinger, { type: m.anker.type, fuk: st.fuk, fyk: st.fyk, gammaInstIndlimet: m.anker.gammaInst });
  const lk = skalerLast(m.laster[c.resultat.styrendeKombination], legacyKfi(m));
  const f = fordelTraek(m.opstilling.anker, st.As, m.plade, lk, { Es: indstillinger.Es, Ec: 30000, kanter: m.beton.kanter });
  const t = traekOversigt(m.opstilling.anker, f.F, f);
  const { kx, ky } = slidsStivhed(m.opstilling.anker);
  const v = fordelForskydning(m.opstilling.anker, kx, ky, lk);
  return { m, indstillinger, st, p, f, t, v };
}
const eftervis = (c: any, id: string) => c.resultat.eftervisninger.find((e: any) => e.id === id);
const sammenlign = (id: string, got: any, w: any) => {
  expect(got.relevant, 'relevant').toBe(w.relevant);
  if (!w.relevant) return;
  for (const k of ['VEd', 'VRd', 'VRk'] as const) expect(naer(got[k], w[k]), `${id}.${k}: ${got[k]} vs ${w[k]}`).toBe(true);
  expect(naer(got.udnyttelse, w.udnyttelse), `${id}.udnyttelse: ${got.udnyttelse} vs ${w.udnyttelse}`).toBe(true);
};

describe('V_s mod facit', () => {
  it.each(cases as any[])('model #$id', (c: any) => {
    const { m, st, p, f, t, v } = opsaet(c);
    const N_s = staalbrudTraek({ As: st.As, fuk: st.fuk, NRksEta: m.anker.NRksEta, gammaMs: p.gammaMs }, t);
    const lof = harLoeftestang(m.plade, m.anker.d);
    const got = staalbrudForskydning({
      ankre: m.opstilling.anker, V: v.V, mulig: v.mulig, F: f.F, NRd_s: N_s.NRd, stor: m.plade.hulfrigang === 'stor',
      fuk: st.fuk, As: st.As, duktil: st.duktil, d: m.anker.d, dnom: m.anker.dnom ?? m.anker.d, hef: m.anker.hef, fckRaw: fckAf(m.beton),
      k7: m.anker.k7, VRksEta: m.anker.VRksEta, M0RksEta: m.anker.M0RksEta, gammaMsV: p.gammaMsV,
      loeftestang: lof.medLoeftestang, afstandTilBeton: m.plade.afstandTilBeton || 0, pladeT: m.plade.t, indspaending: m.plade.indspaending,
    });
    sammenlign('V_s', got, eftervis(c, 'V_s'));
  });
});

describe('V_cp mod facit', () => {
  const cp = cases.filter((c: any) => c.model.anker.type === 'indstoebt' && !c.model.beton.armering.ankerarmeringForskydning.aktiv && !c.model.beton.armering.ankerarmeringTraek.aktiv);
  it.each(cp as any[])('model #$id', (c: any) => {
    const { m, indstillinger, p, v } = opsaet(c);
    const got = pryout({
      ankre: m.opstilling.anker, V: v.V, Vx: v.Vx, Vy: v.Vy, mulig: v.mulig, k8: m.anker.k8, hef: m.anker.hef, indlimet: false,
      kegle: { hef: m.anker.hef, fck: Math.min(fckAf(m.beton), 60), revnet: m.beton.revnet, indlimet: false, kanter: m.beton.kanter, afskalning: m.beton.armering.afskalning },
      gammaMcV: p.gammaMcV, pryoutEnkeltanker: indstillinger.pryoutEnkeltanker,
    });
    sammenlign('V_cp', got, eftervis(c, 'V_cp'));
  });
});

import { kantbrud } from './edgebreakout';

describe('V_c mod facit', () => {
  const vc = cases.filter((c: any) => !c.model.beton.armering.ankerarmeringForskydning.aktiv);
  it.each(vc as any[])('model #$id', (c: any) => {
    const { m, indstillinger, p, v } = opsaet(c);
    const ar = m.beton.armering;
    const lk = skalerLast(m.laster[c.resultat.styrendeKombination], legacyKfi(m));
    const got = kantbrud({
      ankre: m.opstilling.anker, kanter: m.beton.kanter, fck: Math.min(fckAf(m.beton), 60), revnet: m.beton.revnet, hef: m.anker.hef,
      dnom: m.anker.dnom ?? m.anker.d, h: m.beton.h, last: lk, fordeling: v, stor: m.plade.hulfrigang === 'stor',
      forresteRaekkeTol: indstillinger.forresteRaekkeTol, gammaMcV: p.gammaMcV, cnom: m.beton.cnom,
      kantarmering: ar.kantarmering, kantarmeringAfstand: ar.kantarmeringAfstand, kantarmeringDiameter: ar.kantarmeringDiameter,
    });
    sammenlign('V_c', got, eftervis(c, 'V_c'));
  });
});
