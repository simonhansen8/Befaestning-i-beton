import { describe, expect, it } from 'vitest';
import { ecmAfFck } from './concrete';
import { gamma3, parseIndstillinger, youngBeton } from './settings';
import { partialkoefficienter } from './partials';

describe('γ3', () => {
  it('udledes af kontrolklassen som standard', () => {
    expect(gamma3(parseIndstillinger({}).indstillinger)).toBe(1);
    expect(gamma3(parseIndstillinger({ kontrolklasse: 'lempet' }).indstillinger)).toBe(1.1);
  });
  it('kan overstyres manuelt og slår igennem i partialkoefficienterne', () => {
    const { indstillinger } = parseIndstillinger({ gamma3: 1.15 });
    expect(gamma3(indstillinger)).toBe(1.15);
    const p = partialkoefficienter(indstillinger, { type: 'indstoebt', fuk: 800, fyk: 640 });
    expect(p.gammaMc).toBeCloseTo(1.45 * 1.15, 12);
  });
  it('manuel overstyring vinder over kontrolklassen', () => {
    expect(gamma3(parseIndstillinger({ kontrolklasse: 'lempet', gamma3: 1.2 }).indstillinger)).toBe(1.2);
  });
  it('γ3 < 1 afvises med advarsel og sættes til 1,0', () => {
    const r = parseIndstillinger({ gamma3: 0.95 });
    expect(gamma3(r.indstillinger)).toBe(1);
    expect(r.bemaerkninger.some((b) => b.felt === 'indstillinger.gamma3')).toBe(true);
  });
});

describe('Ec', () => {
  it('styres af betonklassen (Tabel 3.1)', () => {
    const i = parseIndstillinger({}).indstillinger;
    expect(youngBeton(i, 20)).toBe(30000);
    expect(youngBeton(i, 30)).toBe(33000);
    expect(youngBeton(i, 50)).toBe(37000);
    expect(youngBeton(i, 50)).toBeGreaterThan(youngBeton(i, 20));
  });
  it('kan overstyres manuelt', () => {
    expect(youngBeton(parseIndstillinger({ Ec: 28000 }).indstillinger, 50)).toBe(28000);
  });
  it('interpolerer med formel for ukendt fck', () => {
    expect(ecmAfFck(32)).toBeGreaterThan(ecmAfFck(30));
    expect(ecmAfFck(32)).toBeLessThan(ecmAfFck(35));
  });
});
