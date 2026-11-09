// Samlet beregning af et projekt: validering, alle lastkombinationer, valg af armeringskant og strukturerede resultater.
// Rene tal og kodede diagnoser; ingen tekst. Laster er altid designværdier (inkl. K_FI).
import { fckAf } from './concrete';
import { diagnostikKombination, diagnostikValgtArmeringskant } from './diagnostik-kombination';
import type { Diagnostik } from './diagnostik';
import { beregnKombination, vaelgArmeringsKant, type KombinationsResultat } from './kombination';
import type { Last } from './loads';
import { partialkoefficienter, type Partialkoefficienter } from './partials';
import { parseIndstillinger, youngBeton, type IndstillingerInput, type Indstillinger } from './settings';
import { afledStaal, type AnkerStaal, type AnkerStaalInput } from './steel';
import { afvigelserFraDkNa, validerModel, type ValideringsModel } from './validering';

export type Projektlast = Last & { alphaSus?: number | null };

export interface Projektmodel extends ValideringsModel {
  anker: ValideringsModel['anker'] & AnkerStaalInput & { staalklasse: string; gammaInst?: number };
  laster: Projektlast[];
  indstillinger?: IndstillingerInput & { sigmaAdm?: number };
}

export interface KombinationsOutput {
  index: number; navn: string; last: Last; alphaSus: number;
  resultat: KombinationsResultat; diagnostik: Diagnostik[];
  maksUdnyttelse: number; styrendeBrudform: string | null;
  /** Udnyttelse ≤ 1 og ingen fejl i kombinationen. */
  ok: boolean;
}

export interface ProjektResultat {
  /** 'fejl' hvis modellen eller en kombination har en diagnose med niveau 'fejl'. */
  tilstand: 'ok' | 'fejl';
  /** Tilstand ok og alle kombinationer ok. */
  ok: boolean;
  diagnostik: Diagnostik[];
  indstillinger: Indstillinger;
  partialkoefficienter: Partialkoefficienter;
  staal: AnkerStaal;
  fck: number; Ec: number;
  armeringskant: { kant: string; udnyttelse: number; kombinationIndex: number } | null;
  kombinationer: KombinationsOutput[];
  /** Første kombination med største udnyttelse. */
  styrendeKombination: number | null;
  maksUdnyttelse: number | null;
  styrendeBrudform: string | null;
}

export function beregnProjekt(m: Projektmodel): ProjektResultat {
  const { indstillinger: ind, bemaerkninger } = parseIndstillinger(m.indstillinger ?? {});
  const fck = fckAf(m.beton);
  const Ec = youngBeton(ind, fck);
  const st = afledStaal({ staalklasse: m.anker.staalklasse, d: m.anker.d, gevind: m.anker.gevind, As: m.anker.As });
  const p = partialkoefficienter(ind, { type: m.anker.type, fuk: st.fuk, fyk: st.fyk, gammaInstIndlimet: m.anker.gammaInst });
  const modelDiag: Diagnostik[] = [
    ...bemaerkninger.map((b): Diagnostik => ({ niveau: b.niveau, kode: 'indstilling-justeret', felt: b.felt, paragraf: '', data: { tekst: b.tekst } })),
    ...validerModel(m, ind, fck, m.indstillinger?.sigmaAdm ?? 0),
    ...afvigelserFraDkNa(ind, p.gamma3),
  ];
  const base = { indstillinger: ind, partialkoefficienter: p, staal: st, fck, Ec };
  if (modelDiag.some((d) => d.niveau === 'fejl')) {
    return { tilstand: 'fejl', ok: false, diagnostik: modelDiag, ...base, armeringskant: null, kombinationer: [], styrendeKombination: null, maksUdnyttelse: null, styrendeBrudform: null };
  }
  const lk = m.laster.map((l) => ({ last: l as Last, alphaSus: l.alphaSus ?? m.anker.alphaSus }));
  const valgt = vaelgArmeringsKant(m, st, p, ind, lk, Ec);
  const mm = valgt
    ? { ...m, beton: { ...m.beton, armering: { ...m.beton.armering, ankerarmeringForskydning: { ...m.beton.armering.ankerarmeringForskydning, kant: valgt.kant } } } }
    : m;
  if (valgt) modelDiag.push(diagnostikValgtArmeringskant(valgt));
  const kombinationer: KombinationsOutput[] = lk.map((k, index) => {
    const r = beregnKombination(mm, st, p, ind, k.last, Ec, k.alphaSus);
    const diagnostik = diagnostikKombination(mm, ind, r, fck, k.alphaSus);
    return {
      index, navn: k.last.navn ?? `LK${index + 1}`, last: k.last, alphaSus: k.alphaSus, resultat: r, diagnostik,
      maksUdnyttelse: r.maksUdnyttelse, styrendeBrudform: r.styrendeBrudform,
      ok: r.maksUdnyttelse <= 1 && !diagnostik.some((d) => d.niveau === 'fejl'),
    };
  });
  let styrende: number | null = null;
  kombinationer.forEach((k, i) => { if (styrende === null || k.maksUdnyttelse > kombinationer[styrende]!.maksUdnyttelse) styrende = i; });
  const tilstand = modelDiag.some((d) => d.niveau === 'fejl') || kombinationer.some((k) => k.diagnostik.some((d) => d.niveau === 'fejl')) ? 'fejl' : 'ok';
  const s = styrende === null ? null : kombinationer[styrende]!;
  return {
    tilstand, ok: tilstand === 'ok' && kombinationer.every((k) => k.ok), diagnostik: modelDiag, ...base,
    armeringskant: valgt, kombinationer, styrendeKombination: styrende, maksUdnyttelse: s?.maksUdnyttelse ?? null, styrendeBrudform: s?.styrendeBrudform ?? null,
  };
}
