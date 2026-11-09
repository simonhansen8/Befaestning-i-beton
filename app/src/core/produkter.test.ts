import { describe, expect, it } from 'vitest';
import { hiltiHY200V3, STOERRELSER, tilOpdateringer } from './produkter';

describe('Hilti HIT-HY 200 V3 (ETA-19/0601)', () => {
  it('matcher aflæste værdier fra bilag B2 og C1', () => {
    const m8 = hiltiHY200V3(8, 'I', 'toert-vaadt');
    expect(m8).toMatchObject({ d0: 10, hefMin: 60, hefMax: 160, smin: 40, cmin: 40, tauRkCr: 7.5, tauRkUcr: 18, psi0Sus: 0.8, gammaInst: 1.0 });
    expect(hiltiHY200V3(12, 'II', 'toert-vaadt')).toMatchObject({ tauRkCr: 8.0, tauRkUcr: 15, psi0Sus: 0.89, d0: 14 });
    expect(hiltiHY200V3(30, 'III', 'toert-vaadt')).toMatchObject({ tauRkCr: 6.9, tauRkUcr: 13, psi0Sus: 0.72, hefMax: 600, cmin: 80 });
    expect(hiltiHY200V3(16, 'I', 'vandfyldt')).toMatchObject({ tauRkCr: 6.7, tauRkUcr: 13.0, gammaInst: 1.4 });
  });
  it('urevnet ≥ revnet for alle kombinationer', () => {
    for (const d of STOERRELSER) for (const t of ['I', 'II', 'III'] as const) for (const h of ['toert-vaadt', 'vandfyldt'] as const) {
      const p = hiltiHY200V3(d, t, h);
      expect(p.tauRkUcr).toBeGreaterThanOrEqual(p.tauRkCr);
      expect(p.hefMax).toBeGreaterThan(p.hefMin);
    }
  });
  it('giver stier under anker.*', () => {
    expect(tilOpdateringer(hiltiHY200V3(10, 'I', 'toert-vaadt')).every(([s]) => s.startsWith('anker.'))).toBe(true);
  });
});
