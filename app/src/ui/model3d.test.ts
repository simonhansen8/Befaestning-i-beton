import { describe, expect, it } from 'vitest';
import { standardModel } from '../core/indlaes';
import { byg3d } from './model3d';

const m: any = structuredClone(standardModel('2026-01-01'));
describe('3D-beskrivelse', () => {
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
  it('tegner bøjler som tre stænger pr. bøjle og en hef-målelinje', () => {
    const i: any = structuredClone(m);
    const n = i.opstilling.anker.length;
    expect(byg3d(i, null, null).dele.filter((x) => x.type === 'stang')).toHaveLength(0);
    i.beton.armering.ankerarmeringTraek = { ...i.beton.armering.ankerarmeringTraek, aktiv: true, antalBoejler: 2, diameter: 12, afstand: 50, daeklagTop: 40 };
    const s = byg3d(i, null, null);
    expect(s.dele.filter((x) => x.type === 'stang')).toHaveLength(n * 2 * 3);
    expect(s.forklaring.some((f) => f.tekst === 'Armering')).toBe(true);
    const maal: any = s.dele.find((x) => x.type === 'maal');
    expect(maal.tekst).toBe(`hef = ${i.anker.hef} mm`);
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
});
