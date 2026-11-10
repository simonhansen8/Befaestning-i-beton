// Indlæsning (trin 1) mod facit: rodede projektfiler → samme model som den gamle indlæsning, og samme afvisning af filer.
// Når den gamle app afviser en fil, beholder den den forrige model; så er facit-modellen lig den forrige filsmodel.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { indlaesFil } from './indlaes';

const G = JSON.parse(readFileSync(new URL('../../../golden/input-cases.json', import.meta.url), 'utf8'));
const j = (x: unknown) => JSON.parse(JSON.stringify(x));
const alle = G.cases as any[];

describe('indlaesFil mod facit', () => {
  it('begge udfald forekommer i facit', () => {
    expect(alle.filter((c) => !c.afvist && indlaesFil(c.raa).fejl === null).length).toBeGreaterThan(100);
    expect(alle.filter((c) => !c.afvist && indlaesFil(c.raa).fejl !== null).length).toBeGreaterThan(10);
  });
  it.each(alle.map((c, i) => [c.id, i] as const))('fil #%i', (_id, i) => {
    const c = alle[i];
    if (c.afvist) return; // appen blokerede (dialog) – dækkes af den fatale-fejl-test nedenfor
    const r = indlaesFil(c.raa, { dato: c.model?.projekt?.dato ?? '2026-11-09' });
    if (r.fejl !== null) {
      // Afvist fil: facit viser den foregående models tilstand
      const forrige = alle[i - 1]; // efter en blokeret fil genstartes appen (standardmodel) – så kan der ikke sammenlignes
      if (forrige?.model) expect(j(c.model)).toEqual(j(forrige.model));
      return;
    }
    const gl = j(c.model);
    // Bevidst afvigelse: en angivet γ3 overskrives ikke af kontrolklassen (manuel overstyring).
    const ny = j(r.model);
    delete ny.indstillinger.gamma3; delete gl.indstillinger.gamma3;
    // Bevidst afvigelse: Ec udledes af betonklassen medmindre den er angivet (gammel standard 30000 gemmes ikke længere).
    delete gl.indstillinger.Ec; delete ny.indstillinger.Ec;
    delete gl.meta.importNoter; // noter om afviste værdier tilføjes af brugerfladen, ikke af modellen
    // Bevidste tilføjelser siden facit: bekræftelser, drejning af bøjlepar og bøjleafstand for forskydningsarmering.
    delete ny.plade?.lasthoejde; // ny valgfri indtastning (højde af forskydningslast)
    const ar = ny.beton?.armering;
    if (ar) delete ar.kantarmeringBredde; // ny tegneinput: bøjlebredde for kantarmering
    if (ar?.ankerarmeringTraek) { delete ar.ankerarmeringTraek.bekraeft; delete ar.ankerarmeringTraek.drejet; delete ar.ankerarmeringTraek.planAfstand; delete ar.ankerarmeringTraek.vinkel; delete ar.ankerarmeringTraek.fladeDiameter; delete ar.ankerarmeringTraek.fladeAfstand; }
    if (ar?.ankerarmeringForskydning) { delete ar.ankerarmeringForskydning.afstandBoejler; delete ar.ankerarmeringForskydning.bekraeftKantstang; delete ar.ankerarmeringForskydning.kantstangDiameter; delete ar.ankerarmeringForskydning.trykstiverVinkel; }
    expect(ny).toEqual(gl);
  });
  it('filer som appen blokerer på er også fatale i ny parser eller får afviste værdier', () => {
    for (const c of alle.filter((x) => x.afvist)) {
      const r = indlaesFil(c.raa);
      expect(r.fejl !== null || r.afvist.length > 0 || r.noter.length > 0, `fil #${c.id}`).toBe(true);
    }
  });
});

describe('γ3 kan overstyres manuelt', () => {
  it('angivet γ3 bevares uanset kontrolklasse', () => {
    const r = indlaesFil({ anker: {}, beton: {}, opstilling: { anker: [{ x: 0, y: 0 }] }, laster: [{}], indstillinger: { kontrolklasse: 'lempet', gamma3: 1.25 } });
    expect(r.model!.indstillinger.gamma3).toBe(1.25);
  });
});
