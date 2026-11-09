// Produktdata fra europæiske tekniske vurderinger (ETA). Rene tal i N/mm/MPa.
// Kilde: ETA-19/0601 af 8. september 2025, Hilti HIT-HY 200-A V3 / HIT-HY 200-R V3, gevindstænger (Bilag B2 og C1, 50 års levetid, statisk last).

export const HILTI_HY200V3_ETA = 'ETA-19/0601';
export const STOERRELSER = [8, 10, 12, 16, 20, 24, 27, 30] as const;
export type Stoerrelse = (typeof STOERRELSER)[number];
export type Temperaturomraade = 'I' | 'II' | 'III';
export type Borehul = 'toert-vaadt' | 'vandfyldt';

const i = (d: Stoerrelse) => STOERRELSER.indexOf(d);

/** Bilag B2. */
const D0 = [10, 12, 14, 18, 22, 28, 30, 35];
const HEF_MIN = [60, 60, 70, 80, 90, 96, 108, 120];
const HEF_MAX = [160, 200, 240, 320, 400, 480, 540, 600];
const SMIN = [40, 50, 60, 75, 90, 115, 120, 140];
const CMIN = [40, 45, 45, 50, 55, 60, 75, 80];

/** Bilag C1: tør/våd, alle boremetoder. Revnet: M8 | M10 | M12–M30 (område II: M8 | M10–M30). */
const TAU_CR_TOERT: Record<Temperaturomraade, number[]> = {
  I: [7.5, 9.4, 9.5, 9.5, 9.5, 9.5, 9.5, 9.5],
  II: [6.4, 8.0, 8.0, 8.0, 8.0, 8.0, 8.0, 8.0],
  III: [5.5, 6.8, 6.9, 6.9, 6.9, 6.9, 6.9, 6.9],
};
const TAU_UCR_TOERT: Record<Temperaturomraade, number> = { I: 18, II: 15, III: 13 };
/** Bilag C1: vandfyldte huller (HD og HDB). */
const TAU_CR_VAND: Record<Temperaturomraade, number[]> = {
  I: [6.1, 7.4, 7.2, 6.7, 6.4, 6.1, 6.1, 6.0],
  II: [5.2, 6.3, 6.1, 5.7, 5.5, 5.2, 5.2, 5.1],
  III: [4.5, 5.4, 5.2, 4.9, 4.7, 4.5, 4.5, 4.4],
};
const TAU_UCR_VAND: Record<Temperaturomraade, number[]> = {
  I: [14.0, 13.8, 13.5, 13.0, 12.5, 11.9, 11.4, 10.9],
  II: [11.9, 11.7, 11.5, 11.1, 10.6, 10.1, 9.7, 9.3],
  III: [10.2, 10.1, 9.9, 9.5, 9.1, 8.7, 8.3, 8.0],
};
const PSI0_SUS: Record<Temperaturomraade, number> = { I: 0.8, II: 0.89, III: 0.72 };

export interface ProduktVaerdier {
  produkt: string; d: number; d0: number; hefMin: number; hefMax: number; smin: number; cmin: number;
  tauRkCr: number; tauRkUcr: number; psi0Sus: number; kcrN: number; kucrN: number; gammaInst: number;
}

export function hiltiHY200V3(d: Stoerrelse, t: Temperaturomraade, hul: Borehul): ProduktVaerdier {
  const k = i(d), vand = hul === 'vandfyldt';
  return {
    produkt: `Hilti HIT-HY 200 V3 · ${HILTI_HY200V3_ETA}`,
    d, d0: D0[k]!, hefMin: HEF_MIN[k]!, hefMax: HEF_MAX[k]!, smin: SMIN[k]!, cmin: CMIN[k]!,
    tauRkCr: (vand ? TAU_CR_VAND : TAU_CR_TOERT)[t][k]!,
    tauRkUcr: vand ? TAU_UCR_VAND[t][k]! : TAU_UCR_TOERT[t],
    psi0Sus: PSI0_SUS[t], kcrN: 7.7, kucrN: 11, gammaInst: vand ? 1.4 : 1.0,
  };
}

/** Stier i modellen, så brugerfladen kan anvende værdierne med saetSti. */
export function tilOpdateringer(p: ProduktVaerdier): [string, number | string][] {
  return (Object.keys(p) as (keyof ProduktVaerdier)[]).map((k) => [`anker.${k}`, p[k]]);
}

// ---------------------------------------------------------------- Egne produkter (andre leverandører)

/** Produktrelaterede felter i modellen (anker.*), som et eget produkt gemmer og anvender. */
export const PRODUKTNOEGLER = [
  'type', 'produkt', 'd', 'd0', 'hefMin', 'hefMax', 'smin', 'cmin', 'hmin', 'dnom', 'dh', 'th', 'hovedForm', 'hovedSide',
  'tauRkCr', 'tauRkUcr', 'psiC', 'psi0Sus', 'kcrN', 'kucrN', 'ccrN', 'scrN', 'ccrSp', 'scrSp', 'gammaInst',
  'NRksEta', 'VRksEta', 'M0RksEta', 'k7', 'k8', 'betonMin', 'betonMax',
] as const;

export interface EgetProdukt { navn: string; vaerdier: Record<string, number | string | null> }

/** Udtrækker produktfelterne af modellens anker-blok (kun felter, der findes). */
export function produktFraAnker(anker: Record<string, unknown>): Record<string, number | string | null> {
  const ud: Record<string, number | string | null> = {};
  for (const k of PRODUKTNOEGLER) {
    const v = anker[k];
    if (typeof v === 'number' || typeof v === 'string' || v === null) ud[k] = v;
  }
  return ud;
}

/** Stier og værdier til anvendelse; ukendte nøgler ignoreres. */
export function produktOpdateringer(v: Record<string, unknown>): [string, number | string | null][] {
  return PRODUKTNOEGLER.filter((k) => k in v && (typeof v[k] === 'number' || typeof v[k] === 'string' || v[k] === null)).map((k) => [`anker.${k}`, v[k] as number | string | null]);
}
