// Kun til facit-tests: gammel kerne ganger lasterne med K_FI, når `kfiPaaLaster` er slået til.
// Den nye kerne gør IKKE dette (beslutning): laster er altid designværdier inkl. K_FI.
import { KFI } from './constants';

export function legacyKfi(model: { indstillinger?: { kfiPaaLaster?: boolean; konsekvensklasse?: 'CC1' | 'CC2' | 'CC3' } }): number {
  const i = model.indstillinger ?? {};
  return i.kfiPaaLaster ? Math.min(1, KFI[i.konsekvensklasse ?? 'CC2'] ?? 1) : 1;
}

/**
 * Kun til facit-tests: den gamle kerne brugte γMs,re = 1,20 uden γ3. Den nye kerne bruger γs = 1,20·γ3
 * (DS/EN 1992-1-1 DK NA, Tabel 2.1Na). For at kunne sammenligne divideres facit-modellens γMs,re med γ3.
 */
export function legacyGammaMsRe(model: { indstillinger?: { gammaMsRe?: number; kontrolklasse?: string } }): number {
  const i = model.indstillinger ?? {};
  const g3 = i.kontrolklasse === 'lempet' ? 1.1 : 1;
  return (typeof i.gammaMsRe === 'number' && i.gammaMsRe > 0 ? i.gammaMsRe : 1.2) / g3;
}
