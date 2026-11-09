// Interaktion mellem træk og forskydning (EN 1992-4, 7.2.3). Rene tal; ingen tekst.

export interface Udnyttelsespost { id: string; relevant: boolean; udnyttelse: number | null }

/** Største udnyttelse blandt de angivne brudformer (kun relevante). */
export function stoerste(poster: Udnyttelsespost[], ids: string[]): { beta: number; kilde: string | null } {
  let beta = 0, kilde: string | null = null;
  for (const id of ids) {
    const r = poster.find((p) => p.id === id && p.relevant && p.udnyttelse != null);
    if (r && r.udnyttelse! > beta) { beta = r.udnyttelse!; kilde = r.id; }
  }
  return { beta, kilde };
}

export interface StaalInteraktion { relevant: boolean; udnyttelse: number | null; styrendeAnker: number | null; betaN: number; betaV: number }

/** NV_s (7.54): βN² + βV² for det mest belastede anker (egne kræfter). */
export function interaktionStaal(p: { ankreIds: number[]; F: number[]; Veff: number[]; VRd_i: number[]; NRd_s: number }): StaalInteraktion {
  let bedst: { id: number; bN: number; bV: number; u: number } | null = null;
  p.ankreIds.forEach((id, i) => {
    const F = p.F[i]!, V = p.Veff[i] ?? 0;
    if (!(F > 0 && V > 0) || !(p.NRd_s > 0)) return;
    const bN = F / p.NRd_s;
    const bV = p.VRd_i[i]! > 0 ? V / p.VRd_i[i]! : Infinity;
    const u = bN * bN + bV * bV;
    if (!bedst || u > bedst.u) bedst = { id, bN, bV, u };
  });
  if (!bedst) return { relevant: false, udnyttelse: null, styrendeAnker: null, betaN: 0, betaV: 0 };
  const b = bedst as { id: number; bN: number; bV: number; u: number };
  return { relevant: true, udnyttelse: b.u, styrendeAnker: b.id, betaN: b.bN, betaV: b.bV };
}

export type ArmeringsTilfaelde = 'ingen' | 'traek' | 'forskydning' | 'begge';

export interface BetonInteraktion {
  id: 'NV_c' | 'NV_re'; relevant: boolean; udnyttelse: number | null; betaN: number; betaV: number;
  styrendeTraek: string | null; styrendeForskydning: string | null;
  ligning: '(7.55)' | '(7.56)' | '(7.57)'; I755?: number; I756?: number;
}

/** NV_c / NV_re (7.55, 7.56, 7.57). `poster` er alle øvrige brudformers udnyttelser. */
export function interaktionBeton(poster: Udnyttelsespost[], tilfaelde: ArmeringsTilfaelde, valg: 'gunstigst' | 'potens' | 'lineaer', k11: number): BetonInteraktion {
  const traek = tilfaelde === 'begge' || tilfaelde === 'traek' ? ['N_p', 'N_sp', 'N_cb', 'N_re', 'N_a', 'N_cre'] : ['N_p', 'N_c', 'N_sp', 'N_cb'];
  const forsk = tilfaelde === 'begge' ? ['V_cp', 'V_c', 'V_re', 'V_a'] : tilfaelde === 'traek' ? ['V_c', 'V_cp'] : tilfaelde === 'forskydning' ? ['V_cp', 'V_re', 'V_a', 'V_c'] : ['V_cp', 'V_c'];
  const a = stoerste(poster, traek), l = stoerste(poster, forsk);
  const c = a.beta, u = l.beta;
  const base = { betaN: c, betaV: u, styrendeTraek: a.kilde, styrendeForskydning: l.kilde };
  if (tilfaelde === 'traek' || tilfaelde === 'forskydning') {
    const id = 'NV_re' as const;
    if (!(c > 0 && u > 0)) return { id, relevant: false, udnyttelse: null, ligning: '(7.57)', ...base };
    const over = c > 1 || u > 1;
    return { id, relevant: true, udnyttelse: over ? Math.max(c, u, c ** k11 + u ** k11) : c ** k11 + u ** k11, ligning: '(7.57)', ...base };
  }
  const f = c ** 1.5 + u ** 1.5;
  const m = c <= 1 && u <= 1 ? (c + u) / 1.2 : Infinity;
  const ud = valg === 'potens' ? f : valg === 'lineaer' ? m : Math.min(f, m);
  const ligning = valg === 'potens' ? '(7.55)' : valg === 'lineaer' ? '(7.56)' : f <= m ? '(7.55)' : '(7.56)';
  const id = tilfaelde === 'begge' ? ('NV_re' as const) : ('NV_c' as const);
  if (!(c > 0 && u > 0)) return { id, relevant: false, udnyttelse: null, ligning, ...base };
  return { id, relevant: true, udnyttelse: ud, ligning, I755: f, I756: m, ...base };
}
