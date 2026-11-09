// Indlimede anker: kombineret udtrækning og betonbrud (EN 1992-4, 7.2.1.6). Rene tal; ingen tekst.
import { kantafstand, KANTER, projiceretAreal, type Kanter, type Pkt, type RectUnion } from './geometry';
import { psiEc, psiRe, psiS } from './cone';
import { udnyttelse, type Eftervisning, type TraekOversigt } from './tension';

/** ψsus (7.2.1.6): reduktion ved langtidslast. */
export const psiSusBond = (alphaSus: number, psi0Sus: number): number => (alphaSus <= psi0Sus ? 1 : psi0Sus + 1 - alphaSus);

export interface BondProdukt {
  d: number; tauRkCr: number | null; tauRkUcr: number | null; psiC: number; kcrN: number | null; kucrN: number | null;
}

export interface BondInput {
  produkt: BondProdukt; hef: number; fck: number; revnet: boolean; kanter: Partial<Kanter>; afskalning: string;
}

export interface BondResultat {
  tau: number; N0: number; scr: number; scrUbegr: number; ccr: number; A0: number; U: RectUnion; k3: number; tauRkc: number;
  n: number; psi0g: number; s: number; pG: number; c: number; pS: number; pRe: number; pEc: number; NRk: number; psiSus: number;
}

/** Middel af nærmeste-nabo-afstande (Zu). */
function middelNabo(ankre: Pkt[]): number {
  if (ankre.length < 2) return 0;
  const e = ankre.map((a) => Math.min(...ankre.filter((b) => b !== a).map((b) => Math.hypot(a.x - b.x, a.y - b.y))));
  return e.reduce((s, v) => s + v, 0) / e.length;
}

/** NRk,p for en gruppe indlimede anker med excentriciteter e1, e2 og ψsus. */
export function bondKapacitet(p: BondInput, ankre: Pkt[], e1: number, e2: number, psiSus: number): BondResultat {
  const { hef, produkt: pr } = p;
  const d = pr.d;
  const tau = ((p.revnet ? pr.tauRkCr : pr.tauRkUcr) ?? NaN) * pr.psiC;
  const N0 = psiSus * tau * Math.PI * d * hef;
  const scrUbegr = pr.tauRkUcr != null ? 7.3 * d * Math.sqrt(psiSus * pr.tauRkUcr) : Infinity;
  const scr = Math.min(scrUbegr, 3 * hef);
  const ccr = scr / 2, A0 = scr * scr;
  const U = projiceretAreal(ankre, scr, p.kanter);
  const k3 = ((p.revnet ? pr.kcrN : pr.kucrN) ?? NaN);
  const tauRkc = (k3 / (Math.PI * d)) * Math.sqrt(hef * p.fck);
  const n = ankre.length;
  const psi0g = Math.max(1, Math.sqrt(n) - (Math.sqrt(n) - 1) * (tau / tauRkc) ** 1.5);
  const s = middelNabo(ankre);
  const pG = n >= 2 ? Math.max(1, psi0g - Math.sqrt(Math.min(s, scr) / scr) * (psi0g - 1)) : 1;
  const c = Math.min(...ankre.flatMap((a) => KANTER.map((k) => kantafstand(a, p.kanter, k))));
  const pS = psiS(c, ccr), pRe = psiRe(hef, p.afskalning), pEc = psiEc(e1, scr) * psiEc(e2, scr);
  const NRk = ((N0 * U.areal) / A0) * pG * pS * pRe * pEc;
  return { tau, N0, scr, scrUbegr, ccr, A0, U, k3, tauRkc, n, psi0g, s, pG, c, pS, pRe, pEc, NRk, psiSus };
}

/** N_p for indlimede anker: NRd,p = NRk,p / γMp, med ψsus fra langtidslastandelen. */
export function eftervisBond(p: BondInput & { alphaSus: number; psi0Sus: number; gammaMp: number }, t: TraekOversigt): Eftervisning & { mellem?: BondResultat; styrendeAnkerIds?: number[] } {
  if (!(t.NEd_g > 0)) return { id: 'N_p', relevant: false, NEd: 0, NRd: 0, NRk: 0, udnyttelse: null, styrendeAnker: null };
  const r = bondKapacitet(p, t.traekAnkre, t.eN1, t.eN2, psiSusBond(p.alphaSus, p.psi0Sus));
  const NRd = r.NRk / p.gammaMp;
  const ids = t.traekAnkre.map((a) => (a as unknown as { id: number }).id);
  return { id: 'N_p', relevant: true, NEd: t.NEd_g, NRd, NRk: r.NRk, udnyttelse: udnyttelse(t.NEd_g, NRd), styrendeAnker: ids[0] ?? null, styrendeAnkerIds: ids, mellem: r };
}
