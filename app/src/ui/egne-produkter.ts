// Egne produkter (andre leverandører): gemmes i browserens localStorage. Valgfrit: virker lagring ikke, fungerer programmet uden.
import type { EgetProdukt } from '../core/produkter';

const NOEGLE = 'anker-egne-produkter-v1';

export function laesEgneProdukter(): EgetProdukt[] {
  try {
    const raa = JSON.parse(localStorage.getItem(NOEGLE) ?? '[]');
    return Array.isArray(raa) ? raa.filter((p): p is EgetProdukt => !!p && typeof p.navn === 'string' && !!p.vaerdier && typeof p.vaerdier === 'object') : [];
  } catch { return []; }
}

/** Gemmer eller erstatter produktet med samme navn. Returnerer den nye liste. */
export function gemEgetProdukt(p: EgetProdukt, liste: EgetProdukt[] = laesEgneProdukter()): EgetProdukt[] {
  const ny = [...liste.filter((x) => x.navn !== p.navn), p].sort((a, b) => a.navn.localeCompare(b.navn, 'da'));
  try { localStorage.setItem(NOEGLE, JSON.stringify(ny)); } catch { /* fuld eller blokeret */ }
  return ny;
}

export function sletEgetProdukt(navn: string, liste: EgetProdukt[] = laesEgneProdukter()): EgetProdukt[] {
  const ny = liste.filter((x) => x.navn !== navn);
  try { localStorage.setItem(NOEGLE, JSON.stringify(ny)); } catch { /* ignorer */ }
  return ny;
}
