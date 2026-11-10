import { describe, expect, it } from 'vitest';
import { standardModel } from './indlaes';
import { beregnTilstand } from '../ui/state';

const kopi = () => structuredClone(standardModel('2026-01-01')) as any;
const kor = (mut: (m: any) => void) => {
  const m = kopi(); m.beton.kanter.xNeg = 300;
  m.beton.armering.ankerarmeringForskydning = { ...m.beton.armering.ankerarmeringForskydning, aktiv: true, type: 'overflade', diameter: 10, fyk: 500, krog: true };
  mut(m);
  return beregnTilstand(m).resultat!.kombinationer[0]!.resultat;
};

describe('kantstang efter fig. 7.10 a (trykstivermodel)', () => {
  it('uden diameter eftervises kantstangen ikke', () => {
    expect(kor(() => {}).brudformer.some((b: any) => b.id === 'V_ek')).toBe(false);
  });
  it('T_ek = NEd/n · tan α og kapacitet As·fyk/γs', () => {
    const k = kor((m) => { m.beton.armering.ankerarmeringForskydning.kantstangDiameter = 12; });
    const re = k.brudformer.find((b: any) => b.id === 'V_re')!, ek = k.brudformer.find((b: any) => b.id === 'V_ek')!;
    expect(ek).toBeDefined();
    const n = k.armV.antalVirksomme;
    expect(ek.Ed).toBeCloseTo(re.Ed / n, 6); // α = 45° → tan α = 1
    expect(ek.Rk).toBeCloseTo((Math.PI / 4) * 144 * 500, 6);
    expect(ek.Rd).toBeLessThan(ek.Rk);
  });
  it('trykstivervinklen skalerer trækket med tan α', () => {
    const a = kor((m) => { m.beton.armering.ankerarmeringForskydning.kantstangDiameter = 12; });
    const b = kor((m) => { m.beton.armering.ankerarmeringForskydning.kantstangDiameter = 12; m.beton.armering.ankerarmeringForskydning.trykstiverVinkel = 30; });
    const T = (k: any) => k.brudformer.find((x: any) => x.id === 'V_ek').Ed;
    expect(T(b) / T(a)).toBeCloseTo(Math.tan((30 * Math.PI) / 180), 9);
  });
});
