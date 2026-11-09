import { describe, expect, it } from 'vitest';
import { rapportHtml, esc } from './rapport';
import { Store } from './state';
import { standardModel } from '../core/indlaes';

describe('rapport', () => {
  const m = standardModel('2026-01-01');
  m.projekt.navn = 'Test <script>alert(1)</script> & co';
  const s = new Store(m);
  const html = rapportHtml(s.tilstand.model, s.tilstand.resultat, '2026-11-09.1', '2026-01-01');
  it('escaper brugertekst', () => {
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(esc('a&b')).toBe('a&amp;b');
  });
  it('indeholder alle lastkombinationer, brudformer og normgrundlag', () => {
    for (const l of s.tilstand.model.laster) expect(html).toContain(l.navn);
    for (const b of s.tilstand.resultat!.kombinationer[0]!.resultat.brudformer.filter((x) => x.relevant)) expect(html).toContain(b.id);
    expect(html).toContain('DS/EN 1992-4:2018');
    expect(html).toContain('build 2026-11-09.1');
  });
  it('inddata følger formularens felter (fx hef og betonklasse)', () => {
    expect(html).toContain('Effektiv forankringsdybde');
    expect(html).toContain('C30/37');
  });
  it('kan lave rapport uden resultat', () => {
    expect(rapportHtml(s.tilstand.model, null, 'x')).toContain('kunne ikke beregnes');
  });
});
