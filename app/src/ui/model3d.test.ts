import { describe, expect, it } from 'vitest';
import { standardModel } from '../core/indlaes';
import { byg3d } from './model3d';

const m: any = structuredClone(standardModel('2026-01-01'));
describe('3D-beskrivelse', () => {
  it('tegner overfladearmering fra kanten ind forbi brudlegemet, inaktive stænger grå, og krog kun når den er valgt', () => {
    const i: any = structuredClone(m); i.beton.kanter.xNeg = 130; i.beton.cnom = 30;
    i.beton.armering.ankerarmeringForskydning = { ...i.beton.armering.ankerarmeringForskydning, aktiv: true, type: 'overflade', diameter: 10, daekToAkse: 40, krog: false };
    const q = i.opstilling.anker[0], id = q.id;
    const k: any = { styrendeBrudform: null, traek: { traekAnkre: [] }, kantbrud: { styrende: null, forreste: { xNeg: { c1: 130, ankre: [id] } } }, armKant: { kant: 'xNeg' },
      armV: { staenger: [{ v: 50, l1: 90, virksom: true }, { v: -50, l1: 90, virksom: false }], l1: null, virksom: true } };
    const st = () => byg3d(i, k, null).dele.filter((x) => x.type === 'stang') as any[];
    const indre = st().filter((x) => !x.variant);
    expect(indre).toHaveLength(2);
    expect(indre.map((x) => !!x.inaktiv).sort()).toEqual([false, true]);
    // fra kanten (afstand til kant − cnom) og l1 indad
    expect(indre[0].fra[0]).toBeCloseTo(-130 + 30, 5); // kanten x = −130 minus dæklag
    expect(indre[0].til[0]).toBeCloseTo(-130 + 30 + 90, 5);
    expect(indre[0].fra[2]).toBe(-40);
    expect(st().filter((x) => x.variant === 'forankring')).toHaveLength(2);
    expect(st().filter((x) => x.variant === 'tilbehoer')).toHaveLength(0);
    i.beton.armering.ankerarmeringForskydning.krog = true;
    expect(st().filter((x) => x.variant === 'tilbehoer')).toHaveLength(1);
    expect(st().length).toBeGreaterThan(5);
  });
  it('tegner bøjle og løkke efter udformning og antal, grå når de ikke virker', () => {
    const i: any = structuredClone(m); i.beton.kanter.xNeg = 130;
    i.beton.armering.ankerarmeringForskydning = { ...i.beton.armering.ankerarmeringForskydning, aktiv: true, type: 'loekke', diameter: 10, daekToAkse: 40 };
    const id = i.opstilling.anker[0].id;
    const k: any = { styrendeBrudform: null, traek: { traekAnkre: [] }, kantbrud: { styrende: null, forreste: { xNeg: { c1: 130, ankre: [id] } } }, armKant: { kant: 'xNeg' }, armV: { ben: 4, virksom: false } };
    const st = byg3d(i, k, null).dele.filter((x) => x.type === 'stang') as any[];
    expect(st.filter((x) => !x.variant)).toHaveLength(2 * 3);
    expect(st.every((x) => x.inaktiv)).toBe(true);
  });
  it('har mål for hef, h, plade, boltafstand og kantafstand, og kan slå dem fra', () => {
    const i: any = structuredClone(m); i.beton.kanter.xNeg = 200;
    const tekster = byg3d(i, null, null, false, true).dele.filter((x) => x.type === 'maal').map((x: any) => x.tekst as string);
    for (const pre of ['hef = ', 'h = ', 'bx = ', 'by = ', 't = ', 'sx = ', 'sy = ', 'c = ']) expect(tekster.some((t) => t.startsWith(pre))).toBe(true);
    expect(byg3d(i, null, null, false, false).dele.filter((x) => x.type === 'maal')).toHaveLength(0);
    expect(tekster.every((t) => !t.includes('NaN'))).toBe(true);
  });
  it('tegner kegle for N_c og kile for V_c kun når brudlegeme er slået til', () => {
    const k: any = { styrendeBrudform: 'N_c', traek: { traekAnkre: [{ x: 10, y: 20 }] }, kantbrud: { styrende: null } };
    expect(byg3d(m, k, null).dele.some((x) => x.type === 'kegle')).toBe(false);
    const kegle: any = byg3d(m, k, null, true).dele.find((x) => x.type === 'kegle');
    expect(kegle.radius).toBe(1.5 * m.anker.hef);
    expect([kegle.x, kegle.y]).toEqual([10, 20]);
    const id = m.opstilling.anker[0].id;
    const v: any = { styrendeBrudform: 'V_c', traek: { traekAnkre: [] }, kantbrud: { styrende: { kant: 'xNeg', c1: 100, ankre: [id] } } };
    const kile: any = byg3d(m, v, null, true).dele.find((x) => x.type === 'legeme');
    expect(kile.punkter).toHaveLength(4);
    expect(kile.punkter[1][0]).toBeLessThan(kile.punkter[0][0]);
  });
  it('tegner trækbøjler i lodrette planer med bøjning ved overfladen, og lige stænger uden', () => {
    const i: any = structuredClone(m);
    const n = i.opstilling.anker.length;
    expect(byg3d(i, null, null).dele.filter((x) => x.type === 'stang')).toHaveLength(0);
    i.beton.armering.ankerarmeringTraek = { ...i.beton.armering.ankerarmeringTraek, aktiv: true, antalBoejler: 2, diameter: 12, afstand: 50, daeklagTop: 40, krog: true, foering: 'stoed' };
    const s = byg3d(i, null, null);
    const st = s.dele.filter((x) => x.type === 'stang') as any[];
    // lukket bøjle: to lodrette ben + to vandrette sider + fire buede hjørner (8 segmenter hver)
    const boejle = st.filter((x) => !x.variant);
    const lodret = boejle.filter((x) => x.fra[0] === x.til[0] && x.fra[1] === x.til[1] && x.fra[2] !== x.til[2]);
    expect(lodret.length).toBeGreaterThanOrEqual(n * 2 * 2); // mindst benene (buerne giver yderligere skrå segmenter)
    const topZ = (j: number) => -40 - j * 13;
    // bøjlen når overkant (daeklagTop) og nederst hef; bøjningen findes både foroven og forneden
    expect(Math.max(...boejle.map((x) => Math.max(x.fra[2], x.til[2])))).toBeCloseTo(topZ(0), 5);
    expect(Math.min(...boejle.map((x) => Math.min(x.fra[2], x.til[2])))).toBeCloseTo(-i.anker.hef, 5);
    expect(boejle.length).toBe(n * 2 * (2 + 2 + 4 * 8)); // 2 ben, 2 sider, 4 hjørner à 8 buesegmenter
    // overfladearmering: rigtige stænger med ⌀s, ligger inde i bøjlen (under overkanten) og går gennem hver bøjle
    const flade = st.filter((x) => x.variant === 'tilbehoer');
    expect(flade.length).toBeGreaterThanOrEqual(2); // en stang pr. bøjleplan (sammenfaldende gennem flere bolte slås sammen)
    expect(new Set(flade.map((x) => x.r))).toEqual(new Set([5]));
    expect(flade.some((x) => Math.abs(x.fra[2] - (topZ(0) - 6 - 5)) < 1e-6)).toBe(true);
    // fladearmeringens længde er langt større end bøjlens bredde (gennemgående)
    expect(Math.max(...flade.map((x) => Math.hypot(x.til[0] - x.fra[0], x.til[1] - x.fra[1])))).toBeGreaterThan(300);
    expect(s.dele.some((x) => x.type === 'cirkel')).toBe(false); // zonen 0,75·hef tegnes ikke
    i.beton.armering.ankerarmeringTraek.krog = false;
    const lige = byg3d(i, null, null).dele.filter((x) => x.type === 'stang') as any[];
    expect(lige).toHaveLength(n * 2 * 2);
    expect(lige.every((x) => x.fra[0] === x.til[0] && x.fra[1] === x.til[1])).toBe(true);
    expect(s.forklaring.some((f) => f.tekst === 'Armering')).toBe(true);
    const maal: any = s.dele.find((x) => x.type === 'maal' && x.tekst.startsWith('hef'));
    expect(maal.tekst).toBe(`hef = ${i.anker.hef} mm`);
  });
  it('trækarmeringens ben følger afstand, dæklag, forankringsdybde og antal', () => {
    const i: any = structuredClone(m);
    i.beton.armering.ankerarmeringTraek = { ...i.beton.armering.ankerarmeringTraek, aktiv: true, antalBoejler: 1, diameter: 10, afstand: 60, daeklagTop: 25, krog: false, foering: 'ingen', forankringsdybde: 150 };
    const q = i.opstilling.anker[0], M = i.anker.d / 2 + 5 + 2;
    const st: any[] = byg3d(i, null, null).dele.filter((x) => x.type === 'stang');
    expect(st[0].fra).toEqual([q.x + 60, q.y + M, -25]);
    expect(st[0].til[2]).toBe(-150);
  });
  it('har beton, plade og skaft/hoved/møtrik pr. bolt', () => {
    const s = byg3d(m, null, null);
    const n = m.opstilling.anker.length;
    expect(s.dele.filter((x) => x.type === 'boks').map((x) => (x as any).rolle).sort()).toEqual(['beton', 'plade']);
    for (const r of ['skaft', 'hoved', 'moertel']) expect(s.dele.filter((x) => (x as any).rolle === r)).toHaveLength(n);
  });
  it('bolten ligger i betonen og pladen oven på', () => {
    const s = byg3d(m, null, null);
    const sk: any = s.dele.find((x) => (x as any).rolle === 'skaft');
    expect(sk.z0).toBe(-m.anker.hef);
    const pl: any = s.dele.find((x) => (x as any).rolle === 'plade');
    expect(pl.z0).toBe(m.plade.afstandTilBeton ?? 0);
    expect(pl.z1 - pl.z0).toBe(m.plade.t);
  });
  it('indlimet anker har ingen hoveder', () => {
    const i: any = structuredClone(m); i.anker.type = 'indlimet';
    expect(byg3d(i, null, null).dele.filter((x) => (x as any).rolle === 'hoved')).toHaveLength(0);
  });
  it('frie kanter begrænser betonen', () => {
    const k: any = structuredClone(m); k.beton.kanter = { xNeg: 130, xPos: null, yNeg: null, yPos: null };
    const b: any = byg3d(k, null, null).dele.find((x) => (x as any).rolle === 'beton');
    expect(b.x0).toBe(-130);
  });
  it('laster giver pile og buer med fortegn', () => {
    const s = byg3d(m, null, { N: 75e3, Vx: -18e3, Vy: 0, Mx: 0, My: -6e6, T: 0 });
    const pile = s.dele.filter((x) => x.type === 'pil') as any[];
    expect(pile.map((p) => p.tekst)).toEqual(['N = 75,0 kN', 'Vx = −18,0 kN']);
    expect(pile[1].til[0]).toBeLessThan(0);
    const bue = s.dele.filter((x) => x.type === 'bue') as any[];
    expect(bue).toHaveLength(1);
    expect(bue[0].fortegn).toBe(-1);
  });
  it('trykkraft vender pilen nedad', () => {
    const p: any = byg3d(m, null, { N: -5e3 }).dele.find((x) => x.type === 'pil');
    expect(p.til[2]).toBeLessThan(p.fra[2]);
  });
  it('drejer trækbøjleparrene 90° og viser bøjleafstanden for kantarmeringen', () => {
    const i: any = structuredClone(m);
    i.beton.armering.ankerarmeringTraek = { ...i.beton.armering.ankerarmeringTraek, aktiv: true, antalBoejler: 1, diameter: 12, afstand: 50, daeklagTop: 40, krog: false, foering: 'stoed', drejet: false };
    const q = i.opstilling.anker[0];
    const ben = (): any[] => byg3d(i, null, null, false, false).dele.filter((x) => x.type === 'stang') as any[];
    const a = ben()[0], b0 = ben();
    expect(Math.abs(a.fra[0] - q.x)).toBeCloseTo(50, 5); // parret ligger langs x: benet ±x fra ankeret
    i.beton.armering.ankerarmeringTraek.drejet = true;
    const c = ben()[0];
    expect(Math.abs(c.fra[1] - q.y)).toBeCloseTo(50, 5); // drejet: nu langs y
    expect(b0.length).toBe(ben().length);
    const k: any = structuredClone(m); k.beton.kanter.xNeg = 300; k.beton.armering.kantarmering = 'boejler'; k.beton.armering.kantarmeringDiameter = 12;
    const antal = (afst: number) => { k.beton.armering.kantarmeringAfstand = afst; return byg3d(k, null, null, false, false).dele.filter((x) => x.type === 'stang').length; };
    expect(antal(100)).toBeGreaterThan(antal(200));
  });
});

describe('skematisk overfladearmering kan skjules', () => {
  it('tilbehør (grøn) udelades når visTilbehoer er falsk, bøjlerne bevares', () => {
    const i: any = structuredClone(standardModel('2026-01-01')); i.beton.armering.ankerarmeringTraek.aktiv = true;
    const st = (vis: boolean) => (byg3d(i, null, null, false, true, true, null, vis).dele.filter((x) => x.type === 'stang') as any[]);
    expect(st(true).some((x) => x.variant === 'tilbehoer')).toBe(true);
    expect(st(false).some((x) => x.variant === 'tilbehoer')).toBe(false);
    expect(st(false).length).toBeGreaterThan(0);
  });
});
