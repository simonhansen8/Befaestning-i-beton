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

const bondFelter = (m: any) => ({ indlimet: m.anker.type === 'indlimet', kcrN: m.anker.kcrN, kucrN: m.anker.kucrN, ccrN: m.anker.ccrN, scrN: m.anker.scrN });
const bondProdukt = (m: any) => (m.anker.type === 'indlimet' ? { produkt: { d: m.anker.d, tauRkCr: m.anker.tauRkCr, tauRkUcr: m.anker.tauRkUcr, psiC: m.anker.psiC, kcrN: m.anker.kcrN, kucrN: m.anker.kucrN } } : undefined);

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
  const cp = cases.filter((c: any) => !c.model.beton.armering.ankerarmeringForskydning.aktiv && !c.model.beton.armering.ankerarmeringTraek.aktiv);
  it.each(cp as any[])('model #$id', (c: any) => {
    const { m, indstillinger, p, v } = opsaet(c);
    const got = pryout({
      ankre: m.opstilling.anker, V: v.V, Vx: v.Vx, Vy: v.Vy, mulig: v.mulig, k8: m.anker.k8, hef: m.anker.hef, indlimet: m.anker.type === 'indlimet', bond: bondProdukt(m),
      kegle: { hef: m.anker.hef, fck: Math.min(fckAf(m.beton), 60), revnet: m.beton.revnet, ...bondFelter(m), kanter: m.beton.kanter, afskalning: m.beton.armering.afskalning },
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

import { hovedareal, udtraekning } from './tension';
import { spaltning } from './splitting';
import { eftervisBond } from './bond';
import { sideblowout } from './sideblowout';
import { eftervisBetonkegle } from './cone';
import { minKantafstand } from './geometry';
import { interaktionBeton, interaktionStaal } from './interaction';

describe('NV_s og NV_c mod facit (uden ankerarmering)', () => {
  const nv = cases.filter((c: any) => !c.model.beton.armering.ankerarmeringForskydning.aktiv && !c.model.beton.armering.ankerarmeringTraek.aktiv);
  it.each(nv as any[])('model #$id', (c: any) => {
    const { m, indstillinger, st, p, f, t, v } = opsaet(c);
    const lk = skalerLast(m.laster[c.resultat.styrendeKombination], legacyKfi(m));
    const fck = Math.min(fckAf(m.beton), 60);
    const ar = m.beton.armering;
    const N_s = staalbrudTraek({ As: st.As, fuk: st.fuk, NRksEta: m.anker.NRksEta, gammaMs: p.gammaMs }, t);
    const lof = harLoeftestang(m.plade, m.anker.d);
    const Vs = staalbrudForskydning({
      ankre: m.opstilling.anker, V: v.V, mulig: v.mulig, F: f.F, NRd_s: N_s.NRd, stor: m.plade.hulfrigang === 'stor',
      fuk: st.fuk, As: st.As, duktil: st.duktil, d: m.anker.d, dnom: m.anker.dnom ?? m.anker.d, hef: m.anker.hef, fckRaw: fckAf(m.beton),
      k7: m.anker.k7, VRksEta: m.anker.VRksEta, M0RksEta: m.anker.M0RksEta, gammaMsV: p.gammaMsV,
      loeftestang: lof.medLoeftestang, afstandTilBeton: m.plade.afstandTilBeton || 0, pladeT: m.plade.t, indspaending: m.plade.indspaending,
    });
    const indl = m.anker.type === 'indlimet';
    const lastRaa0 = m.laster[c.resultat.styrendeKombination];
    const Np = indl
      ? eftervisBond({ produkt: bondProdukt(m)!.produkt, hef: m.anker.hef, fck, revnet: m.beton.revnet, kanter: m.beton.kanter, afskalning: ar.afskalning, alphaSus: lastRaa0.alphaSus ?? m.anker.alphaSus, psi0Sus: m.anker.psi0Sus, gammaMp: p.gammaMp }, t)
      : udtraekning({ fck, revnet: m.beton.revnet, ah: hovedareal(m.anker), gammaMp: p.gammaMp }, t);
    const Nc = eftervisBetonkegle({
      ankre: t.traekAnkre, e1: t.eN1, e2: t.eN2, hef: m.anker.hef, fck, revnet: m.beton.revnet, ...bondFelter(m), kanter: m.beton.kanter, afskalning: ar.afskalning,
      momentfaktor: { C: f.C, NEd_g: t.NEd_g, z: t.z, cMinAlle: minKantafstand(m.opstilling.anker, m.beton.kanter) },
    }, p.gammaMc, t);
    const lastRaa = m.laster[c.resultat.styrendeKombination];
    const Nsp = spaltning({
      produkt: { indlimet: indl, ccrSp: m.anker.ccrSp, scrSp: m.anker.scrSp, hmin: m.anker.hmin, d: m.anker.d, d0: m.anker.d0, th: m.anker.th },
      hef: m.anker.hef, h: m.beton.h, cnom: m.beton.cnom, fck, revnet: m.beton.revnet, kanter: m.beton.kanter, afskalning: ar.afskalning, splitArmering: ar.splitArmering,
      kcrN: m.anker.kcrN, kucrN: m.anker.kucrN, tauRkCr: m.anker.tauRkCr, tauRkUcr: m.anker.tauRkUcr, psiC: m.anker.psiC, psi0Sus: m.anker.psi0Sus,
      alphaSus: lastRaa.alphaSus ?? m.anker.alphaSus, NRkp: Np.NRk, gammaMsp: p.gammaMsp, gammaMsRe: p.gammaMsRe,
    }, t);
    const wNp = eftervis(c, 'N_p');
    expect(Np.relevant, 'N_p relevant').toBe(wNp.relevant);
    if (wNp.relevant) for (const k of ['NEd', 'NRd', 'NRk'] as const) expect(naer((Np as any)[k], wNp[k]), `N_p.${k}: ${(Np as any)[k]} vs ${wNp[k]}`).toBe(true);
    const Ncb = indl ? { id: 'N_cb', relevant: false, udnyttelse: null as number | null } : sideblowout({ fck, revnet: m.beton.revnet, ah: hovedareal(m.anker), hef: m.anker.hef, h: m.beton.h, kanter: m.beton.kanter, gammaMc: p.gammaMc }, t);
    const Vcp = pryout({
      ankre: m.opstilling.anker, V: v.V, Vx: v.Vx, Vy: v.Vy, mulig: v.mulig, k8: m.anker.k8, hef: m.anker.hef, indlimet: m.anker.type === 'indlimet', bond: bondProdukt(m),
      kegle: { hef: m.anker.hef, fck, revnet: m.beton.revnet, ...bondFelter(m), kanter: m.beton.kanter, afskalning: ar.afskalning },
      gammaMcV: p.gammaMcV, pryoutEnkeltanker: indstillinger.pryoutEnkeltanker,
    });
    const Vc = kantbrud({
      ankre: m.opstilling.anker, kanter: m.beton.kanter, fck, revnet: m.beton.revnet, hef: m.anker.hef, dnom: m.anker.dnom ?? m.anker.d, h: m.beton.h, last: lk, fordeling: v,
      stor: m.plade.hulfrigang === 'stor', forresteRaekkeTol: indstillinger.forresteRaekkeTol, gammaMcV: p.gammaMcV, cnom: m.beton.cnom,
      kantarmering: ar.kantarmering, kantarmeringAfstand: ar.kantarmeringAfstand, kantarmeringDiameter: ar.kantarmeringDiameter,
    });
    const poster = [Np, Nc, Nsp, Ncb, Vcp, { id: 'V_c', relevant: Vc.relevant, udnyttelse: Vc.udnyttelse }];
    const bet = interaktionBeton(poster, 'ingen', indstillinger.interaktion, m.anker.k11);
    sammenlign('NV_c', { relevant: bet.relevant, VEd: 0, VRd: 0, VRk: 0, udnyttelse: bet.udnyttelse }, { ...eftervis(c, 'NV_c'), VEd: 0, VRd: 0, VRk: 0 });
    const s = interaktionStaal({ ankreIds: m.opstilling.anker.map((a: any) => a.id), F: f.F, Veff: Vs.Veff, VRd_i: Vs.VRd_i, NRd_s: N_s.NRd });
    const undtag = indstillinger.staalInteraktionVedLoeftestang === 'undtag' && lof.medLoeftestang;
    const wS = eftervis(c, 'NV_s');
    expect(undtag ? false : s.relevant, 'NV_s relevant').toBe(wS.relevant);
    if (wS.relevant) expect(naer(s.udnyttelse, wS.udnyttelse), `NV_s ${s.udnyttelse} vs ${wS.udnyttelse}`).toBe(true);
  });
});
