// Uafhængig verifikation: ny kerne mod håndregnede/Python-beregnede karakteristiske kapaciteter (verifikation/reference.py).
// Referencen er skrevet efter normens formler og deler ingen kode med kernen.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseIndstillinger } from './settings';
import { afledStaal } from './steel';
import { partialkoefficienter } from './partials';
import { beregnKombination, type Kernemodel } from './kombination';

const G = JSON.parse(readFileSync(new URL('../../../golden/cases.json', import.meta.url), 'utf8'));
const E = JSON.parse(readFileSync(new URL('../../../verifikation/expected.json', import.meta.url), 'utf8'));
const skabelon = G.cases.find((c: any) => c.resultat.tilstand === 'ok' && c.model.anker.type === 'indstoebt').model;

function byg(c: any): Kernemodel {
  const m = JSON.parse(JSON.stringify(skabelon));
  Object.assign(m.anker, { d: c.d, dnom: null, hef: c.hef, dh: c.dh, th: c.th, As: c.As, staalklasse: 'bruger', fuk: c.fuk, fyk: c.fyk, duktil: c.duktil });
  Object.assign(m.beton, { klasse: c.klasse, fck: null, revnet: c.revnet, h: c.h, kanter: c.kanter });
  m.plade = { bx: 600, by: 600, t: 20, hulfrigang: 'normal', afstandTilBeton: 0, mellemlaeg: 'ingen', indspaending: 'fri' };
  m.opstilling.anker = c.ankre.map((p: number[], i: number) => ({ id: i + 1, x: p[0], y: p[1], slids: null }));
  return m;
}

describe('verifikation mod uafhængig reference', () => {
  it.each(E as any[])('$navn', (c: any) => {
    const m = byg(c);
    const { indstillinger } = parseIndstillinger({});
    const st = afledStaal({ staalklasse: 'bruger', fuk: c.fuk, fyk: c.fyk, duktil: c.duktil, d: c.d, gevind: true, As: c.As });
    const p = partialkoefficienter(indstillinger, { type: 'indstoebt', fuk: st.fuk, fyk: st.fyk });
    const l = { N: c.last.N ?? 0, Vx: c.last.Vx ?? 0, Vy: c.last.Vy ?? 0, Mx: 0, My: 0, T: 0 };
    const r = beregnKombination(m as Kernemodel, st, p, indstillinger, l, 30000, 0);
    for (const [id, forventet] of Object.entries(c.forventet) as [string, number][]) {
      const b = r.brudformer.find((x) => x.id === id)!;
      const traekMode = id.startsWith('N_'), skydMode = id.startsWith('V_');
      if ((traekMode && l.N <= 0) || (skydMode && l.Vx === 0 && l.Vy === 0)) continue;
      expect(b.relevant, `${id} relevant`).toBe(true);
      expect(Math.abs(b.Rk - forventet) / forventet, `${id}: kerne ${b.Rk} vs reference ${forventet}`).toBeLessThan(1e-9);
      // Værdier trykt i en offentlig kommerciel rapport (Hilti PROFIS): kernen skal ramme dem inden for afrundingen
      const pub = c.publiceret?.[id];
      if (pub != null) expect(Math.abs(b.Rk - pub) / pub, `${id}: kerne ${b.Rk} vs publiceret ${pub} (${c.publiceret.kilde})`).toBeLessThan(c.publiceret.tolerance);
    }
  });
});
