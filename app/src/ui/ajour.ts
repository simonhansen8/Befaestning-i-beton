// Ajour-mærkat: sammenligner programmets version med seneste på main (app/VERSION) og viser åbne PR'er.
export const REPO = 'simonhansen8/Befaestning-i-beton';
export interface PrInfo { number: number; title: string; html_url: string; draft?: boolean }
export interface Hentet { seneste: string | null; prs: PrInfo[] | null; commit: { tekst: string; dato: string } | null }
export type AjourTilstand = 'check' | 'old' | 'pending' | 'ok' | 'off';
export interface AjourStatus { tilstand: AjourTilstand; etiket: string; seneste: string | null; prs: PrInfo[]; commit: Hentet['commit']; prsUkendt: boolean }

/** Ren vurdering: ingen netværk. */
export function vurderVersion(min: string, h: Hentet | null): AjourStatus {
  if (!h || h.seneste == null) return { tilstand: 'off', etiket: `Version ${min} (ikke tjekket)`, seneste: null, prs: [], commit: null, prsUkendt: true };
  const prs = h.prs ?? [], prsUkendt = h.prs == null;
  if (h.seneste !== min) return { tilstand: 'old', etiket: 'Ny version findes', seneste: h.seneste, prs, commit: h.commit, prsUkendt };
  if (prs.length) return { tilstand: 'pending', etiket: `Opdateret · ${prs.length} på vej`, seneste: h.seneste, prs, commit: h.commit, prsUkendt };
  return { tilstand: 'ok', etiket: 'Opdateret', seneste: h.seneste, prs, commit: h.commit, prsUkendt };
}

async function json<T>(url: string): Promise<T | null> {
  try { const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } }); return r.ok ? ((await r.json()) as T) : null; } catch { return null; }
}

export async function hentSeneste(): Promise<Hentet | null> {
  let seneste: string | null = null;
  // API'et først: raw.githubusercontent.com cacher op til fem minutter og kan vise en ældre version end main.
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/app/VERSION?ref=main`, { headers: { Accept: 'application/vnd.github.raw+json' } });
    if (r.ok) seneste = (await r.text()).trim();
  } catch { /* offline eller begrænset */ }
  if (!seneste) {
    try {
      const r = await fetch(`https://raw.githubusercontent.com/${REPO}/main/app/VERSION?t=${Date.now()}`);
      if (r.ok) seneste = (await r.text()).trim();
    } catch { /* offline */ }
  }
  if (!seneste) return null;
  const [prs, commits] = await Promise.all([
    json<PrInfo[]>(`https://api.github.com/repos/${REPO}/pulls?state=open&per_page=20`),
    json<{ commit: { message: string; author: { date: string } } }[]>(`https://api.github.com/repos/${REPO}/commits?sha=main&per_page=1`),
  ]);
  const c = commits?.[0];
  return { seneste, prs, commit: c ? { tekst: c.commit.message.split('\n')[0] ?? '', dato: c.commit.author.date.slice(0, 10) } : null };
}
