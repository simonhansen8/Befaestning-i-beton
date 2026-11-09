import { describe, expect, it } from 'vitest';
import { standardModel } from './indlaes';
import { indlaesProjekt } from './inddata';
import { beregnProjekt } from './beregn';

describe('dimensioneringstilfælde gennem hele kæden', () => {
  const kor = (situation?: string) => {
    const m: any = structuredClone(standardModel('2026-01-01'));
    if (situation) m.indstillinger.situation = situation;
    return beregnProjekt(indlaesProjekt(m).model as never);
  };
  it('vedvarende er standard og uændret', () => { expect(kor().partialkoefficienter.gammaMc).toBe(1.45); });
  it('ulykke giver γMc = 1,00 og højere kapacitet', () => {
    const a = kor(), b = kor('ulykke');
    expect(b.partialkoefficienter.gammaMc).toBe(1);
    expect(b.maksUdnyttelse!).toBeLessThan(a.maksUdnyttelse!);
  });
  it('ulykke meldes ikke som afvigelse fra DK NA', () => {
    expect(kor('ulykke').diagnostik.filter((d) => d.kode === 'national-parameter-aendret')).toEqual([]);
  });
});
