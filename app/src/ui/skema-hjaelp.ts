// Hjælpefunktioner til felt-skemaet (betingelser og standardtekster).
import type { Model } from './skema-typer';

export const erIndstoebt = (m: Model): boolean => m.anker.type === 'indstoebt';
export const erIndlimet = (m: Model): boolean => m.anker.type === 'indlimet';
export const traekArmeringAktiv = (m: Model): boolean => m.beton.armering.ankerarmeringTraek.aktiv;
export const forskArmeringAktiv = (m: Model): boolean => m.beton.armering.ankerarmeringForskydning.aktiv;
export const forskArmeringOverflade = (m: Model): boolean => forskArmeringAktiv(m) && m.beton.armering.ankerarmeringForskydning.type === 'overflade';

/** "std. 12,5 mm": teksten under et tomt felt, der viser hvad der regnes med. */
export const stdTekst = (v: number | null | undefined, enhed = 'mm'): string =>
  v == null ? '' : `std. ${String(Math.round(v * 10) / 10).replace('.', ',')}${enhed ? ' ' + enhed : ''}`;
