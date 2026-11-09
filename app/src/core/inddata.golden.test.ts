// Normalisering (trin 2): efter indlæsning giver beregningen samme resultat som direkte på facit-modellen,
// og idempotens: normalisering af en normaliseret model ændrer intet.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { beregnProjekt, type Projektmodel } from './beregn';
import { indlaesProjekt } from './inddata';
import { indlaesFil } from './indlaes';

const G = JSON.parse(readFileSync(new URL('../../../golden/cases.json', import.meta.url), 'utf8'));
const j = (x: unknown) => JSON.parse(JSON.stringify(x));
const grunde = (m: any) => ({ ...m, laster: m.laster.map((l: any) => ({ ...l })) });

describe('indlaesProjekt (normalisering) mod facit-modeller', () => {
  it.each(G.cases as any[])('model #$id', (c: any) => {
    const fil = indlaesFil(c.model, { dato: c.model.projekt.dato });
    expect(fil.fejl).toBeNull();
    const n = indlaesProjekt(fil.model);
    const direkte = beregnProjekt(grunde(c.model) as Projektmodel);
    const via = beregnProjekt(n.model);
    expect(via.tilstand).toBe(direkte.tilstand);
    expect(via.maksUdnyttelse).toBe(direkte.maksUdnyttelse);
    expect(via.styrendeKombination).toBe(direkte.styrendeKombination);
    // idempotens
    const igen = indlaesProjekt(n.model);
    expect(j(igen.model)).toEqual(j(n.model));
  });
  it('rodede filer giver kritisk eller en beregnelig model uden at kaste', () => {
    const rodet = JSON.parse(readFileSync(new URL('../../../golden/input-cases.json', import.meta.url), 'utf8')).cases as any[];
    for (const c of rodet) {
      const fil = indlaesFil(c.raa);
      if (!fil.model) continue;
      const n = indlaesProjekt(fil.model);
      if (!n.kritisk) expect(() => beregnProjekt(n.model)).not.toThrow();
    }
  });
});
