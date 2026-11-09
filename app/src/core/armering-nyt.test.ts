import { describe, expect, it } from 'vitest';
import { standardModel } from './indlaes';
import { beregnTilstand } from '../ui/state';

const kopi = () => structuredClone(standardModel('2026-01-01')) as any;
describe('forudsætninger a/e/f og bøjleafstand', () => {
  it('advarsel indtil a, e og f er bekræftet; derefter kun info', () => {
    const m = kopi(); m.beton.armering.ankerarmeringTraek = { ...m.beton.armering.ankerarmeringTraek, aktiv: true, foering: 'stoed' };
    const kode = (mm: any) => beregnTilstand(mm).diagnostik.filter((d) => d.kode.startsWith('ankerarmering-traek-'));
    expect(kode(m).map((d) => d.kode)).toContain('ankerarmering-traek-forbehold');
    expect(kode(m).find((d) => d.kode === 'ankerarmering-traek-forbehold')!.data.mangler).toBe('a, e, f');
    m.beton.armering.ankerarmeringTraek.bekraeft = { a: true, e: true, f: true };
    expect(kode(m).some((d) => d.kode === 'ankerarmering-traek-forbehold')).toBe(false);
    expect(kode(m).some((d) => d.kode === 'ankerarmering-traek-bekraeftet')).toBe(true);
    m.beton.armering.ankerarmeringTraek.foering = 'ingen'; m.beton.armering.ankerarmeringTraek.bekraeft = { a: true, e: false, f: true };
    expect(kode(m).some((d) => d.kode === 'ankerarmering-traek-bekraeftet')).toBe(true); // e kræves kun ved stød
  });
  it('bøjleafstanden afgør hvilke bøjler der er inden for 0,5·c1', () => {
    const m = kopi(); m.beton.kanter.xNeg = 300;
    m.beton.armering.ankerarmeringForskydning = { ...m.beton.armering.ankerarmeringForskydning, aktiv: true, type: 'boejle', antalBoejler: 4, diameter: 10, afstandBoejler: null };
    const v = (mm: any) => { const t = beregnTilstand(mm); const k = t.resultat!.kombinationer[0]!.resultat; return k.armV; };
    expect(v(m).boejler).toBeNull();
    const alle = v(m).antalVirksomme;
    m.beton.armering.ankerarmeringForskydning.afstandBoejler = 100;
    const med = v(m);
    expect(med.boejler!.length).toBe(4);
    expect(med.boejler!.map((b) => b.pos)).toEqual([0, 100, 200, 300]);
    expect(med.boejler!.filter((b) => b.virksom).length).toBeLessThan(4);
    expect(med.antalVirksomme).toBeLessThan(alle);
  });
});

describe('forskydningslastens højde over beton', () => {
  it('større højde giver større løftestangsarm og dermed lavere VRd,s; tomt felt er uændret', () => {
    const m = kopi(); m.plade.afstandTilBeton = 20; m.laster[0].Vx = 5e3; m.laster[0].N = 0;
    const vrd = (mm: any) => beregnTilstand(mm).resultat!.kombinationer[0]!.resultat.brudformer.find((b: any) => b.id === 'V_s')!.Rd;
    const a = vrd(m);
    m.plade.lasthoejde = m.plade.afstandTilBeton + m.plade.t / 2; // samme som standard
    expect(vrd(m)).toBeCloseTo(a, 6);
    m.plade.lasthoejde = 120;
    expect(vrd(m)).toBeLessThan(a);
  });
});
