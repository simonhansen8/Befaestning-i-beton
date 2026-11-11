import { describe, expect, it } from 'vitest';
import { standardModel } from '../core/indlaes';
import { kantvalg } from './arm-oversigt';

const m: any = structuredClone(standardModel('2026-01-01'));
describe('de to kantarmeringer markeres tydeligt', () => {
  it('ankerarmering virksom: den regner, ψre,V gælder ikke for rækken', () => {
    m.beton.armering.ankerarmeringForskydning.aktiv = true; m.beton.armering.kantarmering = 'boejler';
    const l = kantvalg(m, { armV: { virksom: true }, armKant: { kant: 'xNeg' } });
    expect(l[0]).toMatchObject({ aktiv: true }); expect(l[0]!.tekst).toContain('x−');
    expect(l[1]).toMatchObject({ aktiv: false });
  });
  it('advarer når ankerarmeringen ikke kan bære og viser l1 og α1', () => {
    m.beton.armering.ankerarmeringForskydning.aktiv = true;
    const l = kantvalg(m, { armV: { virksom: true, l1: 77 }, armKant: { kant: 'xNeg' }, brudformer: [{ id: 'V_a', udnyttelse: 2.07 }] });
    const w = l.find((x) => x.advarsel)!;
    expect(w.tekst).toContain('l1 = 77 mm'); expect(w.tekst).toContain('V_a = 207 %');
  });
  it('ankerarmering ikke virksom: ψre,V regner i betonkantbruddet', () => {
    const l = kantvalg(m, { armV: { virksom: false }, armKant: { kant: 'xNeg' }, kantbrud: { forreste: { xNeg: { psiRe: 1.4 } } } });
    expect(l[0]).toMatchObject({ aktiv: false });
    expect(l[1]).toMatchObject({ aktiv: true }); expect(l[1]!.tekst).toContain('1,4');
  });
  it('ankerarmering fra og ingen kantarmering: ingen af dem er aktive', () => {
    const k: any = structuredClone(m); k.beton.armering.ankerarmeringForskydning.aktiv = false; k.beton.armering.kantarmering = 'ingen';
    expect(kantvalg(k, null).every((x) => !x.aktiv)).toBe(true);
  });
});
