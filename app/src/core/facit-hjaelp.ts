// Kun til facit-tests: gammel kerne ganger lasterne med K_FI, når `kfiPaaLaster` er slået til.
// Den nye kerne gør IKKE dette (beslutning): laster er altid designværdier inkl. K_FI.
import { KFI } from './constants';

export function legacyKfi(model: { indstillinger?: { kfiPaaLaster?: boolean; konsekvensklasse?: 'CC1' | 'CC2' | 'CC3' } }): number {
  const i = model.indstillinger ?? {};
  return i.kfiPaaLaster ? Math.min(1, KFI[i.konsekvensklasse ?? 'CC2'] ?? 1) : 1;
}

/**
 * Bevidst afvigelse fra den gamle kerne (docs/kritiske-fund.md #22): overfladearmeringens stænger er ét fysisk stangsæt.
 * Den gamle kerne talte en stang, som to ankre placerede samme sted, med for begge ankre, og medregnede stænger gennem et anker.
 * I disse facit-modeller sker det; de sammenlignes derfor ikke, men testene kontrollerer, at netop dette er årsagen.
 */
export const AFVIGER_OVERFLADESTAENGER = new Set([212, 334, 656, 755]);
export const overfladeAfviger = (armV: { sammenfald?: number; konflikter?: number }): boolean => (armV.sammenfald ?? 0) + (armV.konflikter ?? 0) > 0;
