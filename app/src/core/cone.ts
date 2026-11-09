// Betonkeglebrud ved træk (EN 1992-4, 7.2.1.4). Rene tal; ingen tekst.
import { minKantafstand, kantafstand, KANTER, projiceretAreal, type Kanter, type Pkt, type RectUnion } from './geometry';
import { udnyttelse, type Eftervisning, type TraekOversigt } from './tension';

export const K1_INDSTOEBT = { cr: 8.9, ucr: 12.7 } as const;

/** ψs,N (7.4): påvirkning af kantafstand. */
export const psiS = (c: number, ccr: number): number => (Number.isFinite(c) ? Math.min(1, 0.7 + (0.3 * c) / ccr) : 1);
/** ψec,N (7.6): excentricitet af trækkræfternes resultant. */
export const psiEc = (e: number, scr: number): number => 1 / (1 + (2 * e) / scr);
/** ψre,N (7.5): afskalningsarmering. */
export const psiRe = (hef: number, afskalning: 'taet' | 'aaben' | string): number => (afskalning === 'aaben' ? 1 : Math.min(1, 0.5 + hef / 200));

export interface KegleInput {
  /** Trukne ankre og excentriciteter (fra traekOversigt). */
  ankre: Pkt[]; e1: number; e2: number;
  hef: number; fck: number; revnet: boolean; indlimet: boolean;
  kcrN?: number | null; kucrN?: number | null; ccrN?: number | null; scrN?: number | null;
  kanter: Partial<Kanter>; afskalning: string;
  /** ψM,N (7.7) kun for den primære N_c-kontrol (ikke når hef er overstyret fx til armering/udsplitning). */
  momentfaktor?: { C: number; NEd_g: number; z: number; cMinAlle: number } | null;
  /** Overstyret hef (bruges af armeringsmodulet): ccr/scr = 1,5·hef og 3·hef. */
  hefOverstyring?: number | null;
}

export interface KegleResultat {
  k1: number; hefE: number; ccr: number; scr: number; ccrN0: number; scrN0: number;
  smal: { cmax: number; smax: number; h1: number; h2: number; nKanter: number } | null;
  N0: number; U: RectUnion; A0: number; c: number;
  pS: number; pRe: number; pEc: number; pM: number; pMgrund: string; NRk: number;
}

export function betonkegle(p: KegleInput): KegleResultat {
  const hef = p.hefOverstyring ?? p.hef;
  const k1 = p.indlimet ? (p.revnet ? p.kcrN : p.kucrN) ?? NaN : p.revnet ? K1_INDSTOEBT.cr : K1_INDSTOEBT.ucr;
  const ccrN0 = p.hefOverstyring != null ? 1.5 * hef : (p.ccrN ?? 1.5 * hef);
  const scrN0 = p.hefOverstyring != null ? 2 * ccrN0 : (p.scrN ?? 2 * ccrN0);
  let hefE = hef;
  let smal: KegleResultat['smal'] = null;
  const kantMin = KANTER.map((k) => Math.min(...p.ankre.map((a) => kantafstand(a, p.kanter, k)))).filter((v) => v < ccrN0);
  if (kantMin.length >= 3) {
    const cmax = Math.max(...kantMin);
    const xs = p.ankre.map((a) => a.x), ys = p.ankre.map((a) => a.y);
    const smax = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const h1 = (cmax / ccrN0) * hef, h2 = (smax / scrN0) * hef;
    hefE = Math.min(hef, Math.max(h1, h2));
    smal = { cmax, smax, h1, h2, nKanter: kantMin.length };
  }
  const ccr = (ccrN0 * hefE) / hef, scr = (scrN0 * hefE) / hef;
  const N0 = k1 * Math.sqrt(p.fck) * hefE ** 1.5;
  const U = projiceretAreal(p.ankre, scr, p.kanter);
  const A0 = scr * scr;
  const c = minKantafstand(p.ankre, p.kanter);
  const pS = psiS(c, ccr), pRe = psiRe(hef, p.afskalning), pEc = psiEc(p.e1, scr) * psiEc(p.e2, scr);
  let pM = 1, pMgrund = 'ingen trykzone';
  const mf = p.momentfaktor;
  if (mf && mf.C > 0) {
    if (hefE < hef) pMgrund = "h'ef anvendt";
    else if (mf.cMinAlle < 1.5 * hef) pMgrund = 'c < 1,5hef';
    else if (mf.C / mf.NEd_g < 0.8) pMgrund = 'C/N < 0,8';
    else if (mf.z / hef >= 1.5) pMgrund = 'z/hef >= 1,5';
    else { pM = Math.max(1, 2 - mf.z / (1.5 * hef)); pMgrund = 'z = ' + Math.round(mf.z) + ' mm'; }
  }
  const NRk = ((N0 * U.areal) / A0) * pS * pRe * pEc * pM;
  return { k1, hefE, ccr, scr, ccrN0, scrN0, smal, N0, U, A0, c, pS, pRe, pEc, pM, pMgrund, NRk };
}

/** N_c-eftervisning: NRd,c = NRk,c / γMc. `erstattetAfArmering` gør eftervisningen irrelevant (7.2.1.9). */
export function eftervisBetonkegle(p: KegleInput, gammaMc: number, t: TraekOversigt, erstattetAfArmering = false): Eftervisning & { mellem?: KegleResultat } {
  if (!(t.NEd_g > 0)) return { id: 'N_c', relevant: false, NEd: 0, NRd: 0, NRk: 0, udnyttelse: null, styrendeAnker: null };
  const r = betonkegle(p);
  const NRd = r.NRk / gammaMc;
  return { id: 'N_c', relevant: !erstattetAfArmering, NEd: t.NEd_g, NRd, NRk: r.NRk, udnyttelse: erstattetAfArmering ? null : udnyttelse(t.NEd_g, NRd), styrendeAnker: t.idMaxN, mellem: r };
}
