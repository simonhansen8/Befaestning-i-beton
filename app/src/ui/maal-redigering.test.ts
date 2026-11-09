import { describe, expect, it } from 'vitest';
import { standardModel } from '../core/indlaes';
import { anvendMaal, maalRedigerbarhed } from './maal-redigering';
import { byg3d } from './model3d';

const lav = () => structuredClone(standardModel('2026-01-01')) as any;
describe('ret mål i 3D', () => {
  it('direkte mål sætter felter', () => {
    const m = lav();
    expect(anvendMaal(m, 'hef', 220)).toBe(true); expect(m.anker.hef).toBe(220);
    expect(anvendMaal(m, 'h', 400)).toBe(true); expect(m.beton.h).toBe(400);
    expect(anvendMaal(m, 'bx', 500)).toBe(true); expect(m.plade.bx).toBe(500);
  });
  it('afviser ugyldige værdier', () => {
    const m = lav(), foer = JSON.stringify(m);
    for (const v of [NaN, -5, 0, Infinity]) expect(anvendMaal(m, 'hef', v)).toBe(false);
    expect(JSON.stringify(m)).toBe(foer);
  });
  it('sx/sy regenererer boltene i et mønster', () => {
    const m = lav(); m.opstilling.type = '4'; m.opstilling.anker = [];
    expect(anvendMaal(m, 'sx', 300)).toBe(true);
    const xs = [...new Set(m.opstilling.anker.map((a: any) => a.x))].sort((a: any, b: any) => a - b);
    expect(xs).toEqual([-150, 150]);
  });
  it('sx kan ikke rettes ved frit placerede bolte', () => {
    const m = lav(); m.opstilling.type = 'fri';
    expect(maalRedigerbarhed(m, 'sx').ok).toBe(false);
    expect(anvendMaal(m, 'sx', 300)).toBe(false);
  });
  it('c flytter kanten, så kantafstanden bliver som angivet', () => {
    const m = lav(); m.beton.kanter.xNeg = 200;
    expect(anvendMaal(m, 'c:xNeg', 150)).toBe(true);
    const minX = Math.min(...m.opstilling.anker.map((a: any) => a.x));
    expect(minX + m.beton.kanter.xNeg).toBeCloseTo(150);
    // og 3D-målet viser den nye værdi
    const c: any = byg3d(m, null, null).dele.find((x: any) => x.type === 'maal' && x.felt === 'c:xNeg');
    expect(c.vaerdi).toBeCloseTo(150);
  });
  it('3D kan skjule kræfter', () => {
    const m = lav(); const l = { N: 75e3, Vx: -18e3, Vy: 0, Mx: 0, My: -6e6, T: 0 };
    expect(byg3d(m, null, l, false, true, true).dele.some((x) => x.type === 'pil')).toBe(true);
    expect(byg3d(m, null, l, false, true, false).dele.some((x) => x.type === 'pil' || x.type === 'bue')).toBe(false);
  });
  it('laster rettes i kN/kNm på den valgte kombination, også negative', () => {
    const m = lav();
    const n = m.laster.length;
    expect(anvendMaal(m, 'last:N', 120.5, 0)).toBe(true); expect(m.laster[0].N).toBe(120500);
    expect(anvendMaal(m, 'last:Vx', -20, 1 % n)).toBe(true); expect(m.laster[1 % n].Vx).toBe(-20000);
    expect(anvendMaal(m, 'last:My', -8.25, 0)).toBe(true); expect(m.laster[0].My).toBe(-8.25e6);
    expect(anvendMaal(m, 'last:N', NaN, 0)).toBe(false);
    expect(anvendMaal(m, 'last:N', 5, 99)).toBe(false);
    const d: any = byg3d(m, null, m.laster[0]).dele.find((x: any) => x.type === 'pil' && x.felt === 'last:N');
    expect(d.vaerdi).toBeCloseTo(120.5);
  });
});
