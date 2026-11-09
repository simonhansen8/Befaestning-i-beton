import { DK_NA, GAMMA3_AF_KONTROLKLASSE, type Konsekvensklasse, type Kontrolklasse } from './constants';

/** Indstillinger som brugeren kan sætte. Kun RÅ valg gemmes: γ3 er IKKE et input – den udledes af kontrolklassen. */
export interface IndstillingerInput {
  kontrolklasse?: Kontrolklasse | 'skaerpet';
  konsekvensklasse?: Konsekvensklasse;
  kfiPaaLaster?: boolean;
  interaktion?: 'gunstigst' | 'potens' | 'lineaer';
  staalInteraktionVedLoeftestang?: 'eftervis' | 'undtag';
  pryoutEnkeltanker?: 'retning' | 'altid';
  forresteRaekkeTol?: number;
  gammaC?: number; gammaInstIndstoebt?: number;
  gammaMsTraekFaktor?: number; gammaMsTraekMin?: number;
  gammaMsForskFaktor?: number; gammaMsForskMin?: number; gammaMsForskHoej?: number;
  gammaMsRe?: number; gammaCt?: number; alphaCt?: number;
  Es?: number; Ec?: number;
}

export interface Indstillinger {
  kontrolklasse: Kontrolklasse;
  konsekvensklasse: Konsekvensklasse;
  kfiPaaLaster: boolean;
  interaktion: 'gunstigst' | 'potens' | 'lineaer';
  staalInteraktionVedLoeftestang: 'eftervis' | 'undtag';
  pryoutEnkeltanker: 'retning' | 'altid';
  forresteRaekkeTol: number;
  gammaC: number; gammaInstIndstoebt: number;
  gammaMsTraekFaktor: number; gammaMsTraekMin: number;
  gammaMsForskFaktor: number; gammaMsForskMin: number; gammaMsForskHoej: number;
  gammaMsRe: number; gammaCt: number; alphaCt: number;
  Es: number; Ec: number;
}

export interface Bemaerkning { niveau: 'advarsel' | 'fejl'; felt: string; tekst: string }

const oneOf = <T extends string>(v: unknown, tilladt: readonly T[], standard: T): T =>
  typeof v === 'string' && (tilladt as readonly string[]).includes(v) ? (v as T) : standard;
const positivt = (v: unknown, standard: number): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : standard);

/** Parser og normaliserer indstillinger. Ugyldige/manglende værdier → DK NA-standard. */
export function parseIndstillinger(rå: IndstillingerInput = {}): { indstillinger: Indstillinger; bemaerkninger: Bemaerkning[] } {
  const bemaerkninger: Bemaerkning[] = [];
  let kontrolklasse: Kontrolklasse;
  if (rå.kontrolklasse === 'skaerpet') {
    kontrolklasse = 'normal';
    bemaerkninger.push({ niveau: 'advarsel', felt: 'indstillinger.kontrolklasse', tekst: 'Skærpet kontrolklasse (γ3 = 0,95) er ikke hjemlet for befæstninger og er sat til udførelsesklasse (γ3 = 1,00).' });
  } else kontrolklasse = oneOf(rå.kontrolklasse, ['lempet', 'normal'] as const, 'normal');
  const indstillinger: Indstillinger = {
    kontrolklasse,
    konsekvensklasse: oneOf(rå.konsekvensklasse, ['CC1', 'CC2', 'CC3'] as const, 'CC2'),
    kfiPaaLaster: rå.kfiPaaLaster === true,
    interaktion: oneOf(rå.interaktion, ['gunstigst', 'potens', 'lineaer'] as const, 'gunstigst'),
    staalInteraktionVedLoeftestang: oneOf(rå.staalInteraktionVedLoeftestang, ['eftervis', 'undtag'] as const, 'undtag'),
    pryoutEnkeltanker: oneOf(rå.pryoutEnkeltanker, ['retning', 'altid'] as const, 'retning'),
    forresteRaekkeTol: typeof rå.forresteRaekkeTol === 'number' && rå.forresteRaekkeTol >= 0 && rå.forresteRaekkeTol <= 1 ? rå.forresteRaekkeTol : 0.1,
    gammaC: positivt(rå.gammaC, DK_NA.gammaC),
    gammaInstIndstoebt: positivt(rå.gammaInstIndstoebt, DK_NA.gammaInstIndstoebt),
    gammaMsTraekFaktor: positivt(rå.gammaMsTraekFaktor, DK_NA.gammaMsTraekFaktor),
    gammaMsTraekMin: positivt(rå.gammaMsTraekMin, DK_NA.gammaMsTraekMin),
    gammaMsForskFaktor: positivt(rå.gammaMsForskFaktor, DK_NA.gammaMsForskFaktor),
    gammaMsForskMin: positivt(rå.gammaMsForskMin, DK_NA.gammaMsForskMin),
    gammaMsForskHoej: positivt(rå.gammaMsForskHoej, DK_NA.gammaMsForskHoej),
    gammaMsRe: positivt(rå.gammaMsRe, DK_NA.gammaMsRe),
    gammaCt: positivt(rå.gammaCt, DK_NA.gammaCt),
    alphaCt: positivt(rå.alphaCt, DK_NA.alphaCt),
    Es: positivt(rå.Es, DK_NA.Es),
    Ec: positivt(rå.Ec, DK_NA.Ec),
  };
  return { indstillinger, bemaerkninger };
}

export const gamma3 = (i: Indstillinger): number => GAMMA3_AF_KONTROLKLASSE[i.kontrolklasse];
