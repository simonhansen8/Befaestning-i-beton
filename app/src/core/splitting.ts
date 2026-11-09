// Spaltning (udsplitning) ved træk (EN 1992-4, 7.2.1.7). Rene tal; ingen tekst.
import { minKantafstand, projiceretAreal, type Kanter, type Pkt } from './geometry';
import { psiEc, psiRe, psiS, K1_INDSTOEBT } from './cone';
import { udnyttelse, type Eftervisning, type TraekOversigt } from './tension';

export interface SpaltningProdukt {
  indlimet: boolean;
  /** Produktdata (ETA/EAD); null/undefined → skøn jf. nedenfor. */
  ccrSp?: number | null; scrSp?: number | null; hmin?: number | null;
  d: number; d0?: number | null; th?: number | null;
}

/** ccr,sp, scr,sp og hmin. For indstøbte anker uden produktdata er ccr,sp = 2·hef et SKØN (skal verificeres). */
export function spaltningsparametre(p: SpaltningProdukt, hef: number, h: number, cnom: number) {
  let ccrSp: number, kildeC: string, hmin: number, kildeH: string;
  if (p.indlimet) {
    const r = h / hef;
    ccrSp = p.ccrSp ?? (r >= 2 ? hef : r > 1.3 ? 4.6 * hef - 1.8 * h : 2.26 * hef);
    kildeC = p.ccrSp != null ? 'ETA' : 'EAD-udtryk, eksempel';
    hmin = p.hmin ?? Math.max(hef + 30, hef + 2 * (p.d0 ?? 0), 100);
    kildeH = p.hmin != null ? 'ETA' : 'max(hef + 30; hef + 2d0; 100)';
  } else {
    ccrSp = p.ccrSp ?? 2 * hef;
    kildeC = p.ccrSp != null ? 'produktdata' : 'skøn 2,0·hef – SKAL VERIFICERES';
    hmin = p.hmin ?? hef + (p.th ?? 0) + Math.max(50, cnom);
    kildeH = p.hmin != null ? 'produktdata' : 'hef + th + max(50; cnom), EAD 330924 – skal verificeres';
  }
  return { ccrSp, scrSp: p.scrSp ?? 2 * ccrSp, hmin, kildeC, kildeH };
}

/** ψsus (7.20-lignende): 1 hvis αsus ≤ ψ⁰sus, ellers ψ⁰sus + 1 − αsus. */
export const psiSus = (alphaSus: number, psi0Sus: number): number => (alphaSus <= psi0Sus ? 1 : psi0Sus + 1 - alphaSus);

export interface SpaltningInput {
  produkt: SpaltningProdukt;
  hef: number; h: number; cnom: number; fck: number; revnet: boolean;
  kanter: Partial<Kanter>; afskalning: string; splitArmering: boolean;
  /** Indlimede anker: vedhæftning og ψsus. */
  kcrN?: number | null; kucrN?: number | null; tauRkCr?: number | null; tauRkUcr?: number | null; psiC?: number | null; psi0Sus?: number | null; alphaSus?: number;
  /** Indstøbte anker: NRk,p (udtrækning, fra udtraekning()). */
  NRkp?: number;
  gammaMsp: number; gammaMsRe: number;
}

export type SpaltningAarsag = 'ingen-traek' | 'ikke-noedvendig' | 'revnebegraensende-armering' | null;

export function spaltning(p: SpaltningInput, t: TraekOversigt): Eftervisning & { aarsag: SpaltningAarsag; kravAs?: number } {
  const base = { id: 'N_sp', NEd: 0, NRd: 0, NRk: 0, udnyttelse: null as number | null, styrendeAnker: null as number | null };
  if (!(t.NEd_g > 0)) return { ...base, relevant: false, aarsag: 'ingen-traek' };
  const a = spaltningsparametre(p.produkt, p.hef, p.h, p.cnom);
  const c = minKantafstand(t.traekAnkre, p.kanter);
  const u = t.traekAnkre.length === 1 ? 1 : 1.2;
  if (c >= u * a.ccrSp && p.h >= a.hmin) return { ...base, relevant: false, aarsag: 'ikke-noedvendig' };
  if (p.revnet && p.splitArmering) {
    return { ...base, relevant: false, aarsag: 'revnebegraensende-armering', kravAs: (0.5 * t.NEd_g) / (500 / p.gammaMsRe) };
  }
  const k1 = p.produkt.indlimet ? (p.revnet ? p.kcrN : p.kucrN) ?? NaN : p.revnet ? K1_INDSTOEBT.cr : K1_INDSTOEBT.ucr;
  const N0c = k1 * Math.sqrt(p.fck) * p.hef ** 1.5;
  const N0p = p.produkt.indlimet
    ? psiSus(p.alphaSus ?? 0, p.psi0Sus ?? NaN) * ((p.revnet ? p.tauRkCr : p.tauRkUcr) ?? NaN) * (p.psiC ?? NaN) * Math.PI * p.produkt.d * p.hef
    : (p.NRkp ?? NaN);
  const N0 = Math.min(N0p, N0c);
  const U = projiceretAreal(t.traekAnkre as Pkt[], a.scrSp, p.kanter);
  const A0 = a.scrSp * a.scrSp;
  const pH1 = (p.h / a.hmin) ** (2 / 3);
  const pH2 = Number.isFinite(c) ? Math.max(1, ((p.hef + 1.5 * c) / a.hmin) ** (2 / 3)) : Infinity;
  const psiH = Math.min(pH1, pH2, 2);
  const NRk = ((N0 * U.areal) / A0) * psiS(c, a.ccrSp) * psiRe(p.hef, p.afskalning) * psiEc(t.eN1, a.scrSp) * psiEc(t.eN2, a.scrSp) * psiH;
  const NRd = NRk / p.gammaMsp;
  return { id: 'N_sp', relevant: true, NEd: t.NEd_g, NRd, NRk, udnyttelse: udnyttelse(t.NEd_g, NRd), styrendeAnker: t.idMaxN, aarsag: null };
}
