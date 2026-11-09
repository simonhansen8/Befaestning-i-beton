import { describe, expect, it } from 'vitest';
import { standardModel } from '../core/indlaes';
import { byg3d } from './model3d';

const m: any = structuredClone(standardModel('2026-01-01'));
describe('3D-beskrivelse', () => {
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
