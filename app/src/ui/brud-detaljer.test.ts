import { describe, expect, it } from 'vitest';
import { standardModel } from '../core/indlaes';
import { beregnTilstand } from './state';
import { beregningsdetalje } from './brud-detaljer';

describe('beregning pr. brudform', () => {
  const t = beregnTilstand(structuredClone(standardModel('2026-01-01')));
  const k = t.resultat!.kombinationer[t.resultat!.styrendeKombination ?? 0]!.resultat;
  it('giver et spor for hver relevant brudform med tal og uden NaN', () => {
    const relevante = k.brudformer.filter((b) => b.relevant);
    expect(relevante.length).toBeGreaterThan(2);
    for (const b of relevante) {
      const d = beregningsdetalje(b.id, t.model, k)!;
      expect(d, b.id).toBeTruthy();
      expect(d.trin.length, b.id).toBeGreaterThan(1);
      const tekst = d.trin.map((x) => `${x.s} ${x.f ?? ''} ${x.v}`).join(' ');
      expect(tekst, b.id).not.toMatch(/NaN|undefined/);
    }
  });
  it('slutter med udnyttelsen, som i resultatlisten', () => {
    const b = k.brudformer.find((x) => x.id === 'N_c' && x.relevant);
    if (!b) return;
    const d = beregningsdetalje('N_c', t.model, k)!;
    expect(d.trin.at(-1)!.s).toBe('Udnyttelse');
    expect(d.trin.at(-1)!.v).toContain(String(Math.round(b.udnyttelse! * 100)).slice(0, 1));
  });
});
