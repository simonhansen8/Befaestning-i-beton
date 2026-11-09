// Lokal autogem (localStorage) og tema. Alt er valgfrit: virker ikke lagring, fungerer programmet uden.
const NOEGLE = 'anker-projekt-v1', TEMA = 'anker-tema';

export function laesGemt(): string | null { try { return localStorage.getItem(NOEGLE); } catch { return null; } }
export function gemLokalt(json: string): void { try { localStorage.setItem(NOEGLE, json); } catch { /* fuld eller blokeret */ } }
export function glemGemt(): void { try { localStorage.removeItem(NOEGLE); } catch { /* ignorer */ } }

export type Tema = 'lys' | 'moerk' | 'system';
export function laesTema(): Tema { try { const t = localStorage.getItem(TEMA); return t === 'lys' || t === 'moerk' ? t : 'system'; } catch { return 'system'; } }
export function saetTema(t: Tema, rod: HTMLElement = document.documentElement): void {
  if (t === 'system') rod.removeAttribute('data-tema'); else rod.setAttribute('data-tema', t);
  try { if (t === 'system') localStorage.removeItem(TEMA); else localStorage.setItem(TEMA, t); } catch { /* ignorer */ }
}
export const naesteTema = (t: Tema): Tema => (t === 'system' ? 'moerk' : t === 'moerk' ? 'lys' : 'system');
