// Forskydningsbrudformer (EN 1992-4, 7.2.2). Rene tal; ingen tekst.
import { betonkegle, psiS, type KegleInput, type KegleResultat } from './cone';
import { klipRect, minKantafstand, type Kanter, type Rect } from './geometry';
import type { Anker } from './loads';
import { udnyttelse } from './tension';

export interface ForskydningsEftervisning {
  id: string;
  relevant: boolean;
  VEd: number; VRd: number; VRk: number;
  udnyttelse: number | null;
  styrendeAnker: number | null;
  aarsag?: 'ingen-forskydning' | 'fuk-over-1000' | 'singulaer' | null;
}

const ikkeRelevant = (id: string, aarsag: ForskydningsEftervisning['aarsag']): ForskydningsEftervisning => ({
  id, relevant: false, VEd: 0, VRd: 0, VRk: 0, udnyttelse: null, styrendeAnker: null, aarsag,
});

/** Løftestang: forskydning med afstand mellem plade og beton (6.2.2.3). */
export function harLoeftestang(plade: { afstandTilBeton: number; mellemlaeg: string }, d: number): { medLoeftestang: boolean; inkonsistent: boolean } {
  const e = plade.afstandTilBeton || 0;
  const inkonsistent = plade.mellemlaeg === 'ingen' && e > 0;
  return { medLoeftestang: (plade.mellemlaeg === 'aaben' && e > 0) || (plade.mellemlaeg === 'moertel' && e > d / 2) || inkonsistent, inkonsistent };
}

export interface StaalForskydningInput {
  ankre: Anker[];
  /** Forskydning pr. anker, og om fordelingen er mulig. */
  V: number[]; mulig: boolean;
  /** Trækkraft pr. anker (til løftestangsreduktion) og NRd,s. */
  F: number[]; NRd_s: number;
  stor: boolean;
  fuk: number; As: number; duktil: boolean; d: number; dnom: number; hef: number; fckRaw: number;
  k7?: number | null; VRksEta?: number | null; M0RksEta?: number | null;
  gammaMsV: number;
  loeftestang: boolean;
  afstandTilBeton: number; pladeT: number; indspaending: string;
}

export interface StaalForskydningResultat extends ForskydningsEftervisning {
  /** VRd,s pr. anker (bruges af interaktion). */
  VRd_i: number[];
  /** Effektiv forskydning pr. anker (Σ|V| ved stor hulfrigang). */
  Veff: number[];
}

/** Stålbrud ved forskydning uden (7.2.2.3.1) og med løftestang (7.2.2.3.2). */
export function staalbrudForskydning(p: StaalForskydningInput): StaalForskydningResultat {
  const sum = p.V.reduce((a, b) => a + b, 0);
  const Veff = p.V.map((v) => (p.stor ? sum : v));
  const c = Veff.reduce((best, v, i) => (v > Veff[best]! ? i : best), 0);
  const u = Veff[c] ?? 0;
  const id = p.ankre[c]?.id ?? null;
  const base = { id: 'V_s', styrendeAnker: id, Veff, VRd_i: p.ankre.map(() => 0) };
  if (!p.mulig) return { ...base, relevant: true, VEd: u, VRd: 0, VRk: 0, udnyttelse: Infinity, aarsag: 'singulaer' };
  if (!(u > 0)) return { ...ikkeRelevant('V_s', 'ingen-forskydning'), Veff, VRd_i: base.VRd_i };
  if (p.fuk > 1000) return { ...ikkeRelevant('V_s', 'fuk-over-1000'), Veff, VRd_i: base.VRd_i };
  if (!p.loeftestang) {
    const k6 = p.fuk <= 500 ? 0.6 : 0.5;
    const V0 = p.VRksEta ?? k6 * p.As * p.fuk;
    const k7 = p.k7 ?? (p.duktil || p.ankre.length === 1 ? 1 : 0.8);
    const dnom = p.dnom;
    const red = p.hef / dnom < 5 && p.fckRaw < 20 ? 0.8 : 1;
    const VRk = red * k7 * V0;
    const VRd = VRk / p.gammaMsV;
    return { ...base, relevant: true, VEd: u, VRd, VRk, udnyttelse: udnyttelse(u, VRd), VRd_i: p.ankre.map(() => VRd), aarsag: null };
  }
  const l = 0.5 * p.d + p.afstandTilBeton + p.pladeT / 2;
  const alphaM = p.indspaending === 'fuld' ? 2 : 1;
  const ds = Math.sqrt((4 * p.As) / Math.PI);
  const Wel = (Math.PI * ds ** 3) / 32;
  const M0 = p.M0RksEta ?? 1.2 * Wel * p.fuk;
  const VRd_i: number[] = [], eta: number[] = [];
  p.ankre.forEach((_a, i) => {
    const Fi = p.F[i]!;
    const MRk = M0 * Math.max(0, 1 - Fi / p.NRd_s);
    VRd_i.push((alphaM * MRk) / l / p.gammaMsV);
    eta.push(Fi >= p.NRd_s ? Infinity : VRd_i[i]! > 0 ? Veff[i]! / VRd_i[i]! : Veff[i]! > 0 ? Infinity : 0);
  });
  const g = eta.reduce((best, v, i) => (v > eta[best]! ? i : best), 0);
  const MRk = M0 * Math.max(0, 1 - p.F[g]! / p.NRd_s);
  const VRk = (alphaM * MRk) / l;
  return { id: 'V_s', relevant: true, VEd: Veff[g]!, VRd: VRd_i[g]!, VRk, udnyttelse: eta[g]!, styrendeAnker: p.ankre[g]!.id, Veff, VRd_i, aarsag: null };
}

// ---------------------------------------------------------------- V_cp

export interface PryoutInput {
  ankre: Anker[]; V: number[]; Vx: number[]; Vy: number[]; mulig: boolean;
  kegle: Omit<KegleInput, 'ankre' | 'e1' | 'e2' | 'momentfaktor'>;
  k8?: number | null; hef: number; indlimet: boolean;
  gammaMcV: number; pryoutEnkeltanker: 'retning' | 'altid';
  /** 0,75 når ankerarmering er virksom. */
  armeringsFaktor?: number;
}

export interface PryoutResultat extends ForskydningsEftervisning { kegle?: KegleResultat; k8?: number; enkeltStyrer?: boolean }

export function pryout(p: PryoutInput): PryoutResultat {
  const base = { id: 'V_cp' };
  if (!p.mulig) return { ...base, relevant: true, VEd: 0, VRd: 0, VRk: 0, udnyttelse: Infinity, styrendeAnker: null, aarsag: 'singulaer' };
  const maks = Math.max(0, ...p.V);
  const idx = p.ankre.map((_, i) => i).filter((i) => p.V[i]! > 0.001 * maks && p.V[i]! > 1);
  if (!idx.length) return { ...ikkeRelevant('V_cp', 'ingen-forskydning') };
  const a = idx.map((i) => p.ankre[i]!), l = idx.map((i) => p.V[i]!);
  const c = l.reduce((s, v) => s + v, 0);
  const xV = a.reduce((s, an, i) => s + l[i]! * an.x, 0) / c, yV = a.reduce((s, an, i) => s + l[i]! * an.y, 0) / c;
  const xG = a.reduce((s, an) => s + an.x, 0) / a.length, yG = a.reduce((s, an) => s + an.y, 0) / a.length;
  const m = Math.abs(xV - xG), b = Math.abs(yV - yG);
  const k8 = p.k8 ?? (p.indlimet ? 2 : p.hef < 60 ? 1 : 2);
  const y = betonkegle({ ...p.kegle, ankre: a, e1: m, e2: b, momentfaktor: null });
  const NRk = y.NRk; // indlimet (kombineret udtræk/betonbrud) tilføjes sammen med indlimede anker
  const kA = p.armeringsFaktor ?? 1;
  const VRk = k8 * NRk * kA;
  const VRd = VRk / p.gammaMcV;
  const etaGruppe = VRd > 0 ? c / VRd : Infinity;
  const Dx = idx.reduce((s, i) => s + p.Vx[i]!, 0), Dy = idx.reduce((s, i) => s + p.Vy[i]!, 0);
  const ensrettet = Math.hypot(Dx, Dy) >= c * (1 - 1e-6);
  const enkelt = a.length > 1 && (p.pryoutEnkeltanker === 'altid' || !ensrettet);
  let G: { an: Anker; VRdi: number; eta: number; V: number } | null = null;
  if (enkelt) {
    const kanter = p.kegle.kanter;
    const areal = (an: Anker, ce: number): number => {
      const h = ce / 2;
      const z: Rect = [an.x - h, an.y - h, an.x + h, an.y + h];
      for (const o of a) {
        if (o === an) continue;
        const dx = o.x - an.x, dy = o.y - an.y;
        if (Math.abs(dx) >= ce || Math.abs(dy) >= ce) continue;
        if (Math.abs(dx) >= Math.abs(dy)) { if (dx > 0) z[2] = Math.min(z[2], an.x + dx / 2); else z[0] = Math.max(z[0], an.x + dx / 2); }
        else if (dy > 0) z[3] = Math.min(z[3], an.y + dy / 2); else z[1] = Math.max(z[1], an.y + dy / 2);
      }
      const q = klipRect(z, kanter);
      return Math.max(0, q[2] - q[0]) * Math.max(0, q[3] - q[1]);
    };
    const skaler = (ce: number, max: number): number[] => {
      const ar = a.map((an) => areal(an, ce)), s = ar.reduce((x, v) => x + v, 0);
      return s > max * (1 + 1e-9) ? ar.map((v) => (v * max) / s) : ar;
    };
    const Ai = skaler(y.scr, y.U.areal);
    a.forEach((an, z) => {
      const ci = minKantafstand([an], kanter);
      const Nri = ((y.N0 * Ai[z]!) / y.A0) * psiS(ci, y.ccr) * y.pRe;
      const VRdi = (k8 * Nri * kA) / p.gammaMcV;
      const eta = VRdi > 0 ? l[z]! / VRdi : Infinity;
      if (!G || eta > G.eta) G = { an, VRdi, eta, V: l[z]! };
    });
  }
  const enkeltStyrer = !!G && (G as { eta: number }).eta > etaGruppe;
  const g = G as { an: Anker; VRdi: number; eta: number; V: number } | null;
  const VEd = enkeltStyrer ? g!.V : c;
  const VRdOut = enkeltStyrer ? g!.VRdi : VRd;
  return {
    ...base, relevant: true, VEd, VRd: VRdOut, VRk: enkeltStyrer ? g!.VRdi * p.gammaMcV : VRk,
    udnyttelse: enkeltStyrer ? g!.eta : etaGruppe, styrendeAnker: enkeltStyrer ? g!.an.id : (a[0]?.id ?? null),
    kegle: y, k8, enkeltStyrer, aarsag: null,
  };
}
