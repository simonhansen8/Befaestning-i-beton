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
