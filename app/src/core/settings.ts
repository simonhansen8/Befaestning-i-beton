import { ecmAfFck } from './concrete';
import { DK_NA, GAMMA3_AF_KONTROLKLASSE, type Konsekvensklasse, type Kontrolklasse } from './constants';

/** Indstillinger som brugeren kan sætte. Kun RÅ valg gemmes: γ3 er IKKE et input – den udledes af kontrolklassen. */
export interface IndstillingerInput {
  kontrolklasse?: Kontrolklasse | 'skaerpet';
  /** Manuel overstyring af γ3. Uden værdi udledes γ3 af kontrolklassen. */
  gamma3?: number | null;
  konsekvensklasse?: Konsekvensklasse;
  interaktion?: 'gunstigst' | 'potens' | 'lineaer';
  staalInteraktionVedLoeftestang?: 'eftervis' | 'undtag';
  pryoutEnkeltanker?: 'retning' | 'altid';
  forresteRaekkeTol?: number;
  gammaC?: number; gammaInstIndstoebt?: number;
  gammaMsTraekFaktor?: number; gammaMsTraekMin?: number;
  gammaMsForskFaktor?: number; gammaMsForskMin?: number; gammaMsForskHoej?: number;
  gammaMsRe?: number; gammaCt?: number; alphaCt?: number;
  Es?: number; Ec?: number | null;
}

export interface Indstillinger {
  kontrolklasse: Kontrolklasse;
  /** Manuel γ3 (≥ 1,0) eller null = udledt af kontrolklassen. */
  gamma3Overstyring: number | null;
  /** Kun til dokumentation/rapport. K_FI ganges IKKE på lasterne: laster indtastes som designværdier inkl. K_FI. */
  konsekvensklasse: Konsekvensklasse;
  interaktion: 'gunstigst' | 'potens' | 'lineaer';
  staalInteraktionVedLoeftestang: 'eftervis' | 'undtag';
  pryoutEnkeltanker: 'retning' | 'altid';
  forresteRaekkeTol: number;
  gammaC: number; gammaInstIndstoebt: number;
  gammaMsTraekFaktor: number; gammaMsTraekMin: number;
  gammaMsForskFaktor: number; gammaMsForskMin: number; gammaMsForskHoej: number;
  gammaMsRe: number; gammaCt: number; alphaCt: number;
  Es: number;
  /** Manuel Ec [MPa] eller null = udledt af betonklassen (EN 1992-1-1 Tabel 3.1). */
  EcOverstyring: number | null;
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
  let gamma3Overstyring: number | null = null;
  if (typeof rå.gamma3 === 'number' && Number.isFinite(rå.gamma3) && rå.gamma3 > 0) {
    if (rå.gamma3 < 1) {
      bemaerkninger.push({ niveau: 'advarsel', felt: 'indstillinger.gamma3', tekst: `γ3 = ${String(rå.gamma3).replace('.', ',')} < 1,0 er ikke hjemlet for befæstninger (kontrolklasser udgår under BR18 § 16, stk. 1). Der regnes med γ3 = 1,0.` });
      gamma3Overstyring = 1;
    } else gamma3Overstyring = rå.gamma3;
  }
  const indstillinger: Indstillinger = {
    kontrolklasse,
    gamma3Overstyring,
    konsekvensklasse: oneOf(rå.konsekvensklasse, ['CC1', 'CC2', 'CC3'] as const, 'CC2'),
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
    EcOverstyring: typeof rå.Ec === 'number' && Number.isFinite(rå.Ec) && rå.Ec > 0 ? rå.Ec : null,
  };
  return { indstillinger, bemaerkninger };
}

/** γ3: manuel overstyring hvis angivet, ellers udledt af kontrolklassen. */
export const gamma3 = (i: Indstillinger): number => i.gamma3Overstyring ?? GAMMA3_AF_KONTROLKLASSE[i.kontrolklasse];

/** Ec [MPa]: manuel overstyring hvis angivet, ellers Ecm af betonens fck. */
export const youngBeton = (i: Indstillinger, fck: number): number => i.EcOverstyring ?? ecmAfFck(fck);
