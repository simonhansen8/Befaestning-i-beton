// Samlet eftervisning af én lastkombination: alle brudformer og interaktion. Rene tal; ingen tekst.
import { eftervisBond } from './bond';
import { eftervisBetonkegle } from './cone';
import { fckAf } from './concrete';
import { kantbrud, type KantbrudResultat } from './edgebreakout';
import { interaktionBeton, interaktionStaal, type ArmeringsTilfaelde } from './interaction';
import { fordelForskydning, fordelTraek, slidsStivhed, type Anker, type ForskydningsFordeling, type Last, type TraekFordeling } from './loads';
import { minKantafstand, type Kanter, type KantNavn } from './geometry';
import type { Partialkoefficienter } from './partials';
import {
  armeringForskydningVirkning, armeringTraekVirkning, armeringsKant, eftervisForskydningsArmering, eftervisTraekArmering, vaelgArmKant,
  type ArmeringT, type ArmeringV, type ForskydningsArmering, type TraekArmering,
} from './reinforcement';
import { sideblowout } from './sideblowout';
import { harLoeftestang, pryout, staalbrudForskydning } from './shear';
import type { Indstillinger } from './settings';
import { spaltning } from './splitting';
import type { AnkerStaal } from './steel';
import { hovedareal, staalbrudTraek, traekOversigt, udtraekning, type TraekOversigt } from './tension';

export interface KernemodelAnker {
  type: 'indstoebt' | 'indlimet'; d: number; dnom?: number | null; hef: number;
  dh: number; th: number; hovedForm?: 'rund' | 'firkant'; hovedSide?: number | null;
  NRksEta?: number | null; VRksEta?: number | null; M0RksEta?: number | null; k7?: number | null; k8?: number | null; k11: number;
  tauRkCr: number | null; tauRkUcr: number | null; psiC: number; psi0Sus: number; alphaSus: number;
  kcrN: number | null; kucrN: number | null; ccrN: number | null; scrN: number | null; ccrSp: number | null; scrSp: number | null;
  hmin: number | null; d0: number;
}
export interface KernemodelBeton {
  klasse?: string | null; fck?: number | null; revnet: boolean; h: number; cnom: number; kanter: Partial<Kanter>;
  armering: {
    afskalning: string; kantarmering: string; kantarmeringAfstand: number | null; kantarmeringDiameter: number | null; splitArmering: boolean;
    ankerarmeringTraek: TraekArmering; ankerarmeringForskydning: ForskydningsArmering;
  };
}
export interface Kernemodel {
  beton: KernemodelBeton; anker: KernemodelAnker;
  plade: { bx: number; by: number; t: number; hulfrigang: string; afstandTilBeton?: number; mellemlaeg: string; indspaending: string };
  opstilling: { anker: Anker[] };
}

/** Ensartet resultat for én brudform. Ed/Rd/Rk er last/kapacitet i N. */
export interface Brudform {
  id: string; relevant: boolean; Ed: number; Rd: number; Rk: number; udnyttelse: number | null;
  styrendeAnker: number | number[] | null;
}

export interface KombinationsResultat {
  brudformer: Brudform[];
  maksUdnyttelse: number; styrendeBrudform: string | null;
  fordeling: TraekFordeling; traek: TraekOversigt; forskydning: ForskydningsFordeling;
  armT: ArmeringT; armV: ArmeringV; tilfaelde: ArmeringsTilfaelde; kantbrud: KantbrudResultat;
  /** Hvorfor spaltning/stålbrud er irrelevant (til diagnostik). */
  spaltningAarsag: string | null; staalForskydningAarsag: string | null; loeftestang: boolean;
  /** Valgt armeringskant (forreste række) og om forskydningsarmeringen dækker en kant. */
  armKant: { kant: KantNavn } | null;
}

const trad = (b: { id: string; relevant: boolean; udnyttelse: number | null; styrendeAnker: number | number[] | null }, Ed: number, Rd: number, Rk: number): Brudform =>
  ({ id: b.id, relevant: b.relevant, Ed, Rd, Rk, udnyttelse: b.udnyttelse, styrendeAnker: b.styrendeAnker });
const fraTraek = (e: { id: string; relevant: boolean; NEd: number; NRd: number; NRk: number; udnyttelse: number | null; styrendeAnker: number | number[] | null }) =>
  trad(e, e.NEd, e.NRd, e.NRk);

export function beregnKombination(
  m: Kernemodel, st: AnkerStaal, p: Partialkoefficienter, ind: Indstillinger, lk: Last, Ec: number, alphaSus: number,
): KombinationsResultat {
  const ankre = m.opstilling.anker, ar = m.beton.armering;
  const indl = m.anker.type === 'indlimet';
  const fckRaa = fckAf(m.beton), fck = Math.min(fckRaa, 60);
  const stor = m.plade.hulfrigang === 'stor';
  const f = fordelTraek(ankre, st.As, m.plade, lk, { Es: ind.Es, Ec, kanter: m.beton.kanter });
  const t = traekOversigt(ankre, f.F, f);
  const { kx, ky } = slidsStivhed(ankre);
  const v = fordelForskydning(ankre, kx, ky, lk);
  const cMinAlle = minKantafstand(ankre, m.beton.kanter);
  const armT = armeringTraekVirkning(ar.ankerarmeringTraek, m.anker.hef, m.anker.d);
  const out: Brudform[] = [];

  // ---- træk
  const N_s = staalbrudTraek({ As: st.As, fuk: st.fuk, NRksEta: m.anker.NRksEta, gammaMs: p.gammaMs }, t);
  out.push(fraTraek(N_s));
  const kegle = { hef: m.anker.hef, fck, revnet: m.beton.revnet, indlimet: indl, kcrN: m.anker.kcrN, kucrN: m.anker.kucrN, ccrN: m.anker.ccrN, scrN: m.anker.scrN, kanter: m.beton.kanter, afskalning: ar.afskalning };
  const bondProdukt = { d: m.anker.d, tauRkCr: m.anker.tauRkCr, tauRkUcr: m.anker.tauRkUcr, psiC: m.anker.psiC, kcrN: m.anker.kcrN, kucrN: m.anker.kucrN };
  const N_p = indl
    ? eftervisBond({ produkt: bondProdukt, hef: m.anker.hef, fck, revnet: m.beton.revnet, kanter: m.beton.kanter, afskalning: ar.afskalning, alphaSus, psi0Sus: m.anker.psi0Sus, gammaMp: p.gammaMp }, t)
    : udtraekning({ fck, revnet: m.beton.revnet, ah: hovedareal(m.anker), gammaMp: p.gammaMp }, t);
  out.push(fraTraek(N_p));
  const N_c = eftervisBetonkegle({ ...kegle, ankre: t.traekAnkre, e1: t.eN1, e2: t.eN2, momentfaktor: { C: f.C, NEd_g: t.NEd_g, z: t.z, cMinAlle } }, p.gammaMc, t, armT.virksom);
  out.push(fraTraek(N_c));
  const N_sp = spaltning({
    produkt: { indlimet: indl, ccrSp: m.anker.ccrSp, scrSp: m.anker.scrSp, hmin: m.anker.hmin, d: m.anker.d, d0: m.anker.d0, th: m.anker.th },
    hef: m.anker.hef, h: m.beton.h, cnom: m.beton.cnom, fck, revnet: m.beton.revnet, kanter: m.beton.kanter, afskalning: ar.afskalning, splitArmering: ar.splitArmering,
    kcrN: m.anker.kcrN, kucrN: m.anker.kucrN, tauRkCr: m.anker.tauRkCr, tauRkUcr: m.anker.tauRkUcr, psiC: m.anker.psiC, psi0Sus: m.anker.psi0Sus,
    alphaSus, NRkp: indl ? undefined : (N_p as { NRk: number }).NRk, gammaMsp: p.gammaMsp, gammaMsRe: p.gammaMsRe,
  }, t);
  out.push(fraTraek(N_sp));
  const N_cb = indl ? { id: 'N_cb', relevant: false, NEd: 0, NRd: 0, NRk: 0, udnyttelse: null, styrendeAnker: null }
    : sideblowout({ fck, revnet: m.beton.revnet, ah: hovedareal(m.anker), hef: m.anker.hef, h: m.beton.h, kanter: m.beton.kanter, gammaMc: p.gammaMc }, t);
  out.push(fraTraek(N_cb));
  const tr = eftervisTraekArmering({
    ar: ar.ankerarmeringTraek, virkning: armT, hef: m.anker.hef, fck, gammaMsRe: p.gammaMsRe, gammaMc: p.gammaMc, gammaCt: p.gammaCt, alphaCt: p.alphaCt, kegle,
  }, t);
  if (armT.aktiv) out.push(fraTraek(tr.N_re), fraTraek(tr.N_a), fraTraek(tr.N_cre));

  // ---- forskydning
  const lof = harLoeftestang(m.plade, m.anker.d);
  const V_s = staalbrudForskydning({
    ankre, V: v.V, mulig: v.mulig, F: f.F, NRd_s: N_s.NRd, stor, fuk: st.fuk, As: st.As, duktil: st.duktil, d: m.anker.d, dnom: m.anker.dnom ?? m.anker.d,
    hef: m.anker.hef, fckRaw: fckRaa, k7: m.anker.k7, VRksEta: m.anker.VRksEta, M0RksEta: m.anker.M0RksEta, gammaMsV: p.gammaMsV,
    loeftestang: lof.medLoeftestang, afstandTilBeton: m.plade.afstandTilBeton || 0, pladeT: m.plade.t, indspaending: m.plade.indspaending,
  });
  out.push(trad(V_s, V_s.VEd, V_s.VRd, V_s.VRk));

  const kantInput = {
    ankre, kanter: m.beton.kanter, fck, revnet: m.beton.revnet, hef: m.anker.hef, dnom: m.anker.dnom ?? m.anker.d, h: m.beton.h, last: lk, fordeling: v, stor,
    forresteRaekkeTol: ind.forresteRaekkeTol, gammaMcV: p.gammaMcV, cnom: m.beton.cnom,
    kantarmering: ar.kantarmering, kantarmeringAfstand: ar.kantarmeringAfstand, kantarmeringDiameter: ar.kantarmeringDiameter,
  };
  let V_c = kantbrud(kantInput);
  const forste = V_c;
  const armKant = vaelgArmKant(ar.ankerarmeringForskydning, forste.kanterPr, forste.forreste, forste.styrende?.kant ?? null);
  const armV = armeringForskydningVirkning({
    ar: ar.ankerarmeringForskydning, h: m.beton.h, cnom: m.beton.cnom, ankerD: m.anker.d, ankre, kanter: m.beton.kanter, forresteRaekkeTol: ind.forresteRaekkeTol, armKant,
  });
  if (armV.virksom && armKant) V_c = kantbrud({ ...kantInput, daekket: { kant: armKant.kant, ids: armKant.ankre } });

  const V_cp = pryout({
    ankre, V: v.V, Vx: v.Vx, Vy: v.Vy, mulig: v.mulig, k8: m.anker.k8, hef: m.anker.hef, indlimet: indl, bond: indl ? { produkt: bondProdukt } : undefined,
    kegle, gammaMcV: p.gammaMcV, pryoutEnkeltanker: ind.pryoutEnkeltanker, armeringsFaktor: armV.virksom || armT.virksom ? 0.75 : 1,
  });
  out.push(trad(V_cp, V_cp.VEd, V_cp.VRd, V_cp.VRk));
  out.push({ id: 'V_c', relevant: V_c.relevant, Ed: V_c.VEd, Rd: V_c.VRd, Rk: V_c.VRk, udnyttelse: V_c.udnyttelse, styrendeAnker: V_c.styrendeAnker });
  if (armV.aktiv) {
    if (armV.virksom && armKant) {
      const r = eftervisForskydningsArmering({
        ar: ar.ankerarmeringForskydning, virkning: armV, armKant, kantKandidat: forste.kanterPr[armKant.kant], pladeAfstandTilBeton: m.plade.afstandTilBeton || 0, pladeT: m.plade.t,
        h: m.beton.h, cnom: m.beton.cnom, hef: m.anker.hef, fck, gammaMsRe: p.gammaMsRe, gammaCt: p.gammaCt, alphaCt: p.alphaCt, fordeling: v, ankre,
      });
      out.push(fraTraek(r.V_re), fraTraek(r.V_a));
    }
  }

  // ---- interaktion
  const undtag = ind.staalInteraktionVedLoeftestang === 'undtag' && lof.medLoeftestang;
  const NV_s = interaktionStaal({ ankreIds: ankre.map((a) => a.id), F: f.F, Veff: V_s.Veff, VRd_i: V_s.VRd_i, NRd_s: N_s.NRd });
  out.push({ id: 'NV_s', relevant: undtag ? false : NV_s.relevant, Ed: 0, Rd: 0, Rk: 0, udnyttelse: undtag ? null : NV_s.udnyttelse, styrendeAnker: NV_s.styrendeAnker });
  const tilfaelde: ArmeringsTilfaelde = armT.virksom && armV.virksom ? 'begge' : armT.virksom ? 'traek' : armV.virksom ? 'forskydning' : 'ingen';
  const NV = interaktionBeton(out.map((b) => ({ id: b.id, relevant: b.relevant, udnyttelse: b.udnyttelse })), tilfaelde, ind.interaktion, m.anker.k11);
  out.push({ id: NV.id, relevant: NV.relevant, Ed: 0, Rd: 0, Rk: 0, udnyttelse: NV.udnyttelse, styrendeAnker: null });

  let maks = 0, styrende: string | null = null;
  for (const b of out) {
    if (!b.relevant) continue;
    const u = b.udnyttelse == null || Number.isNaN(b.udnyttelse) ? Infinity : b.udnyttelse;
    if (u > maks || (styrende == null && u >= maks)) { maks = u; styrende = b.id; }
  }
  return { brudformer: out, maksUdnyttelse: maks, styrendeBrudform: styrende, fordeling: f, traek: t, forskydning: v, armT, armV, tilfaelde, kantbrud: forste, spaltningAarsag: N_sp.aarsag, staalForskydningAarsag: V_s.aarsag ?? null, loeftestang: lof.medLoeftestang, armKant: armKant ? { kant: armKant.kant } : null };
}

/**
 * Forskydningsarmeringens kant (7.2.2.6) vælges ÉN gang for alle lastkombinationer: den mest udnyttede kant
 * for betonkantbrud uden armering. Kanten gælder derefter i alle kombinationer (som den gamle kerne gør).
 */
export function vaelgArmeringsKant(
  m: Kernemodel, st: AnkerStaal, p: Partialkoefficienter, ind: Indstillinger, kombinationer: { last: Last; alphaSus: number }[], Ec: number,
): { kant: KantNavn; udnyttelse: number; kombinationIndex: number } | null {
  const a = m.beton.armering.ankerarmeringForskydning;
  if (!a.aktiv || a.kant) return null;
  const uden: Kernemodel = { ...m, beton: { ...m.beton, armering: { ...m.beton.armering, ankerarmeringForskydning: { ...a, aktiv: false } } } };
  let bedst: { kant: KantNavn; udnyttelse: number; kombinationIndex: number } | null = null;
  kombinationer.forEach((k, i) => {
    let r: KombinationsResultat;
    try { r = beregnKombination(uden, st, p, ind, k.last, Ec, k.alphaSus); } catch { return; }
    for (const e of r.kantbrud.kanterOversigt) {
      if (e.udnyttelse != null && (!bedst || e.udnyttelse > bedst.udnyttelse)) bedst = { kant: e.kant, udnyttelse: e.udnyttelse, kombinationIndex: i };
    }
  });
  return bedst;
}
