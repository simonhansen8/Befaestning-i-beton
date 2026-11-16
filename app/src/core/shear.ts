// Forskydningsbrudformer (EN 1992-4, 7.2.2). Rene tal; ingen tekst.
import { betonkegle, psiS, type KegleInput, type KegleResultat } from './cone';
import { bondKapacitet, type BondProdukt } from './bond';
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
export function harLoeftestang(plade: { afstandTilBeton?: number; mellemlaeg: string }, d: number): { medLoeftestang: boolean; inkonsistent: boolean } {
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
  afstandTilBeton: number; pladeT: number; lastHoejde?: number | null; indspaending: string;
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
  const iMaks = Veff.reduce((best, v, i) => (v > Veff[best]! ? i : best), 0);
  const VEdMaks = Veff[iMaks] ?? 0;
  const id = p.ankre[iMaks]?.id ?? null;
  const base = { id: 'V_s', styrendeAnker: id, Veff, VRd_i: p.ankre.map(() => 0) };
  if (!p.mulig) return { ...base, relevant: true, VEd: VEdMaks, VRd: 0, VRk: 0, udnyttelse: Infinity, aarsag: 'singulaer' };
  if (!(VEdMaks > 0)) return { ...ikkeRelevant('V_s', 'ingen-forskydning'), Veff, VRd_i: base.VRd_i };
  if (p.fuk > 1000) return { ...ikkeRelevant('V_s', 'fuk-over-1000'), Veff, VRd_i: base.VRd_i };
  if (!p.loeftestang) {
    const k6 = p.fuk <= 500 ? 0.6 : 0.5;
    const V0 = p.VRksEta ?? k6 * p.As * p.fuk;
    const k7 = p.k7 ?? (p.duktil || p.ankre.length === 1 ? 1 : 0.8);
    const dnom = p.dnom;
    const red = p.hef / dnom < 5 && p.fckRaw < 20 ? 0.8 : 1;
    const VRk = red * k7 * V0;
    const VRd = VRk / p.gammaMsV;
    return { ...base, relevant: true, VEd: VEdMaks, VRd, VRk, udnyttelse: udnyttelse(VEdMaks, VRd), VRd_i: p.ankre.map(() => VRd), aarsag: null };
  }
  // e1: afstand fra betonoverflade til forskydningskraftens linje; standard: midt i pladen (e + t/2)
  const armLaengde = 0.5 * p.d + (p.lastHoejde ?? p.afstandTilBeton + p.pladeT / 2);
  const alphaM = p.indspaending === 'fuld' ? 2 : 1;
  const ds = Math.sqrt((4 * p.As) / Math.PI);
  const Wel = (Math.PI * ds ** 3) / 32;
  const M0 = p.M0RksEta ?? 1.2 * Wel * p.fuk;
  const VRd_i: number[] = [], eta: number[] = [];
  p.ankre.forEach((_a, i) => {
    const Fi = p.F[i]!;
    const MRk = M0 * Math.max(0, 1 - Fi / p.NRd_s);
    VRd_i.push((alphaM * MRk) / armLaengde / p.gammaMsV);
    eta.push(Fi >= p.NRd_s ? Infinity : VRd_i[i]! > 0 ? Veff[i]! / VRd_i[i]! : Veff[i]! > 0 ? Infinity : 0);
  });
  const iStyr = eta.reduce((best, v, i) => (v > eta[best]! ? i : best), 0);
  const MRk = M0 * Math.max(0, 1 - p.F[iStyr]! / p.NRd_s);
  const VRk = (alphaM * MRk) / armLaengde;
  return { id: 'V_s', relevant: true, VEd: Veff[iStyr]!, VRd: VRd_i[iStyr]!, VRk, udnyttelse: eta[iStyr]!, styrendeAnker: p.ankre[iStyr]!.id, Veff, VRd_i, aarsag: null };
}

// ---------------------------------------------------------------- V_cp

export interface PryoutInput {
  ankre: Anker[]; V: number[]; Vx: number[]; Vy: number[]; mulig: boolean;
  kegle: Omit<KegleInput, 'ankre' | 'e1' | 'e2' | 'momentfaktor'>;
  k8?: number | null; hef: number; indlimet: boolean;
  gammaMcV: number; pryoutEnkeltanker: 'retning' | 'altid';
  /** Kun indlimede anker: kombineret udtræk/betonbrud (ψsus = 1) begrænser også pry-out. */
  bond?: { produkt: BondProdukt };
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
  const ankreV = idx.map((i) => p.ankre[i]!), vAnker = idx.map((i) => p.V[i]!);
  const vSum = vAnker.reduce((s, v) => s + v, 0);
  const xV = ankreV.reduce((s, an, i) => s + vAnker[i]! * an.x, 0) / vSum, yV = ankreV.reduce((s, an, i) => s + vAnker[i]! * an.y, 0) / vSum;
  const xG = ankreV.reduce((s, an) => s + an.x, 0) / ankreV.length, yG = ankreV.reduce((s, an) => s + an.y, 0) / ankreV.length;
  const eV1 = Math.abs(xV - xG), eV2 = Math.abs(yV - yG);
  const k8 = p.k8 ?? (p.indlimet ? 2 : p.hef < 60 ? 1 : 2);
  const kegle = betonkegle({ ...p.kegle, ankre: ankreV, e1: eV1, e2: eV2, momentfaktor: null });
  const bond = p.bond ? bondKapacitet({ produkt: p.bond.produkt, hef: p.hef, fck: p.kegle.fck, revnet: p.kegle.revnet, kanter: p.kegle.kanter, afskalning: p.kegle.afskalning }, ankreV, eV1, eV2, 1) : null;
  const NRk = bond ? Math.min(kegle.NRk, bond.NRk) : kegle.NRk;
  const armFaktor = p.armeringsFaktor ?? 1;
  const VRk = k8 * NRk * armFaktor;
  const VRd = VRk / p.gammaMcV;
  const etaGruppe = VRd > 0 ? vSum / VRd : Infinity;
  const sumVx = idx.reduce((s, i) => s + p.Vx[i]!, 0), sumVy = idx.reduce((s, i) => s + p.Vy[i]!, 0);
  const ensrettet = Math.hypot(sumVx, sumVy) >= vSum * (1 - 1e-6);
  const kontrollerEnkelt = ankreV.length > 1 && (p.pryoutEnkeltanker === 'altid' || !ensrettet);
  let enkelt: { an: Anker; VRdi: number; eta: number; V: number } | null = null;
  if (kontrollerEnkelt) {
    const kanter = p.kegle.kanter;
    const areal = (an: Anker, ce: number): number => {
      const halv = ce / 2;
      const felt: Rect = [an.x - halv, an.y - halv, an.x + halv, an.y + halv];
      for (const anden of ankreV) {
        if (anden === an) continue;
        const dx = anden.x - an.x, dy = anden.y - an.y;
        if (Math.abs(dx) >= ce || Math.abs(dy) >= ce) continue;
        if (Math.abs(dx) >= Math.abs(dy)) { if (dx > 0) felt[2] = Math.min(felt[2], an.x + dx / 2); else felt[0] = Math.max(felt[0], an.x + dx / 2); }
        else if (dy > 0) felt[3] = Math.min(felt[3], an.y + dy / 2); else felt[1] = Math.max(felt[1], an.y + dy / 2);
      }
      const klippet = klipRect(felt, kanter);
      return Math.max(0, klippet[2] - klippet[0]) * Math.max(0, klippet[3] - klippet[1]);
    };
    const skaler = (ce: number, max: number): number[] => {
      const arealer = ankreV.map((an) => areal(an, ce)), s = arealer.reduce((x, v) => x + v, 0);
      return s > max * (1 + 1e-9) ? arealer.map((v) => (v * max) / s) : arealer;
    };
    const arealKegle = skaler(kegle.scr, kegle.U.areal);
    const arealBond = bond ? skaler(bond.scr, bond.U.areal) : null;
    ankreV.forEach((an, j) => {
      const cAnker = minKantafstand([an], kanter);
      let NRkAnker = ((kegle.N0 * arealKegle[j]!) / kegle.A0) * psiS(cAnker, kegle.ccr) * kegle.pRe;
      if (bond) NRkAnker = Math.min(NRkAnker, ((bond.N0 * arealBond![j]!) / bond.A0) * psiS(cAnker, bond.ccr) * bond.pRe);
      const VRdi = (k8 * NRkAnker * armFaktor) / p.gammaMcV;
      const eta = VRdi > 0 ? vAnker[j]! / VRdi : Infinity;
      if (!enkelt || eta > enkelt.eta) enkelt = { an, VRdi, eta, V: vAnker[j]! };
    });
  }
  const enkeltStyrer = !!enkelt && (enkelt as { eta: number }).eta > etaGruppe;
  const enkeltRes = enkelt as { an: Anker; VRdi: number; eta: number; V: number } | null;
  const VEd = enkeltStyrer ? enkeltRes!.V : vSum;
  const VRdOut = enkeltStyrer ? enkeltRes!.VRdi : VRd;
  return {
    ...base, relevant: true, VEd, VRd: VRdOut, VRk: enkeltStyrer ? enkeltRes!.VRdi * p.gammaMcV : VRk,
    udnyttelse: enkeltStyrer ? enkeltRes!.eta : etaGruppe, styrendeAnker: enkeltStyrer ? enkeltRes!.an.id : (ankreV[0]?.id ?? null),
    kegle, k8, enkeltStyrer, aarsag: null,
  };
}
