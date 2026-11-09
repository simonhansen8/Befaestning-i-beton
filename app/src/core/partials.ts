import { KFI } from './constants';
import { gamma3, type Indstillinger } from './settings';

export interface Partialkoefficienter {
  gammaC: number; gamma3: number; gammaInst: number; gammaInstV: number;
  gammaMc: number; gammaMcV: number; gammaMp: number; gammaMsp: number;
  gammaMs: number; gammaMsV: number; gammaMsVBetingelse: boolean;
  gammaMsRe: number; gammaCt: number; alphaCt: number; kfiOenske: number; kfi: number;
}

/** Partialkoefficienter (EN 1992-4 Tabel 4.1 + DK NA). `gammaInstIndlimet` er produktets γinst for indlimede anker. */
export function partialkoefficienter(
  s: Indstillinger,
  anker: { type: 'indstoebt' | 'indlimet'; fuk: number; fyk: number; gammaInstIndlimet?: number },
): Partialkoefficienter {
  const g3 = gamma3(s);
  const indl = anker.type === 'indlimet';
  const gammaInst = indl ? (anker.gammaInstIndlimet ?? s.gammaInstIndstoebt) : s.gammaInstIndstoebt;
  const gammaInstV = indl ? 1 : s.gammaInstIndstoebt;
  const gammaMs = Math.max(s.gammaMsTraekFaktor * (anker.fuk / anker.fyk), s.gammaMsTraekMin);
  const gammaMsVBetingelse = anker.fuk <= 800 && anker.fyk / anker.fuk <= 0.8;
  const gammaMsV = gammaMsVBetingelse ? Math.max(s.gammaMsForskFaktor * (anker.fuk / anker.fyk), s.gammaMsForskMin) : s.gammaMsForskHoej;
  const kfiOenske = s.kfiPaaLaster ? (KFI[s.konsekvensklasse] ?? 1) : 1;
  return {
    gammaC: s.gammaC, gamma3: g3, gammaInst, gammaInstV,
    gammaMc: s.gammaC * g3 * gammaInst, gammaMcV: s.gammaC * g3 * gammaInstV,
    gammaMp: s.gammaC * g3 * gammaInst, gammaMsp: s.gammaC * g3 * gammaInst,
    gammaMs, gammaMsV, gammaMsVBetingelse, gammaMsRe: s.gammaMsRe,
    gammaCt: s.gammaCt * g3, alphaCt: s.alphaCt, kfiOenske, kfi: s.kfiPaaLaster ? Math.min(1, kfiOenske) : 1,
  };
}
