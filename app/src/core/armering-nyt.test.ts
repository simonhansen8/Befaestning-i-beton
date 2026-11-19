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

import { byg3d } from '../ui/model3d';
import { indlaesProjekt } from './inddata';
describe('gennemgang af armeringen (beregning og 3D stemmer overens)', () => {
  const enkelt = (h = 300) => {
    const m = kopi(); m.beton.h = h; m.beton.kanter = { xNeg: 150, xPos: null, yNeg: null, yPos: null };
    m.opstilling.type = '1'; m.opstilling.anker = [{ id: 1, x: 0, y: 0, slids: null }]; m.plade.bx = 200; m.plade.by = 200;
    return m;
  };
  it('lbd for forskydningsarmering bruger samme η1 som V_a (automatisk 0,7 for h > 250 mm)', () => {
    const m = enkelt(300); m.laster = [{ navn: 'L', N: 0, Vx: -40e3, Vy: 0, Mx: 0, My: 0, T: 0, alphaSus: 0 }];
    m.beton.armering.ankerarmeringForskydning = { ...m.beton.armering.ankerarmeringForskydning, aktiv: true, type: 'boejle', diameter: 12, antalBoejler: 1, eta1: null };
    const k = beregnTilstand(m).resultat!.kombinationer[0]!.resultat;
    expect(k.armV.eta1).toBe(0.7);
    const fbd1 = forankringsLaengde({ fck: 30, eta1: 1, ds: 12, fyk: 500, gammaS: 1.2, krog: false, cd: null, alphaCt: 1, gammaCt: 1.7 }).fbd;
    expect(k.forank.V!.fbd).toBeCloseTo(0.7 * fbd1, 6);
    m.beton.h = 250;
    expect(beregnTilstand(m).resultat!.kombinationer[0]!.resultat.forank.V!.fbd).toBeCloseTo(fbd1, 6);
  });
  it('⌀ > 16 mm gør også bøjler og løkker til forskydning ikke virksomme', () => {
    const m = enkelt(); m.laster = [{ navn: 'L', N: 0, Vx: -40e3, Vy: 0, Mx: 0, My: 0, T: 0, alphaSus: 0 }];
    for (const type of ['boejle', 'loekke', 'overflade']) {
      m.beton.armering.ankerarmeringForskydning = { ...m.beton.armering.ankerarmeringForskydning, aktiv: true, type, diameter: 20 };
      expect(beregnTilstand(m).resultat!.kombinationer[0]!.resultat.armV.mangler).toContain('dia-over-16');
    }
  });
  it('trækarmering: benene skal forankres lbd uden for keglen; 3D tegner dem til samme dybde som N_cre', () => {
    const m = enkelt(500); m.beton.kanter.xNeg = null; m.laster = [{ navn: 'L', N: 100e3, Vx: 0, Vy: 0, Mx: 0, My: 0, T: 0, alphaSus: 0 }];
    m.beton.armering.ankerarmeringTraek = { ...m.beton.armering.ankerarmeringTraek, aktiv: true, diameter: 12, antalBoejler: 2, afstand: 50, foering: 'ingen', forankringsdybde: null };
    const t = beregnTilstand(m), k = t.resultat!.kombinationer[0]!.resultat;
    expect(k.forankT!.antaget).toBe(true);
    expect(k.forankT!.endeDybde).toBe(m.anker.hef);
    const d = t.diagnostik.find((x) => x.kode === 'traekarmering-lbd-for-kort')!;
    expect(d.niveau).toBe('advarsel');
    expect(Number(d.data.kraevet)).toBeCloseTo(k.forankT!.keglDybde + k.forank.T!.lbd, 6);
    // 3D: benene ender i hef (som N_cre regner), ikke i keglen + lbd
    const bund = () => Math.min(...(byg3d(indlaesProjekt(m as never).model, k as never, null).dele.filter((x: any) => x.type === 'stang' && !x.variant) as any[]).flatMap((x) => [x.fra[2], x.til[2]]));
    expect(bund()).toBeCloseTo(-m.anker.hef, 6);
    // med tilstrækkelig dybde forsvinder advarslen, og 3D følger dybden
    m.beton.armering.ankerarmeringTraek.forankringsdybde = Math.ceil(k.forankT!.kraevetDybde);
    const t2 = beregnTilstand(m), k2 = t2.resultat!.kombinationer[0]!.resultat;
    expect(t2.diagnostik.some((x) => x.kode === 'traekarmering-lbd-for-kort')).toBe(false);
    expect(Math.min(...(byg3d(indlaesProjekt(m as never).model, k2 as never, null).dele.filter((x: any) => x.type === 'stang' && !x.variant) as any[]).flatMap((x) => [x.fra[2], x.til[2]]))).toBeCloseTo(-Math.ceil(k.forankT!.kraevetDybde), 6);
    // N_cre regnes med den angivne dybde
    expect(k2.brudformer.find((b) => b.id === 'N_cre')!.Rk).toBeGreaterThan(k.brudformer.find((b) => b.id === 'N_cre')!.Rk);
    // dybere end elementet: advarsel
    m.beton.armering.ankerarmeringTraek.forankringsdybde = 480;
    expect(beregnTilstand(m).diagnostik.some((x) => x.kode === 'traekarmering-for-dyb')).toBe(true);
  });
  it('advarer om dæklag mindre end cnom for ankerarmeringen', () => {
    const m = enkelt(); m.beton.cnom = 35;
    m.beton.armering.ankerarmeringTraek = { ...m.beton.armering.ankerarmeringTraek, aktiv: true, diameter: 12, daeklagTop: 40 };
    expect(beregnTilstand(m).diagnostik.some((x) => x.kode === 'armering-daeklag-for-lille' && x.felt === 'beton.armering.ankerarmeringTraek.daeklagTop')).toBe(true);
    m.beton.armering.ankerarmeringTraek.daeklagTop = 41;
    expect(beregnTilstand(m).diagnostik.some((x) => x.kode === 'armering-daeklag-for-lille')).toBe(false);
  });
  it('mellemresultater til beregningsvisningen: fbd og α for N_a, es og z for V_re', () => {
    const m = enkelt(300); m.laster = [{ navn: 'L', N: 0, Vx: -40e3, Vy: 0, Mx: 0, My: 0, T: 0, alphaSus: 0 }];
    m.beton.armering.ankerarmeringForskydning = { ...m.beton.armering.ankerarmeringForskydning, aktiv: true, type: 'boejle', diameter: 12, antalBoejler: 1, daekToAkse: 40, es: null };
    const k = beregnTilstand(m).resultat!.kombinationer[0]!.resultat;
    expect(k.detaljer.V_re!.es).toBeCloseTo(0 + 25 + 40, 6); // e + t + zs
    expect(k.detaljer.V_re!.z).toBeCloseTo(0.85 * Math.min(300 - 30, 2 * 180, 2 * 150), 6);
    const vre = k.brudformer.find((b) => b.id === 'V_re')!;
    expect(vre.Ed).toBeCloseTo((k.detaljer.V_re!.es / k.detaljer.V_re!.z + 1) * k.detaljer.V_re!.VEd, 6);
  });
});

describe('overfladearmering for forskydning er ét fysisk stangsæt', () => {
  const raekke = (s: number, benPr = 3, x = 50) => {
    const m = kopi(); m.opstilling = { type: 'fri', anker: [] as any[] };
    let id = 1;
    for (const ax of [-60, 60]) for (const y of [-s, 0, s]) m.opstilling.anker.push({ id: id++, x: ax, y, slids: null });
    m.beton.kanter = { xNeg: 300, xPos: null, yNeg: null, yPos: null };
    m.plade.bx = 240; m.plade.by = 2 * s + 120;
    m.laster = [{ navn: 'L', N: 0, Vx: -60e3, Vy: 0, Mx: 0, My: 0, T: 0, alphaSus: 0 }];
    Object.assign(m.beton.armering.ankerarmeringForskydning, { aktiv: true, type: 'overflade', diameter: 10, benPrAnker: benPr, fyk: 550, afstand: x, daekToAkse: 40, stangAfstand: null });
    return m;
  };
  const res = (m: any) => beregnTilstand(m).resultat!.kombinationer[0]!.resultat;
  it('ankre langt fra hinanden: hvert anker har sine egne stænger (som før)', () => {
    const k = res(raekke(240));
    expect(k.armV.staenger!.map((s) => s.v).sort((a, b) => a - b)).toEqual([-50, 50, 100]);
    expect(k.armV.ben).toBe(3);
    expect(k.armV.alle).toHaveLength(9);
    expect([k.armV.sammenfald, k.armV.konflikter, k.armV.delte]).toEqual([0, 0, 0]);
  });
  it('tætte ankre: sammenfaldende stænger tælles én gang, og stænger gennem et anker regnes ikke med', () => {
    const fjern = res(raekke(240)), taet = res(raekke(100));
    // ankre 100 mm fra hinanden: +50 fra ét anker = −50 fra naboen (samme stang), +100 rammer nabo-ankeret
    expect(taet.armV.sammenfald).toBeGreaterThan(0);
    expect(taet.armV.konflikter).toBeGreaterThan(0);
    expect(taet.armV.ben).toBeLessThan(fjern.armV.ben);
    const rd = (k: any) => k.brudformer.find((b: any) => b.id === 'V_re')?.Rd ?? 0;
    expect(rd(taet)).toBeLessThan(rd(fjern));
    // ingen fysisk stang tælles mere end én gang i alt
    const t = beregnTilstand(raekke(100));
    expect(t.diagnostik.some((d) => d.kode === 'overfladestang-gennem-anker')).toBe(true);
    expect(t.diagnostik.some((d) => d.kode === 'overfladestaenger-deles')).toBe(true);
  });
  it('stangafstanden s styrer placeringen af 3. og 4. stang', () => {
    const m = raekke(400, 4); m.beton.armering.ankerarmeringForskydning.stangAfstand = 80;
    expect(res(m).armV.staenger!.map((s) => s.v).sort((a, b) => a - b)).toEqual([-130, -50, 50, 130]);
  });
  it('3D tegner hver fysisk stang én gang (grå hvis den rammer et anker)', () => {
    const m = raekke(100);
    const k = res(m);
    const s = byg3d(indlaesProjekt(m as never).model, k as never, null);
    const zs = -40;
    const stænger = (s.dele as any[]).filter((x) => x.type === 'stang' && !x.variant && x.fra[2] === zs && x.til[2] === zs);
    const pos = new Set(stænger.map((x) => Math.round(x.fra[1] * 10)));
    expect(pos.size).toBe(k.armV.alle!.length);
    expect(stænger.filter((x) => x.inaktiv).length).toBeGreaterThanOrEqual(k.armV.konflikter!);
    expect(s.noter.some((n) => n.includes('gennem et anker'))).toBe(true);
  });
});
