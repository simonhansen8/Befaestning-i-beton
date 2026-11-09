// Verifikation mod fem Hilti PROFIS Engineering-rapporter (PROFIS 3.1.38, DS EN 1992-4 DK NA, 9. november 2026), leveret af brugeren.
// Fire er indlimede anker (HIT-HY 200-A V3 + HAS-U 8.8, ETA 19/0601), den femte er en HUS4-H skrueanker (kun lastfordeling og ψM,N sammenlignes).
// Alle tal i kN/kNm/mm som trykt i rapporterne. Se docs/verifikation-profis.md for kommentarer og forskelle.
import { describe, expect, it } from 'vitest';
import { standardModel } from './indlaes';
import { anvendHilti, type Stoerrelse } from './produkter';
import { beregnProjekt } from './beregn';
import { fordelTraek } from './loads';
import { betonkegle } from './cone';

interface Sag {
  navn: string; d: Stoerrelse; klasse: string; h: number; hef: number; plade: [number, number]; ankre: [number, number][];
  /** N, Vx, Vy, Mx, My, T i kN/kNm. Mx og T er ækvivalente værdier, når PROFIS' lastangrebspunkt ikke ligger i pladens midte. */
  last: [number, number, number, number, number, number];
  F: number[]; V: number[]; C: number; NRds: number; NRdp: number; NRdc: number; VRds: number; VRdcp: number;
}
const SAGER: Sag[] = [
  {
    navn: 'MC-B12 (8 anker, N + My, lastpunkt y = 20 mm)', d: 20, klasse: 'C30/37', h: 250, hef: 205, plade: [600, 300],
    ankre: [[-255, -105], [-85, -105], [85, -105], [255, -105], [-255, 105], [-85, 105], [85, 105], [255, 105]],
    // PROFIS angiver N = 169 kN i (x, y) = (−47,9 / 20,0) og Vx = 81 kN i y = 20 mm: Mx = 169·0,020 og T = −81·0,020.
    last: [169, 81, -1, 3.38, 8.1, -1.62],
    F: [24.248, 19.484, 14.719, 9.954, 32.296, 27.531, 22.766, 18.002], V: [9.723, 9.677, 9.686, 9.751, 10.620, 10.579, 10.587, 10.646],
    C: 0, NRds: 130.667, NRdp: 175.178, NRdc: 170.175, VRds: 72.593, VRdcp: 393.088,
  },
  {
    navn: 'MC-G10 (8 anker, N + Mx + My + Vx + Vy)', d: 20, klasse: 'C30/37', h: 250, hef: 120, plade: [290, 640],
    ankre: [[-90, 270], [-90, 180], [-90, -180], [-90, -270], [90, 270], [90, 180], [90, -180], [90, -270]],
    last: [72, 31, -54, 10.8, 6.2, 0],
    F: [21.943, 20.282, 13.639, 11.978, 9.152, 7.491, 0.847, 0], V: Array(8).fill(7.783),
    C: 13.331, NRds: 130.667, NRdp: 119.299, NRdc: 88.668, VRds: 72.593, VRdcp: 286.759,
  },
  {
    navn: 'WT01 B26 (2 anker, HE220B-søjle, Mx + Vy)', d: 30, klasse: 'C25/30', h: 270, hef: 200, plade: [250, 220],
    ankre: [[-75, 0], [75, 0]], last: [0, 0, -50.2, 5.5, 0, 0],
    F: [30.271, 30.271], V: [25.1, 25.1], C: 60.541, NRds: 299.2, NRdp: 157.855, NRdc: 159.321, VRds: 166.222, VRdcp: 187.749,
  },
  {
    navn: 'Kassø HEB100-søjle (4 anker, kun Mx)', d: 12, klasse: 'C25/30', h: 400, hef: 90, plade: [240, 190],
    ankre: [[-95, -65], [95, -65], [-95, 65], [95, 65]], last: [0, 0, 0, 5.5, 0, 0],
    F: [0, 0, 18.542, 18.542], V: [0, 0, 0, 0], C: 37.083, NRds: 44.933, NRdp: 38.727, NRdc: 38.623, VRds: 0, VRdcp: 0,
  },
];

function model(s: Sag, ec: number | null) {
  const m: any = standardModel('2026-11-09');
  m.beton.klasse = s.klasse; m.beton.h = s.h; m.beton.revnet = true; m.beton.kanter = { xNeg: null, xPos: null, yNeg: null, yPos: null };
  // PROFIS: ingen armering eller armeringsafstand ≥ 150 mm, ψre,N = 1
  m.beton.armering.afskalning = 'aaben';
  m.anker.hef = s.hef; m.anker.staalklasse = '8.8'; m.anker.fuk = 800; m.anker.fyk = 640;
  anvendHilti(m, s.d, 'I', 'toert-vaadt'); // 40/24 °C, tørt hul, 50 års levetid
  m.plade = { bx: s.plade[0], by: s.plade[1], t: 12, hulfrigang: 'normal', afstandTilBeton: 0, mellemlaeg: 'ingen', indspaending: 'fri' };
  m.opstilling = { type: 'fri', sx: 0, sy: 0, n: 0, r: 0, vinkel: 0, anker: s.ankre.map(([x, y], i) => ({ id: i + 1, x, y, slids: null })) };
  const [N, Vx, Vy, Mx, My, T] = s.last;
  m.laster = [{ navn: s.navn, N: N * 1e3, Vx: Vx * 1e3, Vy: Vy * 1e3, Mx: Mx * 1e6, My: My * 1e6, T: T * 1e6, alphaSus: 0 }];
  m.indstillinger.Ec = ec; // PROFIS regner med Ec = 30 000 N/mm² uanset betonklasse (se docs/verifikation-profis.md)
  return m;
}
const kN = (n: number) => n / 1e3;

describe.each(SAGER)('PROFIS: $navn', (s) => {
  const r = beregnProjekt(model(s, 30000));
  const k = r.kombinationer[0]!.resultat;
  const b = (id: string) => k.brudformer.find((x) => x.id === id)!;

  it('ankerkræfter (træk) og trykresultant stemmer med PROFIS, når Ec = 30 000 N/mm²', () => {
    expect(r.tilstand).toBe('ok');
    k.fordeling.F.forEach((f, i) => expect(Math.abs(kN(f) - s.F[i]!), `anker ${i + 1}: ${kN(f)} vs ${s.F[i]}`).toBeLessThan(0.0015));
    expect(Math.abs(kN(k.fordeling.C) - s.C)).toBeLessThan(0.0015);
  });
  it('forskydning pr. anker (inkl. vridning) stemmer med PROFIS', () => {
    k.forskydning.V.forEach((v, i) => expect(Math.abs(kN(v) - s.V[i]!), `anker ${i + 1}`).toBeLessThan(0.0015));
  });
  it('stål (N_s, V_s), udtrækning og betonkegle (N_p, N_c) stemmer med PROFIS', () => {
    // N_s for M12 8.8: PROFIS 67,4 kN (ETA-tabel) mod 84,3·800 = 67,44 kN i programmet (0,06 %)
    expect(Math.abs(kN(b('N_s').Rd) / s.NRds - 1)).toBeLessThan(0.0011);
    expect(Math.abs(kN(b('N_p').Rd) / s.NRdp - 1)).toBeLessThan(0.0004);
    expect(Math.abs(kN(b('N_c').Rd) / s.NRdc - 1)).toBeLessThan(0.0004);
    if (s.VRds) expect(Math.abs(kN(b('V_s').Rd) / s.VRds - 1)).toBeLessThan(0.0002);
  });
  if (s.VRdcp && s.navn.startsWith('MC-B12') === false) {
    it('pry-out af gruppen (V_cp) stemmer med PROFIS', () => {
      expect(Math.abs(kN(b('V_cp').Rd) / s.VRdcp - 1)).toBeLessThan(0.0002);
    });
  }
});

describe('PROFIS: kendte forskelle', () => {
  it('B12: vridning (T ≠ 0) giver pry-out pr. enkeltanker i programmet, mens PROFIS kun kontrollerer gruppen', () => {
    const s = SAGER[0]!;
    const k = beregnProjekt(model(s, 30000)).kombinationer[0]!.resultat;
    const vcp = k.brudformer.find((x) => x.id === 'V_cp')!;
    // PROFIS: gruppen 81,006 kN mod 393,088 kN (21 %). Programmet: styrende enkeltanker 10,587 kN mod 31,657 kN (33 %).
    expect(kN(vcp.Ed)).toBeCloseTo(10.587, 2);
    expect(kN(vcp.Rd)).toBeCloseTo(31.657, 2);
    // Med den samlede NV_c-kontrol bliver forskellen 100 % (PROFIS) mod 111 % (programmet).
    expect(k.brudformer.find((x) => x.id === 'NV_c')!.udnyttelse!).toBeGreaterThan(1.1);
  });
  it('G10: programmets standard-Ec (EN 1992-1-1, Ecm) giver op til 0,15 kN anden ankerkraft end PROFIS’ 30 000 N/mm²', () => {
    const s = SAGER[1]!;
    const standard = beregnProjekt(model(s, null)).kombinationer[0]!.resultat.fordeling.F;
    const maxAfv = Math.max(...standard.map((f, i) => Math.abs(kN(f) - s.F[i]!)));
    expect(maxAfv).toBeGreaterThan(0.05);
    expect(maxAfv).toBeLessThan(0.15);
  });
});

describe('PROFIS: Kassø L-jern (HUS4-H 10, mekanisk skrueanker – kun lastfordeling og ψM,N)', () => {
  // L 60×60×6, l = 1500 mm, tre anker (x = −500, 0, 500), Vy = −8,8 kN i højden 40 mm over betonen: Mx = 8,8·0,040 = 0,352 kNm
  const ankre = [-500, 0, 500].map((x, i) => ({ id: i + 1, x, y: 0 }));
  const f = fordelTraek(ankre, 64 /* As skønnet; PROFIS bruger ETA-stivheden */,
    { bx: 1500, by: 60 }, { N: 0, Vx: 0, Vy: 0, Mx: 0.352e6, My: 0, T: 0 }, { Es: 210000, Ec: 30000 });
  it('ankerkræfter og trykresultant (4,226 kN pr. anker, 12,677 kN i y = −27,8 mm)', () => {
    f.F.forEach((v) => expect(Math.abs(kN(v) - 4.226)).toBeLessThan(0.02));
    expect(Math.abs(kN(f.C) - 12.677)).toBeLessThan(0.05);
    expect(Math.abs(f.yC + 27.8)).toBeLessThan(0.3);
  });
  it('ψM,N = 2 − z/(1,5·hef) = 1,631 og NRd,c = 15,164 kN (γMc = 1,74)', () => {
    const z = 27.8, hef = 50.15;
    const r = betonkegle({
      ankre: [{ x: 0, y: 0 }], e1: 0, e2: 0, hef, fck: 35, revnet: true, indlimet: true, kcrN: 7.7, kucrN: 11, kanter: {}, afskalning: 'aaben',
      momentfaktor: { C: 12677, NEd_g: 4226, z, cMinAlle: Infinity },
    } as any);
    expect(r.pM).toBeCloseTo(1.631, 2);
    expect(Math.abs(kN(r.NRk) / 1.74 / 15.164 - 1)).toBeLessThan(0.0015);
  });
});
