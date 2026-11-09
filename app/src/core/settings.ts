import { ecmAfFck } from './concrete';
import { DK_NA, DK_NA_ULYKKE, GAMMA3_AF_KONTROLKLASSE, type Dimensioneringstilfaelde, type Konsekvensklasse, type Kontrolklasse } from './constants';

/** Indstillinger som brugeren kan sætte. Kun RÅ valg gemmes: γ3 er IKKE et input – den udledes af kontrolklassen. */
export interface IndstillingerInput {
  /** Dimensioneringstilfælde: 'varig' (vedvarende og midlertidige, standard) eller 'ulykke' (DK NA Tabel 4.1, højre kolonne). */
  situation?: Dimensioneringstilfaelde;
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
  situation: Dimensioneringstilfaelde;
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
  const situation = oneOf(rå.situation, ['varig', 'ulykke'] as const, 'varig');
  const NA = situation === 'ulykke' ? DK_NA_ULYKKE : DK_NA;
  const indstillinger: Indstillinger = {
    situation,
    kontrolklasse,
    gamma3Overstyring,
    konsekvensklasse: oneOf(rå.konsekvensklasse, ['CC1', 'CC2', 'CC3'] as const, 'CC2'),
    interaktion: oneOf(rå.interaktion, ['gunstigst', 'potens', 'lineaer'] as const, 'gunstigst'),
    staalInteraktionVedLoeftestang: oneOf(rå.staalInteraktionVedLoeftestang, ['eftervis', 'undtag'] as const, 'undtag'),
    pryoutEnkeltanker: oneOf(rå.pryoutEnkeltanker, ['retning', 'altid'] as const, 'retning'),
    forresteRaekkeTol: typeof rå.forresteRaekkeTol === 'number' && rå.forresteRaekkeTol >= 0 && rå.forresteRaekkeTol <= 1 ? rå.forresteRaekkeTol : 0.1,
    gammaC: positivt(rå.gammaC, NA.gammaC),
    gammaInstIndstoebt: positivt(rå.gammaInstIndstoebt, NA.gammaInstIndstoebt),
    gammaMsTraekFaktor: positivt(rå.gammaMsTraekFaktor, NA.gammaMsTraekFaktor),
    gammaMsTraekMin: positivt(rå.gammaMsTraekMin, NA.gammaMsTraekMin),
    gammaMsForskFaktor: positivt(rå.gammaMsForskFaktor, NA.gammaMsForskFaktor),
    gammaMsForskMin: positivt(rå.gammaMsForskMin, NA.gammaMsForskMin),
    gammaMsForskHoej: positivt(rå.gammaMsForskHoej, NA.gammaMsForskHoej),
    gammaMsRe: positivt(rå.gammaMsRe, NA.gammaMsRe),
    gammaCt: positivt(rå.gammaCt, NA.gammaCt),
    alphaCt: positivt(rå.alphaCt, NA.alphaCt),
    Es: positivt(rå.Es, NA.Es),
    EcOverstyring: typeof rå.Ec === 'number' && Number.isFinite(rå.Ec) && rå.Ec > 0 ? rå.Ec : null,
  };
  return { indstillinger, bemaerkninger };
}

/** γ3: manuel overstyring hvis angivet, ellers udledt af kontrolklassen. */
/** I ulykkestilfælde indgår γ3 ikke (γc = 1,00 er angivet direkte i DK NA Tabel 4.1). */
export const gamma3 = (i: Indstillinger): number => (i.situation === 'ulykke' ? 1 : i.gamma3Overstyring ?? GAMMA3_AF_KONTROLKLASSE[i.kontrolklasse]);

/** Ec [MPa]: manuel overstyring hvis angivet, ellers Ecm af betonens fck. */
export const youngBeton = (i: Indstillinger, fck: number): number => i.EcOverstyring ?? ecmAfFck(fck);
