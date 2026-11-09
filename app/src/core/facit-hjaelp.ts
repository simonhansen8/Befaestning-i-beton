// Kun til facit-tests: gammel kerne ganger lasterne med K_FI, når `kfiPaaLaster` er slået til.
// Den nye kerne gør IKKE dette (beslutning): laster er altid designværdier inkl. K_FI.
import { KFI } from './constants';

export function legacyKfi(model: { indstillinger?: { kfiPaaLaster?: boolean; konsekvensklasse?: 'CC1' | 'CC2' | 'CC3' } }): number {
  const i = model.indstillinger ?? {};
  return i.kfiPaaLaster ? Math.min(1, KFI[i.konsekvensklasse ?? 'CC2'] ?? 1) : 1;
}
