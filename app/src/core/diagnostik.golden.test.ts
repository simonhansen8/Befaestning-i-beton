// Diagnostik (fejl/advarsler/oplysninger) i ny kerne mod facit: samme niveau, felt og normhenvisning for den styrende kombination.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseIndstillinger } from './settings';
import { afledStaal } from './steel';
import { partialkoefficienter } from './partials';
import { skalerLast } from './loads';
import { legacyGammaMsRe, legacyKfi } from './facit-hjaelp';
import { beregnKombination, vaelgArmeringsKant } from './kombination';
import { fckAf } from './concrete';
import { validerModel, afvigelserFraDkNa } from './validering';
import { diagnostikKombination, diagnostikValgtArmeringskant } from './diagnostik-kombination';

const G = JSON.parse(readFileSync(new URL('../../../golden/cases.json', import.meta.url), 'utf8'));
const cases = G.cases.filter((c: any) => c.resultat.tilstand === 'ok');
const NYE_KODER = new Set(['ccrsp-hilti-udtryk', 'lastpunkt-excentrisk', 'lastpunkt-uden-for-plade', 'produktdata-passer-ikke-d', 'psic-passer-ikke-beton', 'anneks-a-videreforing']);
const nøgle = (n: string, f: string | null, p: string) => `${n}|${f ?? ''}|${p}`;

describe('diagnostik mod facit', () => {
  it.each(cases as any[])('model #$id', (c: any) => {
    const m = c.model;
    const { indstillinger } = parseIndstillinger({ ...m.indstillinger, gammaMsRe: legacyGammaMsRe(m), gamma3: undefined, Ec: null });
    const st = afledStaal({ staalklasse: m.anker.staalklasse, d: m.anker.d, gevind: m.anker.gevind, As: m.anker.As });
    const p = partialkoefficienter(indstillinger, { type: m.anker.type, fuk: st.fuk, fyk: st.fyk, gammaInstIndlimet: m.anker.gammaInst });
    const alle = m.laster.map((l: any) => ({ last: skalerLast(l, legacyKfi(m)), alphaSus: l.alphaSus ?? m.anker.alphaSus }));
    const valgt = vaelgArmeringsKant(m, st, p, indstillinger, alle, 30000);
    const mm = valgt ? { ...m, beton: { ...m.beton, armering: { ...m.beton.armering, ankerarmeringForskydning: { ...m.beton.armering.ankerarmeringForskydning, kant: valgt.kant } } } } : m;
    const raa = m.laster[c.resultat.styrendeKombination];
    const aS = raa.alphaSus ?? m.anker.alphaSus;
    const r = beregnKombination(mm, st, p, indstillinger, skalerLast(raa, legacyKfi(m)), 30000, aS);
    const fck = fckAf(m.beton);
    const d = [
      ...validerModel(mm, indstillinger, fck, m.indstillinger.sigmaAdm ?? 0),
      // afvigelser vurderes på filens egne indstillinger (γMs,re er kun omregnet for at kunne sammenligne tal)
      ...afvigelserFraDkNa(parseIndstillinger({ ...m.indstillinger, gamma3: undefined, Ec: null }).indstillinger, p.gamma3),
      ...(valgt ? [diagnostikValgtArmeringskant(valgt)] : []),
      ...diagnostikKombination(mm, indstillinger, r, fck, aS),
    ]
      // Bevidste ændringer siden facit (gennemgang 2026-11-16): skøn for ccr,sp/hmin er nu advarsel (og meldes også når kun hmin mangler);
      // nye kontroller for Hilti-udtryk, lastpunkt og forældede produktdata findes ikke i den gamle kerne.
      .filter((x) => !NYE_KODER.has(x.kode) && !(x.kode === 'ccrsp-er-skoen' && !(x.data as { ccrSp?: boolean }).ccrSp))
      .map((x) => (x.kode === 'ccrsp-er-skoen' ? { ...x, niveau: 'info' as const } : x))
      .map((x) => nøgle(x.niveau, x.felt, x.paragraf));
    // K_FI-meddelelser hører til den gamle adfærd (fjernet i ny kerne) og sammenlignes ikke.
    const w = c.resultat.diagnostik.filter((x: string[]) => x[1] !== 'indstillinger.kfiPaaLaster').map((x: string[]) => nøgle(x[0]!, x[1]!, x[2]!));
    const tael = (a: string[]) => a.reduce((o: Record<string, number>, x) => ((o[x] = (o[x] ?? 0) + 1), o), {});
    const A = tael(d), B = tael(w);
    const diff = [...new Set([...Object.keys(A), ...Object.keys(B)])].filter((k) => A[k] !== B[k]).map((k) => `${k}: ny=${A[k] ?? 0} gammel=${B[k] ?? 0}`);
    if (diff.length) console.log('DIFF', c.id, JSON.stringify(diff));
    expect(diff.length, 'forskelle').toBe(0);
  });
});
