import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { genererAnkre } from './opstilling';

const G = JSON.parse(readFileSync(new URL('../../../golden/cases.json', import.meta.url), 'utf8'));

const g = (type: string, extra = {}) => genererAnkre({ type, sx: 200, sy: 100, n: 4, r: 150, vinkel: 0, anker: [], ...extra });

describe('boltmønstre', () => {
  it('antal og symmetri', () => {
    expect(g('1')).toHaveLength(1);
    expect(g('2x').map((a) => a.x)).toEqual([-100, 100]);
    expect(g('4').map((a) => [a.x, a.y])).toEqual([[-100, -50], [100, -50], [-100, 50], [100, 50]]);
    expect(g('6')).toHaveLength(6);
    expect(g('8')).toHaveLength(8);
    expect(g('8').some((a) => a.x === 0 && a.y === 0)).toBe(false);
    expect(g('9')).toHaveLength(9);
  });
  it('cirkulær: n klemmes til 2..24 og ligger på radius', () => {
    expect(g('cirk', { n: 99 })).toHaveLength(24);
    for (const a of g('cirk', { n: 5, r: 150, vinkel: 17 })) expect(Math.hypot(a.x, a.y)).toBeCloseTo(150, 0);
  });
  it('fri bevarer boltene', () => {
    const anker = [{ id: 1, x: 3, y: 4, slids: 'x' }];
    expect(genererAnkre({ type: 'fri', anker })).toBe(anker);
  });
});

describe('mønstre mod facit (gamle app genererer samme koordinater)', () => {
  it('alle facit-modeller med mønster', () => {
    let antal = 0;
    for (const c of G.cases) {
      const o = c.model.opstilling;
      if (!o || o.type === 'fri' || !Array.isArray(o.anker)) continue;
      const gen = genererAnkre(o);
      if (gen.length !== o.anker.length) continue; // koordinaterne i facit kan være redigeret efter mønstret blev valgt, så kun de uredigerede tælles
      if (gen.every((q, i) => Math.abs(q.x - o.anker[i].x) < 1e-6 && Math.abs(q.y - o.anker[i].y) < 1e-6)) antal++;
    }
    expect(antal).toBeGreaterThan(20);
  });
});

import { drejOpstilling90, tilpasPlade } from './opstilling';
describe('drejning og pladetilpasning', () => {
  it('90° drejning flytter bolte, bytter x/y-slids og mønsterparametre; fire drejninger giver udgangspunktet', () => {
    const o = { type: '4', sx: 200, sy: 100, anker: genererAnkre({ type: '4', sx: 200, sy: 100, anker: [] }) };
    const d = drejOpstilling90(o);
    expect(d.sx).toBe(100); expect(d.sy).toBe(200);
    expect(Math.max(...d.anker.map((a) => Math.abs(a.x)))).toBe(50);
    expect(drejOpstilling90(drejOpstilling90(drejOpstilling90(d))).anker.map((a) => [a.x, a.y])).toEqual(o.anker.map((a) => [a.x, a.y]));
    expect(drejOpstilling90({ type: 'fri', anker: [{ id: 1, x: 10, y: 0, slids: 'x' }] }).anker[0]).toMatchObject({ x: 0, y: 10, slids: 'y' });
    expect(drejOpstilling90({ type: '6', sx: 1, sy: 1, anker: [] }).type).toBe('fri');
  });
  it('tilpasPlade forstørrer kun, til 1,2·df uden for hulkant', () => {
    expect(tilpasPlade([{ x: 100, y: 50 }], 14, 300, 300)).toEqual({ bx: 300, by: 300 });
    expect(tilpasPlade([{ x: 200, y: 0 }], 14, 300, 300)).toEqual({ bx: 450, by: 300 });
  });
});
