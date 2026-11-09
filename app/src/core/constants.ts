// Konstanter og DK NA-standardværdier. Kilde: gammel kerne (index.html), Tabel 4.1 DK NA m.fl.
// Én kilde til standardværdier – bruges både til parsing og til "brugerændret"-markering.

export type Kontrolklasse = 'lempet' | 'normal';
export type Konsekvensklasse = 'CC1' | 'CC2' | 'CC3';

/** γ3 afledt af kontrolklasse (udførelsesklasse → 1,00; lempet → 1,10). Skærpet (0,95) er ikke hjemlet for befæstninger. */
export const GAMMA3_AF_KONTROLKLASSE: Record<Kontrolklasse, number> = { lempet: 1.1, normal: 1 };

/** K_FI efter konsekvensklasse. */
export const KFI: Record<Konsekvensklasse, number> = { CC1: 0.9, CC2: 1, CC3: 1.1 };

export interface StaalKlasse { fuk: number; fyk: number; duktil: boolean }
export const STAALKLASSER = {
  '4.6': { fuk: 400, fyk: 240, duktil: true },
  '5.6': { fuk: 500, fyk: 300, duktil: true },
  '4.8': { fuk: 400, fyk: 320, duktil: false },
  '5.8': { fuk: 500, fyk: 400, duktil: false },
  '6.8': { fuk: 600, fyk: 480, duktil: false },
  '8.8': { fuk: 800, fyk: 640, duktil: true },
  '10.9': { fuk: 1000, fyk: 900, duktil: true },
  'A4-70': { fuk: 700, fyk: 450, duktil: true },
  'A4-80': { fuk: 800, fyk: 600, duktil: true },
  SD: { fuk: 450, fyk: 350, duktil: true },
} as const satisfies Record<string, StaalKlasse>;
export type StaalKlasseNavn = keyof typeof STAALKLASSER;

/** Spændingsareal As [mm²] for gevind, pr. nominel diameter. */
export const GEVINDAREAL: Record<number, number> = {
  6: 20.1, 8: 36.6, 10: 58, 12: 84.3, 14: 115, 16: 157, 18: 192, 20: 245, 22: 303, 24: 353, 27: 459, 30: 561, 33: 694, 36: 817,
};

/** DK NA-standardværdier for indstillinger (Tabel 4.1 DK NA m.fl.). */
export const DK_NA = {
  gammaC: 1.45,
  gammaInstIndstoebt: 1,
  gammaMsTraekFaktor: 1.2,
  gammaMsTraekMin: 1.5,
  gammaMsForskFaktor: 1,
  gammaMsForskMin: 1.35,
  gammaMsForskHoej: 1.65,
  gammaMsRe: 1.2,
  gammaCt: 1.7,
  alphaCt: 1,
  Es: 210000,
} as const;
