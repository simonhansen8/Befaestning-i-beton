import { describe, expect, it } from 'vitest';
import { armeringTraekVirkning, type TraekArmering } from './reinforcement';

const ar = (o: Partial<TraekArmering> = {}): TraekArmering => ({
  aktiv: true, diameter: 12, antalBoejler: 1, fyk: 500, afstand: 50, daeklagTop: 40, krog: true, eta1: 1, cd: null, foering: 'ingen', forankringsdybde: null, ...o,
});

describe('fri placering af trækarmering (7.2.1.2(2)c)', () => {
  it('standard: planet lige fri af skaftet, ingen mangler', () => {
    const v = armeringTraekVirkning(ar(), 180, 20);
    expect(v.rad).toBeCloseTo(Math.hypot(50, 10 + 6 + 2), 9);
    expect(v.mangler).toEqual([]);
  });
  it('angivet planafstand indgår i afstanden til benene', () => {
    const v = armeringTraekVirkning(ar({ planAfstand: 100, afstand: 100 }), 180, 20);
    expect(v.rad).toBeCloseTo(Math.hypot(100, 100), 9);
    expect(v.mangler).toContain('afstand-over-0.75hef'); // 141 mm > 0,75·180 = 135
    expect(v.virksom).toBe(false);
  });
  it('plan gennem skaftet giver advarsel', () => {
    const v = armeringTraekVirkning(ar({ planAfstand: 8 }), 180, 20);
    expect(v.mangler).toContain('skaerer-skaft');
    expect(armeringTraekVirkning(ar({ planAfstand: 16 }), 180, 20).mangler).not.toContain('skaerer-skaft');
  });
});
