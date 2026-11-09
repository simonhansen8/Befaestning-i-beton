// Udsprængning af sidebeton (blow-out), EN 1992-4, 7.2.1.8. Kun indstøbte anker. Rene tal.
import { intervalUnion, koordLangsKant, kantafstand, KANTER, udstraekningLangsKant, type Kanter, type KantNavn, type Pkt } from './geometry';
import { psiEc, psiS } from './cone';
import { udnyttelse, type Eftervisning, type TraekOversigt } from './tension';

export const K5 = { cr: 8.7, ucr: 12.2 } as const;

export interface SideblowoutInput {
  fck: number; revnet: boolean;
  /** Lastoverførende hovedareal Ah. */
  ah: number; hef: number; h: number; kanter: Partial<Kanter>;
  gammaMc: number;
}

export interface SideblowoutGruppe {
  kant: KantNavn; c1: number; ankre: Pkt[]; n: number; s2: number;
  N0: number; A0: number; Ac: number; Lb: number; Hb: number; c2: number;
  pS: number; pG: number; pEc: number; eN: number; NRk: number; NRd: number; NEd: number; u: number;
}

export type SideblowoutAarsag = 'ingen-traek' | 'ingen-frie-kanter' | 'ikke-relevant' | null;

export function sideblowout(p: SideblowoutInput, t: TraekOversigt): Eftervisning & { aarsag: SideblowoutAarsag; styrende?: SideblowoutGruppe; styrendeAnkerIds?: number[] } {
  const base = { id: 'N_cb', NEd: 0, NRd: 0, NRk: 0, udnyttelse: null as number | null, styrendeAnker: null as number | null };
  if (!(t.NEd_g > 0)) return { ...base, relevant: false, aarsag: 'ingen-traek' };
  const frie = KANTER.filter((k) => p.kanter[k] != null);
  if (!frie.length) return { ...base, relevant: false, aarsag: 'ingen-frie-kanter' };
  const k5 = p.revnet ? K5.cr : K5.ucr;
  const kraft = (a: (typeof t.traekAnkre)[number]) => t.kraefter[t.traekAnkre.indexOf(a)]!;
  let bedst: (SideblowoutGruppe & { ids: number[] }) | null = null;
  for (const kant of frie) {
    const taet = t.traekAnkre.filter((a) => kantafstand(a, p.kanter, kant) <= 0.5 * p.hef);
    if (!taet.length) continue;
    const c1 = Math.min(...taet.map((a) => kantafstand(a, p.kanter, kant)));
    const sorteret = [...taet].sort((a, b) => koordLangsKant(a, kant) - koordLangsKant(b, kant));
    const grupper: (typeof sorteret)[] = [];
    for (const a of sorteret) {
      const g = grupper[grupper.length - 1];
      if (g && koordLangsKant(a, kant) - koordLangsKant(g[g.length - 1]!, kant) <= 4 * c1) g.push(a);
      else grupper.push([a]);
    }
    const [lo, hi] = udstraekningLangsKant(kant, p.kanter);
    for (const g of grupper) {
      const T = g.map((a) => koordLangsKant(a, kant));
      const n = g.length;
      let s2 = 0;
      for (let i = 1; i < n; i++) s2 = Math.max(s2, T[i]! - T[i - 1]!);
      const N0 = k5 * c1 * Math.sqrt(p.ah) * Math.sqrt(p.fck);
      const A0 = (4 * c1) ** 2;
      const iv = intervalUnion(T, 2 * c1, lo, hi);
      const Hb = 2 * c1 + Math.min(2 * c1, Math.max(0, p.h - p.hef));
      const Ac = iv.laengde * Hb;
      const c2 = Math.min(Math.min(...T) - lo, hi - Math.max(...T));
      const pS = psiS(c2, 2 * c1);
      const pG = Math.max(1, Math.sqrt(n) + ((1 - Math.sqrt(n)) * s2) / (4 * c1));
      const F = g.map(kraft);
      const NEd = F.reduce((s, v) => s + v, 0);
      const cx = g.reduce((s, _a, i) => s + F[i]! * T[i]!, 0) / NEd;
      const eN = Math.abs(cx - T.reduce((s, v) => s + v, 0) / n);
      const pEc = psiEc(eN, 4 * c1);
      const NRk = c1 > 0 ? ((N0 * Ac) / A0) * pS * pG * pEc : 0;
      const NRd = NRk / p.gammaMc;
      const u = NRd > 0 ? NEd / NRd : Infinity;
      if (!bedst || u > bedst.u) bedst = { kant, c1, ankre: g, n, s2, N0, A0, Ac, Lb: iv.laengde, Hb, c2, pS, pG, pEc, eN, NRk, NRd, NEd, u, ids: g.map((a) => (a as unknown as { id: number }).id) };
    }
  }
  if (!bedst) return { ...base, relevant: false, aarsag: 'ikke-relevant' };
  return {
    id: 'N_cb', relevant: true, NEd: bedst.NEd, NRd: bedst.NRd, NRk: bedst.NRk, udnyttelse: udnyttelse(bedst.NEd, bedst.NRd),
    styrendeAnker: bedst.ids[0] ?? null, aarsag: null, styrende: bedst, styrendeAnkerIds: bedst.ids,
  };
}
