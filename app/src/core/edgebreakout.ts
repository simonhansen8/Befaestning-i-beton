// Betonkantbrud ved forskydning (EN 1992-4, 7.2.2.5). Rene tal; ingen tekst.
import { intervalUnion, kantafstand, koordLangsKant, udstraekningLangsKant, type Interval, type KantNavn, type Kanter } from './geometry';
import { fordelForskydning, type Anker, type ForskydningsFordeling, type Last } from './loads';

export const K9 = { cr: 1.7, ucr: 2.4 } as const;

export interface Kantdef { kant: KantNavn; n: [number, number]; t: [number, number]; akse: 'x' | 'y' }
export const KANTDEF: readonly Kantdef[] = [
  { kant: 'xNeg', n: [-1, 0], t: [0, 1], akse: 'x' },
  { kant: 'xPos', n: [1, 0], t: [0, 1], akse: 'x' },
  { kant: 'yNeg', n: [0, -1], t: [1, 0], akse: 'y' },
  { kant: 'yPos', n: [0, 1], t: [1, 0], akse: 'y' },
];

export interface KantGeometri {
  c1: number; c1org?: number; smal: boolean; c2a: number; c2b: number; s2max: number; lf: number; k9: number; alpha: number; beta: number;
  V0: number; A0: number; Ac: number; Lv: number; Hv: number; pS: number; pH: number; iv: Interval;
}

export interface KantInput {
  ankre: (Anker & { slids?: 'x' | 'y' | null })[];
  kanter: Partial<Kanter>;
  fck: number; revnet: boolean; hef: number; dnom: number; h: number;
  last: Last;
  /** Forskydningsfordeling for alle ankre (til 0,8-reduktionen ved to ankre og torsion). */
  fordeling: ForskydningsFordeling;
  stor: boolean; forresteRaekkeTol: number; gammaMcV: number; cnom: number;
  kantarmering: string; kantarmeringAfstand: number | null; kantarmeringDiameter: number | null;
  /** Kant dækket af ankerarmering for forskydning (7.2.2.6): række udelades. */
  daekket?: { kant: KantNavn; ids: number[] } | null;
}

export interface KantKandidat {
  kant: KantNavn; akse: 'x' | 'y'; ankre: number[]; dist: ForskydningsFordeling;
  Vperp: number; Vpar: number; VEd: number; alphaV: number; eV: number;
  R: KantGeometri; psiEc: number; psiA: number; psiRe: number; f08: number;
  VRk: number; VRd: number; udnyttelse: number; c1: number; bagerste: boolean; stor: boolean;
}

export interface ForresteRaekke { kant: KantNavn; ankre: number[]; c1: number; R: KantGeometri; dist: ForskydningsFordeling }

export interface KantbrudResultat {
  relevant: boolean;
  aarsag: 'ingen-forskydning' | 'ingen-frie-kanter' | 'ingen-kant-belastet' | 'alle-kanter-for-fjerne' | 'daekket' | null;
  VEd: number; VRd: number; VRk: number; udnyttelse: number | null; styrendeAnker: number[] | null;
  styrende: KantKandidat | null;
  kanterPr: Partial<Record<KantNavn, KantKandidat>>;
  forreste: Partial<Record<KantNavn, ForresteRaekke>>;
  daekkede: KantKandidat[];
  /** Kanter der er sprunget over fordi c1 ≥ max(10 hef; 60 dnom). */
  forFjerne: KantNavn[];
  /** Én post pr. kant (til resultatvisning). */
  kanterOversigt: { kant: KantNavn; ankre: number[]; c1: number; VEd: number; VRk: number; VRd: number; udnyttelse: number; alphaV: number; bagerste: boolean }[];
}

/** V0, Ac,V, ψs,V, ψh,V for en række ankre ved en kant (7.2.2.5). */
export function kantGeometri(p: { kanter: Partial<Kanter>; fck: number; revnet: boolean; hef: number; dnom: number; h: number }, kant: KantNavn, row: Anker[], c1org: number): KantGeometri {
  const [lo, hi] = udstraekningLangsKant(kant, p.kanter);
  const T = row.map((a) => koordLangsKant(a, kant));
  const c2a = Math.min(...T) - lo, c2b = hi - Math.max(...T);
  const s2max = T.length > 1 ? Math.max(...T) - Math.min(...T) : 0;
  let c1 = c1org, smal = false;
  if (c2a < 1.5 * c1org && c2b < 1.5 * c1org && p.h < 1.5 * c1org) {
    c1 = Math.max(Math.max(c2a, c2b) / 1.5, p.h / 1.5, s2max / 3);
    smal = c1 < c1org;
    if (!smal) c1 = c1org;
  }
  const lf = p.dnom <= 24 ? Math.min(p.hef, 12 * p.dnom) : Math.min(p.hef, Math.max(8 * p.dnom, 300));
  const k9 = p.revnet ? K9.cr : K9.ucr;
  if (!(c1 > 0)) return { c1, smal, c2a, c2b, s2max, lf, k9, alpha: 0, beta: 0, V0: 0, A0: 0, Ac: 0, Lv: 0, Hv: 0, pS: 1, pH: 1, iv: { fra: 0, til: 0, segmenter: [], laengde: 0 } };
  const alpha = 0.1 * Math.sqrt(lf / c1), beta = 0.1 * (p.dnom / c1) ** 0.2;
  const V0 = k9 * p.dnom ** alpha * lf ** beta * Math.sqrt(p.fck) * c1 ** 1.5;
  const A0 = 4.5 * c1 * c1;
  const iv = intervalUnion(T, 1.5 * c1, lo, hi);
  const Hv = Math.min(1.5 * c1, p.h);
  const Ac = iv.laengde * Hv;
  const pS = Math.min(1, 0.7 + (0.3 * Math.min(c2a, c2b)) / (1.5 * c1));
  const pH = Math.max(1, Math.sqrt((1.5 * c1) / p.h));
  return { c1, c1org, smal, c2a, c2b, s2max, lf, k9, alpha, beta, V0, A0, Ac, Lv: iv.laengde, Hv, pS, pH, iv };
}

export function kantbrud(p: KantInput): KantbrudResultat {
  const { last, ankre } = p;
  const lasttal = Math.abs(last.Vx) + Math.abs(last.Vy) + Math.abs(last.T);
  const frie = KANTDEF.filter((d) => p.kanter[d.kant] != null);
  const tomt = (aarsag: KantbrudResultat['aarsag']): KantbrudResultat => ({ relevant: false, aarsag, VEd: 0, VRd: 0, VRk: 0, udnyttelse: null, styrendeAnker: null, styrende: null, kanterPr: {}, forreste: {}, daekkede: [], forFjerne: [], kanterOversigt: [] });
  if (!(lasttal > 1e-6)) return tomt('ingen-forskydning');
  if (!frie.length) return tomt('ingen-frie-kanter');
  const afstand = Math.max(10 * p.hef, 60 * p.dnom);
  const skala = Math.abs(last.Vx) + Math.abs(last.Vy) + Math.abs(last.T) / 100 + 1;
  const kanterPr: KantbrudResultat['kanterPr'] = {};
  const forreste: KantbrudResultat['forreste'] = {};
  const forFjerne: KantNavn[] = [];
  const daekkede: KantKandidat[] = [];
  const dd = p.daekket ? new Set(p.daekket.ids) : null;
  const geo = { kanter: p.kanter, fck: p.fck, revnet: p.revnet, hef: p.hef, dnom: p.dnom, h: p.h };
  const idx = (a: Anker) => ankre.indexOf(a as never);

  const kandidat = (D: Kantdef, row: Anker[], dist: ForskydningsFordeling, Vperp: number, Vpar: number, eV: number, bagerste: boolean): KantKandidat => {
    const Jv = Math.hypot(Vperp, Vpar);
    const aV = Vperp > 0 ? Math.atan2(Vpar, Vperp) : Math.PI / 2;
    const c1 = Math.min(...row.map((a) => kantafstand(a, p.kanter, D.kant)));
    const R = kantGeometri(geo, D.kant, row, c1);
    const psiEcV = R.c1 > 0 ? 1 / (1 + (2 * eV) / (3 * R.c1)) : 1;
    const psiA = Math.max(1, Math.sqrt(1 / (Math.cos(aV) ** 2 + (0.5 * Math.sin(aV)) ** 2)));
    const psiRe =
      p.revnet && p.kantarmering === 'boejler' && p.hef >= 2.5 * p.cnom && p.kantarmeringAfstand != null && p.kantarmeringDiameter != null &&
      p.kantarmeringAfstand <= 100 && p.kantarmeringAfstand <= 2 * R.c1 && p.kantarmeringDiameter >= 12 ? 1.4 : 1;
    let f08 = 1;
    if (ankre.length === 2 && Math.abs(last.T) > 1e-6) {
      const Y = ankre.map((_a, i) => p.fordeling.Vx[i]! * D.n[0] + p.fordeling.Vy[i]! * D.n[1]);
      if (Y[0]! * Y[1]! < 0) f08 = 0.8;
    }
    const VRk = R.A0 > 0 ? ((R.V0 * R.Ac) / R.A0) * R.pS * R.pH * psiEcV * psiA * psiRe * f08 : 0;
    const VRd = VRk / p.gammaMcV;
    const u = dist.mulig && VRd > 0 ? Jv / VRd : Infinity;
    return { kant: D.kant, akse: D.akse, ankre: row.map((a) => a.id), dist, Vperp, Vpar, VEd: Jv, alphaV: aV, eV, R, psiEc: psiEcV, psiA, psiRe, f08, VRk, VRd, udnyttelse: u, c1, bagerste, stor: false };
  };
  const registrer = (k: KantKandidat) => {
    if (dd && k.kant === p.daekket!.kant && k.ankre.every((id) => dd.has(id))) { daekkede.push(k); return; }
    const cur = kanterPr[k.kant];
    if (!cur || k.udnyttelse > cur.udnyttelse) kanterPr[k.kant] = k;
  };
  const stivheder = (D: Kantdef, rowSet: Set<Anker>) => ({
    kx: ankre.map((q) => (q.slids === 'x' ? 0 : rowSet.has(q) ? 1 : p.stor || D.akse === 'x' ? 0 : 1)),
    ky: ankre.map((q) => (q.slids === 'y' ? 0 : rowSet.has(q) ? 1 : p.stor || D.akse === 'y' ? 0 : 1)),
  });

  for (const D of frie) {
    const ne = ankre.filter((a) => a.slids !== D.akse);
    if (!ne.length) continue;
    const afst = (a: Anker) => kantafstand(a, p.kanter, D.kant);
    const U = Math.min(...ne.map(afst));
    if (U >= afstand) { forFjerne.push(D.kant); continue; }
    const tol = Math.max(1, p.forresteRaekkeTol * U);
    const rows: Anker[][] = [];
    for (const a of [...ne].sort((x, y) => afst(x) - afst(y))) {
      const sidste = rows[rows.length - 1];
      if (sidste && afst(a) <= afst(sidste[0]!) + tol) sidste.push(a); else rows.push([a]);
    }
    if (!p.daekket) {
      const O = rows[0]!;
      const { kx, ky } = stivheder(D, new Set(O));
      const J = Math.min(...O.map(afst));
      forreste[D.kant] = { kant: D.kant, ankre: O.map((a) => a.id), c1: J, R: kantGeometri(geo, D.kant, O, J), dist: fordelForskydning(ankre, kx, ky, last) };
    }
    const Z = p.stor ? rows : [rows[0]!];
    for (const O of Z) {
      const { kx, ky } = stivheder(D, new Set(O));
      const z = fordelForskydning(ankre, kx, ky, last);
      let Q = 0, par = 0, moment = 0;
      for (const a of O) {
        const i = idx(a);
        const vn = z.Vx[i]! * D.n[0] + z.Vy[i]! * D.n[1];
        if (vn > 0) { Q += vn; moment += vn * koordLangsKant(a, D.kant); }
        par += z.Vx[i]! * D.t[0] + z.Vy[i]! * D.t[1];
      }
      par = Math.abs(par);
      if (!(z.mulig && Math.hypot(Q, par) < 1e-6 * skala)) {
        const mid = O.reduce((s, a) => s + koordLangsKant(a, D.kant), 0) / O.length;
        const eV = Q > 0 ? Math.abs(moment / Q - mid) : 0;
        const k = kandidat(D, O, z, Q, par, eV, false);
        k.stor = p.stor && rows.length > 1;
        registrer(k);
      }
      if (!p.stor) {
        for (const bag of rows.slice(1)) {
          let pv = 0;
          for (const a of bag) { const i = idx(a); pv += z.Vx[i]! * D.t[0] + z.Vy[i]! * D.t[1]; }
          pv = Math.abs(pv);
          if (pv > 1e-6 * skala) { const k = kandidat(D, bag, z, 0, pv, 0, true); k.stor = false; registrer(k); }
        }
      }
    }
  }
  let styrende: KantKandidat | null = null;
  for (const k of Object.values(kanterPr)) if (!styrende || k.udnyttelse > styrende.udnyttelse) styrende = k;
  const kanterOversigt = Object.values(kanterPr).map((k) => ({ kant: k.kant, ankre: k.ankre, c1: k.R.c1, VEd: k.VEd, VRk: k.VRk, VRd: k.VRd, udnyttelse: k.udnyttelse, alphaV: (k.alphaV * 180) / Math.PI, bagerste: k.bagerste }));
  const rest = { kanterPr, forreste, daekkede, forFjerne, kanterOversigt };
  if (!styrende) {
    return { relevant: false, aarsag: p.daekket ? 'daekket' : forFjerne.length === frie.length ? 'alle-kanter-for-fjerne' : 'ingen-kant-belastet', VEd: 0, VRd: 0, VRk: 0, udnyttelse: null, styrendeAnker: null, styrende: null, ...rest };
  }
  return { relevant: true, aarsag: null, VEd: styrende.VEd, VRd: styrende.VRd, VRk: styrende.VRk, udnyttelse: styrende.udnyttelse, styrendeAnker: styrende.ankre, styrende, ...rest };
}
