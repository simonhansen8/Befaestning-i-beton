// Felt → modelværdi: én vej fra brugerens indtastning til modellen (parsing, grænser, standarder).
import { parseTal } from '../core/indlaes';
import type { FeltDef } from './skema-typer';

export type Tolket = { ok: true; v: unknown } | { ok: false; kode: 'ikke-tal' | 'for-lav' | 'for-hoej' | 'ikke-heltal' | 'paakraevet' | 'ugyldigt-valg'; grænse?: number };

/** Tolker tekst fra et inputfelt. Tomt felt er null hvis feltet er nullable, ellers påkrævet. */
export function tolkFelt(f: FeltDef, raa: string | boolean): Tolket {
  if (f.type === 'switch') return { ok: true, v: raa === true || raa === 'true' };
  if (f.type === 'seg' || f.type === 'select') {
    if (raa === '' && f.nullable && f.options?.some(([v]) => v === '')) return { ok: true, v: null };
    const o = f.options?.find(([v]) => String(v) === String(raa));
    if (!o) return { ok: false, kode: 'ugyldigt-valg' };
    return { ok: true, v: f.num ? Number(o[0]) : o[0] };
  }
  if (f.type === 'text' || f.type === 'date') return { ok: true, v: String(raa) };
  const s = String(raa).trim();
  if (s === '') return f.nullable ? { ok: true, v: null } : { ok: false, kode: 'paakraevet' };
  const v = parseTal(s);
  if (!Number.isFinite(v)) return { ok: false, kode: 'ikke-tal' };
  if (f.int && !Number.isInteger(v)) return { ok: false, kode: 'ikke-heltal' };
  if (f.min != null && v < f.min) return { ok: false, kode: 'for-lav', grænse: f.min };
  if (f.minEx != null && v <= f.minEx) return { ok: false, kode: 'for-lav', grænse: f.minEx };
  if (f.max != null && v > f.max) return { ok: false, kode: 'for-hoej', grænse: f.max };
  return { ok: true, v };
}

/** Dansk visning af en modelværdi i et inputfelt. */
export function visFelt(f: FeltDef, v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number') {
    const s = f.dec != null ? v.toFixed(f.dec) : String(Math.round(v * 1e6) / 1e6);
    return s.replace('.', ',');
  }
  return String(v);
}

export const FEJLTEKST: Record<string, (g?: number) => string> = {
  'ikke-tal': () => 'Ikke et tal (brug komma som decimaltegn).',
  'for-lav': (g) => `Skal være større end eller lig ${String(g).replace('.', ',')}.`,
  'for-hoej': (g) => `Må højst være ${String(g).replace('.', ',')}.`,
  'ikke-heltal': () => 'Skal være et heltal.',
  'paakraevet': () => 'Feltet må ikke være tomt.',
  'ugyldigt-valg': () => 'Ugyldigt valg.',
};

/** Sætter en værdi på en sti som "beton.armering.afskalning" i en model (muterer). */
export function saetSti(model: Record<string, any>, sti: string, v: unknown): void {
  const dele = sti.split('.');
  let o: any = model;
  for (let i = 0; i < dele.length - 1; i++) {
    if (o[dele[i]!] == null || typeof o[dele[i]!] !== 'object') o[dele[i]!] = {};
    o = o[dele[i]!];
  }
  o[dele[dele.length - 1]!] = v;
}
export const laesSti = (model: Record<string, any>, sti: string): unknown => sti.split('.').reduce<any>((o, k) => o?.[k], model);
