// Hjælpefunktioner til felt-skemaet (betingelser og standardtekster).
import type { Model } from './skema-typer';

export const erIndstoebt = (m: Model): boolean => m.anker.type === 'indstoebt';
export const erIndlimet = (m: Model): boolean => m.anker.type === 'indlimet';
/** Om armeringsindstillingerne er foldet ud – uafhængigt af, om armeringen er slået til (så siden ikke hopper, når kontakten vendes). */
const hent = (k: string): boolean => { try { return sessionStorage.getItem('arm-' + k) !== '0'; } catch { return true; } };
export const armUdvid = { T: hent('T'), V: hent('V') };
export function saetArmUdvid(k: 'T' | 'V', v: boolean): void { armUdvid[k] = v; try { sessionStorage.setItem('arm-' + k, v ? '1' : '0'); } catch { /* ingen lagring */ } }
/** Vis armeringsfelterne (= foldet ud); navnet er historisk. */
export const traekArmeringAktiv = (_m: Model): boolean => armUdvid.T;
export const forskArmeringAktiv = (_m: Model): boolean => armUdvid.V;
export const forskArmeringOverflade = (m: Model): boolean => forskArmeringAktiv(m) && m.beton.armering.ankerarmeringForskydning.type === 'overflade';

/** "std. 12,5 mm": teksten under et tomt felt, der viser hvad der regnes med. */
export const stdTekst = (v: number | null | undefined, enhed = 'mm'): string =>
  v == null ? '' : `std. ${String(Math.round(v * 10) / 10).replace('.', ',')}${enhed ? ' ' + enhed : ''}`;
