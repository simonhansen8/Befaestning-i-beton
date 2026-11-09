// Diagnostik: maskinlæsbare fejl, advarsler og oplysninger (ingen tekst). Præsentationslaget oversætter kode + data til tekst.
export type Niveau = 'fejl' | 'advarsel' | 'info';
export interface Diagnostik {
  niveau: Niveau;
  /** Stabil kode, fx 'bolt-uden-for-beton'. */
  kode: string;
  /** Inputfelt som diagnosen vedrører (til fremhævning i UI). */
  felt: string | null;
  /** Normhenvisning. */
  paragraf: string;
  data: Record<string, number | string | boolean | null>;
}
export const EN = (p: string) => `EN 1992-4, ${p}`;
export const diag = (niveau: Niveau, kode: string, paragraf: string, felt: string | null, data: Diagnostik['data'] = {}): Diagnostik => ({ niveau, kode, felt, paragraf, data });
