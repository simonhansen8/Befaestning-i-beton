// Partialkoefficienter kontrolleret mod DS/EN 1992-4 DK NA:2024, Tabel 4.1 (vedvarende og midlertidige dimensioneringstilfælde).
// Forventede tal er regnet i hånden ud fra tabellens formler, ikke fra kernen.
import { describe, expect, it } from 'vitest';
import { parseIndstillinger } from './settings';
import { partialkoefficienter } from './partials';

const { indstillinger } = parseIndstillinger({});
const p = (fuk: number, fyk: number) => partialkoefficienter(indstillinger, { type: 'indstoebt', fuk, fyk });

describe('DK NA:2024 Tabel 4.1', () => {
  it('γMs i træk = 1,2·fuk/fyk, mindst 1,5', () => {
    expect(p(400, 240).gammaMs).toBeCloseTo(1.2 * (400 / 240), 12);   // 2,0
    expect(p(800, 640).gammaMs).toBeCloseTo(1.5, 12);                 // 1,2·1,25 = 1,5
    expect(p(1000, 900).gammaMs).toBe(1.5);                           // 1,333 → mindst 1,5
  });
  it('γMs i forskydning = 1,00·fuk/fyk, mindst 1,35, når fuk ≤ 800 og fyk/fuk ≤ 0,8; ellers 1,65', () => {
    expect(p(400, 240).gammaMsV).toBeCloseTo(400 / 240, 12);          // 1,667
    expect(p(500, 400).gammaMsV).toBe(1.35);                          // fyk/fuk = 0,8 → 1,25 → mindst 1,35
    expect(p(800, 640).gammaMsV).toBe(1.35);
    expect(p(1000, 900).gammaMsV).toBe(1.65);                         // fuk > 800
    expect(p(700, 600).gammaMsV).toBe(1.65);                          // fyk/fuk = 0,857 > 0,8
  });
  it('γMc = γc·γinst = 1,45 for indstøbte bolte; γMsp = γMp = γMc; γMs,re = 1,20', () => {
    const k = p(800, 640);
    expect(k.gammaMc).toBe(1.45);
    expect(k.gammaMsp).toBe(k.gammaMc);
    expect(k.gammaMp).toBe(k.gammaMc);
    expect(k.gammaMsRe).toBe(1.2);
  });

  describe('ulykke og seismik (højre kolonne)', () => {
    const { indstillinger: ul } = parseIndstillinger({ situation: 'ulykke', kontrolklasse: 'lempet' });
    const q = (fuk: number, fyk: number) => partialkoefficienter(ul, { type: 'indstoebt', fuk, fyk });
    it('γMs i træk = 1,05·fuk/fyk, mindst 1,35', () => {
      expect(q(400, 240).gammaMs).toBeCloseTo(1.05 * (400 / 240), 12);
      expect(q(800, 640).gammaMs).toBe(1.35);                      // 1,05·1,25 = 1,3125 → mindst 1,35
    });
    it('γMs i forskydning = 1,00·fuk/fyk ≥ 1,35, ellers 1,45', () => {
      expect(q(400, 240).gammaMsV).toBeCloseTo(400 / 240, 12);
      expect(q(1000, 900).gammaMsV).toBe(1.45);
    });
    it('γc = 1,00 (γ3 indgår ikke, heller ikke ved lempet kontrol), γMs,re = 1,00', () => {
      const k = q(800, 640);
      expect(k.gamma3).toBe(1);
      expect(k.gammaMc).toBe(1);
      expect(k.gammaMsRe).toBe(1);
    });
    it('standard er vedvarende/midlertidig', () => { expect(parseIndstillinger({}).indstillinger.situation).toBe('varig'); });
  });
});
