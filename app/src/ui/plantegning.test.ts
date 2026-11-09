import { describe, expect, it } from 'vitest';
import { plantegningSvg } from './plantegning';
import { Store } from './state';
import { standardModel } from '../core/indlaes';

describe('plantegning', () => {
  const s = new Store(standardModel('2026-01-01'));
  const t = s.tilstand;
  const svg = plantegningSvg(t.model, t.resultat!.kombinationer[0]!.resultat);
  it('er gyldig SVG med én cirkel pr. bolt (plus evt. resultant)', () => {
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    const bolte = (svg.match(/<title>Bolt /g) ?? []).length;
    expect(bolte).toBe(t.model.opstilling.anker.length);
  });
  it('kan tegnes uden resultat og uden kanter', () => {
    const m = structuredClone(t.model);
    m.beton.kanter = { xNeg: null, xPos: null, yNeg: null, yPos: null };
    expect(plantegningSvg(m, null)).toContain('<rect');
  });
});
