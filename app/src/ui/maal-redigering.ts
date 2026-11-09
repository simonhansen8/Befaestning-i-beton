// Ret et mål i 3D-visningen: oversætter målets felt-id og ny værdi til en ændring af modellen. Ren funktion.
import { genererAnkre } from '../core/opstilling';
import { saetSti } from '../core/sti';
import type { Model } from './skema-typer';

const DIREKTE: Record<string, string> = { hef: 'anker.hef', h: 'beton.h', bx: 'plade.bx', by: 'plade.by', t: 'plade.t', e: 'plade.afstandTilBeton' };
const KANTER = ['xNeg', 'xPos', 'yNeg', 'yPos'] as const;

/** Kan målet rettes, og hvorfor ikke (til tooltip). */
export function maalRedigerbarhed(m: Model, felt: string): { ok: true } | { ok: false; hvorfor: string } {
  if (felt in DIREKTE || felt.startsWith('c:')) return { ok: true };
  if (felt === 'sx' || felt === 'sy') {
    const mo = m.opstilling.type as string;
    const bruger = (mo === '2x' && felt === 'sx') || (mo === '2y' && felt === 'sy') || ['4', '6', '8', '9'].includes(mo);
    return bruger ? { ok: true } : { ok: false, hvorfor: 'Boltene er placeret frit eller i et mønster uden dette mål. Ret koordinaterne i Opstilling.' };
  }
  return { ok: false, hvorfor: 'Dette mål kan ikke rettes her.' };
}

/** Anvender ny værdi [mm] på modellen (muterer). Returnerer false, hvis værdien er ugyldig eller målet ikke kan rettes. */
export function anvendMaal(m: Model, felt: string, ny: number): boolean {
  if (!Number.isFinite(ny) || ny < 0 || (ny === 0 && felt !== 'e')) return false;
  if (!maalRedigerbarhed(m, felt).ok) return false;
  if (felt in DIREKTE) { saetSti(m, DIREKTE[felt]!, ny); return true; }
  if (felt === 'sx' || felt === 'sy') {
    saetSti(m, `opstilling.${felt}`, ny);
    m.opstilling.anker = genererAnkre(m.opstilling as never) as never;
    return true;
  }
  const kant = felt.slice(2) as (typeof KANTER)[number];
  if (!KANTER.includes(kant)) return false;
  const ankre = m.opstilling.anker as { x: number; y: number }[];
  const gammel = (m.beton.kanter as Record<string, number | null>)[kant];
  if (gammel == null || !ankre.length) return false;
  const afst = (q: { x: number; y: number }) => (kant === 'xNeg' ? q.x + gammel : kant === 'xPos' ? gammel - q.x : kant === 'yNeg' ? q.y + gammel : gammel - q.y);
  const c = Math.min(...ankre.map(afst));
  saetSti(m, `beton.kanter.${kant}`, gammel + (ny - c));
  return true;
}
