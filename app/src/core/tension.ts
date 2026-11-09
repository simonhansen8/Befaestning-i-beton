// Trækbrudformer for befæstninger (EN 1992-4, 7.2.1). Rene funktioner; resultaterne er tal, ingen tekst.
import type { Anker } from './loads';

export interface Eftervisning {
  id: string;
  relevant: boolean;
  NEd: number; NRd: number; NRk: number;
  /** NEd/NRd; ∞ hvis NRd = 0 og NEd > 0; null hvis ikke relevant. */
  udnyttelse: number | null;
  styrendeAnker: number | null;
}

/** Udnyttelse = last/kapacitet (∞ ved kapacitet 0 og last > 0). */
export const udnyttelse = (ed: number, rd: number): number => (rd > 0 ? ed / rd : ed > 0 ? Infinity : 0);

export interface TraekOversigt {
  /** Ankre i træk (> 0,1 % af størst og > 1 N) og deres kræfter. */
  traekAnkre: Anker[]; kraefter: number[];
  NEd_g: number; NEd_h: number; idMaxN: number | null;
  /** Tyngdepunkt af trækkræfterne (xN, yN), og af de trukne ankre (xg, yg). */
  xN: number; yN: number; xg: number; yg: number;
  /** Excentriciteter mellem trækkraftcentrum og gruppens tyngdepunkt. */
  eN1: number; eN2: number;
  /** Indre momentarm: afstand mellem trækkraftcentrum og trykresultant. */
  z: number;
}

export function traekOversigt(ankre: Anker[], F: number[], tryk: { C: number; xC: number; yC: number }): TraekOversigt {
  const maks = Math.max(0, ...F);
  const traekAnkre = ankre.filter((_, i) => F[i]! > 0.001 * maks && F[i]! > 1);
  const kraefter = traekAnkre.map((a) => F[ankre.indexOf(a)]!);
  const sum = kraefter.reduce((s, v) => s + v, 0);
  let imax = 0;
  F.forEach((v, i) => { if (v > F[imax]!) imax = i; });
  if (!traekAnkre.length) {
    return { traekAnkre, kraefter, NEd_g: 0, NEd_h: 0, idMaxN: null, xN: 0, yN: 0, xg: 0, yg: 0, eN1: 0, eN2: 0, z: 0 };
  }
  const xN = traekAnkre.reduce((s, a, i) => s + kraefter[i]! * a.x, 0) / sum;
  const yN = traekAnkre.reduce((s, a, i) => s + kraefter[i]! * a.y, 0) / sum;
  const xg = traekAnkre.reduce((s, a) => s + a.x, 0) / traekAnkre.length;
  const yg = traekAnkre.reduce((s, a) => s + a.y, 0) / traekAnkre.length;
  return {
    traekAnkre, kraefter, NEd_g: sum, NEd_h: maks, idMaxN: ankre[imax]!.id, xN, yN, xg, yg,
    eN1: Math.abs(xN - xg), eN2: Math.abs(yN - yg), z: tryk.C > 0 ? Math.hypot(xN - tryk.xC, yN - tryk.yC) : 0,
  };
}

/** Stålbrud, træk (7.2.1.3): NRd,s = NRk,s / γMs, NRk,s = As·fuk (eller ETA-værdi). */
export function staalbrudTraek(p: { As: number; fuk: number; NRksEta?: number | null; gammaMs: number }, t: TraekOversigt): Eftervisning {
  const NRk = p.NRksEta ?? p.As * p.fuk;
  const NRd = NRk / p.gammaMs;
  const relevant = t.NEd_h > 0;
  return { id: 'N_s', relevant, NEd: t.NEd_h, NRd, NRk, udnyttelse: relevant ? udnyttelse(t.NEd_h, NRd) : null, styrendeAnker: t.idMaxN };
}

/** Lastoverførende hovedareal Ah af ankerhoved (7.2.1.5, (7.12)). */
export function hovedareal(a: { d: number; dh: number; th: number; hovedForm?: 'rund' | 'firkant'; hovedSide?: number | null }): number {
  if (a.hovedForm === 'firkant') { const s = a.hovedSide ?? a.dh; return s * s - (Math.PI / 4) * a.d * a.d; }
  return (Math.PI / 4) * (Math.min(a.dh, 6 * a.th + a.d) ** 2 - a.d * a.d);
}

export const K2 = { cr: 7.5, ucr: 10.5 } as const;

/** Udtrækning af indstøbt anker (7.2.1.5): NRk,p = k2·Ah·fck (fck ≤ 60), NRd,p = NRk,p / γMp. */
export function udtraekning(p: { fck: number; revnet: boolean; ah: number; gammaMp: number }, t: TraekOversigt): Eftervisning {
  const NRk = (p.revnet ? K2.cr : K2.ucr) * p.ah * p.fck;
  const NRd = NRk / p.gammaMp;
  const relevant = t.NEd_h > 0;
  return { id: 'N_p', relevant, NEd: t.NEd_h, NRd, NRk, udnyttelse: relevant ? udnyttelse(t.NEd_h, NRd) : null, styrendeAnker: t.idMaxN };
}
