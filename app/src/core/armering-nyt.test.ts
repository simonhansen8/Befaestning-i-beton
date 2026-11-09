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

import { dornDiameter, forankringsLaengde } from './reinforcement';
describe('forankringslængde og bukkediameter (EN 1992-1-1, 8.3 og 8.4.4)', () => {
  it('bukkediameter: 4⌀ til og med 16 mm, ellers 7⌀', () => {
    expect(dornDiameter(12)).toBe(48); expect(dornDiameter(16)).toBe(64); expect(dornDiameter(20)).toBe(140);
  });
  it('lbd = α·⌀/4·fyd/fbd, mindst max(0,3·lb,rqd; 10⌀; 100)', () => {
    // C30/37: fctk,0,05 = 2,0 MPa, γc = 1,5 → fctd = 1,333; fbd = 2,25·1·1·1,333 = 3,0 MPa; fyd = 500/1,15 = 434,8
    const r = forankringsLaengde({ fck: 30, eta1: 1, ds: 12, fyk: 500, gammaS: 1.15, krog: false, cd: null, alphaCt: 1, gammaCt: 1.5 });
    expect(r.fbd).toBeCloseTo(3.0, 1);
    expect(r.lbRqd).toBeCloseTo((12 / 4) * (500 / 1.15 / r.fbd), 6);
    expect(r.lbd).toBeCloseTo(r.lbRqd, 6); // α = 1: ingen reduktion
    const b = forankringsLaengde({ fck: 30, eta1: 1, ds: 12, fyk: 500, gammaS: 1.15, krog: true, cd: 50, alphaCt: 1, gammaCt: 1.5 });
    expect(b.alpha).toBe(0.7); expect(b.lbd).toBeCloseTo(0.7 * r.lbRqd, 6);
    const halv = forankringsLaengde({ fck: 30, eta1: 1, ds: 12, fyk: 500, gammaS: 1.15, krog: false, cd: null, alphaCt: 1, gammaCt: 1.5, udnyttelse: 0.5 });
    expect(halv.sigmaSd).toBeCloseTo(r.fyd / 2, 6); expect(halv.lbd).toBeCloseTo(r.lbd / 2, 6); // σsd følger armeringens udnyttelse
    const lav = forankringsLaengde({ fck: 30, eta1: 1, ds: 12, fyk: 20, gammaS: 1.15, krog: false, cd: null, alphaCt: 1, gammaCt: 1.5 });
    expect(lav.lbd).toBe(120); // 10⌀ er mindstekravet
  });
  it('resultatet indeholder lbd for aktiv ankerarmering og intet ellers', () => {
    const m = kopi();
    expect(beregnTilstand(m).resultat!.kombinationer[0]!.resultat.forank).toEqual({ T: null, V: null });
    m.beton.armering.ankerarmeringTraek.aktiv = true;
    const f = beregnTilstand(m).resultat!.kombinationer[0]!.resultat.forank;
    expect(f.T!.lbd).toBeGreaterThan(120); expect(f.V).toBeNull();
  });
});
