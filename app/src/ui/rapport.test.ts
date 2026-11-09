import { describe, expect, it } from 'vitest';
import { rapportHtml, rapportTekst, esc } from './rapport';
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
  it('ligninger medtages kun efter valg og når beregningssporet findes', () => {
    const detalje = (id: string) => ({ id, titel: 'Prøvetitel ' + id, ref: 'EN 1992-4, 7.x', trin: [{ s: 'Trinbeskrivelse', f: 'N<sub>Rk</sub> = k · √f<sub>ck</sub>', v: '= 12,3 kN' }], noter: [] });
    const med = rapportHtml(s.tilstand.model, s.tilstand.resultat, 'x', '2026-01-01', { ligninger: true, detalje });
    const uden = rapportHtml(s.tilstand.model, s.tilstand.resultat, 'x', '2026-01-01', { ligninger: false, detalje });
    expect(med).toContain('Trinbeskrivelse');
    expect(med).toContain('N<sub>Rk</sub> = k');
    expect(uden).not.toContain('Trinbeskrivelse');
    expect(rapportHtml(s.tilstand.model, s.tilstand.resultat, 'x', '2026-01-01', { ligninger: true })).not.toContain('class="ligning"');
  });
  it('kan lave rapport uden resultat', () => {
    expect(rapportHtml(s.tilstand.model, null, 'x')).toContain('kunne ikke beregnes');
  });
  it('tekstrapport har konklusion, kombinationer og styrende brudform', () => {
    const t = rapportTekst(s.tilstand.model, s.tilstand.resultat, 'b1', '2026-01-01');
    expect(t).toMatch(/OPFYLDT|IKKE/);
    for (const l of s.tilstand.model.laster) expect(t).toContain(l.navn);
    expect(t).toContain('← styrende');
    expect(rapportTekst(s.tilstand.model, null, 'b1')).toContain('kunne ikke beregnes');
  });
});
