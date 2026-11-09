import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { beregnForslag, evaluer, forslagSpecs, loes } from './forslag';
import { saetSti } from './sti';

const G = JSON.parse(readFileSync(new URL('../../../golden/cases.json', import.meta.url), 'utf8'));
const modeller = G.cases.filter((c: any) => c.resultat.tilstand === 'ok' && c.resultat.maksUdnyttelse > 1.02 && c.resultat.maksUdnyttelse < 20).slice(0, 25).map((c: any) => c.model);

const FC = JSON.parse(readFileSync(new URL('../../../golden/forslag-cases.json', import.meta.url), 'utf8'));
const tal = (t: string) => Number(t.replace(',', '.'));

describe('justeringsforslag mod gammel app (facit)', () => {
  it.each<[number, any]>(FC.cases.map((c: any) => [c.id, c]))('model #%s: samme forslag i samme rækkefølge med samme η', (_id: number, c: any) => {
    const f = beregnForslag(c.model);
    expect(f.fejl).toBe(false);
    const ny = f.forslag.map((r) => ({ del: !r.hit, u: Math.round((r.hit ?? r.best!).u * 100) / 100, v: r.spec.art === 'tal' ? (r.hit ?? r.best!).v : null }));
    const gammel = c.rows.map((r: any) => {
      const u = tal(/η\S*\s*(?:=|til)\s*([\d,]+)/.exec(r.tekst.replace('maks', ''))?.[1] ?? 'NaN');
      const v = /→ ([\d.]+) (?:mm)/.exec(r.tekst)?.[1];
      return { del: r.del, u, v: v ? Number(v) : null };
    });
    expect(ny.map((x) => x.del)).toEqual(gammel.map((x: any) => x.del));
    ny.forEach((x, i) => expect(Math.abs(x.u - gammel[i].u), `række ${i}: ${x.u} vs ${gammel[i].u}`).toBeLessThan(0.0051));
    ny.forEach((x, i) => { if (x.v != null && gammel[i].v != null) expect(x.v).toBe(gammel[i].v); });
  });
});

describe('justeringsforslag', () => {
  it('der findes overbelastede modeller at teste på', () => { expect(modeller.length).toBeGreaterThan(10); });

  it('hvert fundet forslag giver η ≤ 1 når det anvendes, og tal-forslag er minimale', { timeout: 120000 }, () => {
    let hits = 0, tal = 0;
    for (const m of modeller) {
      const f = beregnForslag(m);
      expect(f.fejl).toBe(false);
      for (const r of f.forslag) {
        if (!r.hit) { expect(r.best!.u).toBeLessThan(f.u0); continue; }
        hits++;
        const n = structuredClone(m); for (const [p, v] of r.hit.ops) saetSti(n, p, v);
        const e = evaluer(n);
        expect(e?.ok, r.spec.noegle).toBe(true);
        if (r.spec.art === 'tal' && r.hit.v != null) {
          tal++;
          const mindre = r.spec.mk(r.hit.v - r.spec.step), e2 = evaluer((() => { const k = structuredClone(m); for (const [p, v] of mindre) saetSti(k, p, v); return k; })());
          if (r.hit.v - r.spec.step > r.spec.v0) expect(e2?.ok ?? false, `${r.spec.noegle} ikke minimal`).toBe(false);
        }
      }
    }
    expect(hits).toBeGreaterThan(10);
    expect(tal).toBeGreaterThan(0);
  });

  it('ændrer ikke inputmodellen', () => {
    const m = modeller[0]; const foer = JSON.stringify(m);
    beregnForslag(m);
    expect(JSON.stringify(m)).toBe(foer);
  });

  it('fejlbehæftet model giver fejl i stedet for forslag', () => {
    const m = structuredClone(modeller[0]); m.anker.hef = -5;
    expect(beregnForslag(m).fejl).toBe(true);
  });

  it('specs er kun relevante for modellens egen opstilling', () => {
    const s = forslagSpecs(modeller[0]).map((x) => x.noegle);
    expect(s).toContain('anker.hef');
    expect(new Set(s).size).toBe(s.length);
  });

  it('loes finder ingen løsning for en håbløs model', () => {
    const m = structuredClone(modeller[0]); m.laster.forEach((l: any) => { l.N = 1e9; });
    const r = beregnForslag(m);
    expect(r.forslag.filter((x) => x.hit)).toHaveLength(0);
    void loes;
  });
});
