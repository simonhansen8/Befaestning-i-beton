import { describe, expect, it } from 'vitest';
import { standardModel } from '../core/indlaes';
import { beregnTilstand } from './state';
import { byg3d } from './model3d';

describe('brudlegemer for valgt brudform', () => {
  const m: any = structuredClone(standardModel('2026-01-01'));
  m.beton.kanter.xNeg = 150;
  const t = beregnTilstand(m), kom = t.resultat!.kombinationer[t.resultat!.styrendeKombination ?? 0]!, k = kom.resultat;
  const dele = (id: string) => byg3d(t.model, k, kom.last as any, false, false, false, id).dele;
  it('kegle og projiceret areal for betonkegle, med kernens radius', () => {
    const d: any[] = dele('N_c');
    const kegler = d.filter((x) => x.type === 'kegle');
    expect(kegler.length).toBe(k.traek.traekAnkre.length);
    expect(kegler[0].radius).toBeCloseTo(k.detaljer.N_c!.ccr);
    expect(d.some((x) => x.type === 'linjer')).toBe(true);
    expect(d.find((x) => x.type === 'tekst').tekst).toContain('Ac,N');
  });
  it('rektangel for Ac,V og kil for kantbrud, og bånd for stålbrud', () => {
    const d: any[] = dele('V_c');
    expect(d.some((x) => x.type === 'legeme')).toBe(true);
    expect(d.some((x) => x.type === 'tekst' && x.tekst.startsWith('Ac,V'))).toBe(true);
    expect(dele('N_s').some((x: any) => x.type === 'markering')).toBe(true);
  });
  it('alle relevante brudformer kan vælges uden fejl, og uvalgt giver ingen brudlegeme', () => {
    for (const b of k.brudformer.filter((x) => x.relevant)) expect(() => dele(b.id), b.id).not.toThrow();
    expect(dele(null as any).some((x: any) => x.type === 'kegle' || x.type === 'linjer' || x.type === 'markering')).toBe(false);
  });
});
