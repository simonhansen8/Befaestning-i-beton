import { describe, expect, it } from 'vitest';
import { Store } from './state';
import { KANTFELTER, SEKTIONER } from './felter';
import type { FeltDef } from './skema-typer';
import { standardModel } from '../core/indlaes';

const felt = (k: string): FeltDef => {
  const kf = KANTFELTER.find((f) => f.k === k);
  if (kf) return kf;
  for (const s of SEKTIONER) for (const f of s.fields ?? []) if ('k' in f && f.k === k) return f as FeltDef;
  throw new Error('felt findes ikke: ' + k);
};

describe('Store', () => {
  it('beregner standardmodellen', () => {
    const s = new Store(standardModel('2026-01-01'));
    expect(s.tilstand.resultat).not.toBeNull();
    expect(s.tilstand.resultat!.maksUdnyttelse).toBeGreaterThan(0);
  });
  it('ændring af felt giver nyt resultat via samme vej', () => {
    const s = new Store(standardModel('2026-01-01'));
    const for_ = s.tilstand.resultat!.maksUdnyttelse!;
    expect(s.saetFelt(felt('anker.hef'), '250')).toBe(true);
    expect(s.tilstand.model.anker.hef).toBe(250);
    expect(s.tilstand.resultat!.maksUdnyttelse).not.toBe(for_);
  });
  it('ugyldig indtastning ændrer ikke modellen', () => {
    const s = new Store(standardModel('2026-01-01'));
    expect(s.saetFelt(felt('anker.hef'), 'abc')).toBe(false);
    expect(s.tilstand.model.anker.hef).toBe(180);
    expect(s.tilstand.feltfejl['anker.hef']!.kode).toBe('ikke-tal');
  });
  it('dansk decimalkomma og nullable felter', () => {
    const s = new Store(standardModel('2026-01-01'));
    expect(s.saetFelt(felt('beton.kanter.xNeg'), '')).toBe(true);
    expect(s.tilstand.model.beton.kanter.xNeg).toBeNull();
    expect(s.saetFelt(felt('beton.cnom'), '32,5')).toBe(true);
    expect(s.tilstand.model.beton.cnom).toBe(32.5);
  });
  it('γ3 kan overstyres manuelt og Ec følger betonklassen når tom', () => {
    const s = new Store(standardModel('2026-01-01'));
    const g0 = s.tilstand.resultat!.partialkoefficienter.gamma3;
    expect(g0).toBe(1);
    s.saetFelt(felt('indstillinger.gamma3'), '1,2');
    expect(s.tilstand.resultat!.partialkoefficienter.gamma3).toBe(1.2);
    s.saetFelt(felt('indstillinger.Ec'), '');
    expect(s.tilstand.resultat!.Ec).toBeGreaterThan(30000);
  });
  it('indlæsning af ugyldig JSON bevarer modellen og melder fejl', () => {
    const s = new Store(standardModel('2026-01-01'));
    s.indlaesTekst('{');
    expect(s.tilstand.fejl).toMatch(/Ugyldig JSON/);
    expect(s.tilstand.resultat).not.toBeNull();
    s.indlaesTekst(JSON.stringify({ anker: {}, beton: {}, opstilling: { anker: [] }, laster: [{}] }));
    expect(s.tilstand.fejl).toMatch(/ingen-bolte/);
  });
  it('rundtur: JSON ud og ind giver samme resultat', () => {
    const s = new Store(standardModel('2026-01-01'));
    const j = s.tilJson();
    const s2 = new Store();
    s2.indlaesTekst(j);
    expect(s2.tilstand.resultat!.maksUdnyttelse).toBe(s.tilstand.resultat!.maksUdnyttelse);
  });
});
