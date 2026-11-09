// Ét state: model → (indlæsning/normalisering) → beregning. Alle ændringer går gennem `saet`/`erstat`; resultatet afledes altid.
import { beregnProjekt, type ProjektResultat } from '../core/beregn';
import type { Diagnostik } from '../core/diagnostik';
import { indlaesFil, standardModel, type Afvist } from '../core/indlaes';
import { indlaesProjekt } from '../core/inddata';
import type { Model } from './skema-typer';
import { saetSti, tolkFelt, type Tolket } from './vaerdi';
import type { FeltDef } from './skema-typer';

export interface Tilstand {
  model: Model;
  /** Beregningsresultat; null hvis modellen ikke kan beregnes (se fejl/diagnostik). */
  resultat: ProjektResultat | null;
  /** Diagnoser fra indlæsning og beregning samlet, mest alvorlige først. */
  diagnostik: Diagnostik[];
  afvist: Afvist[];
  /** Fatal indlæsningsfejl (filen kunne ikke bruges). */
  fejl: string | null;
  valgtKombination: number | null;
  /** Seneste afviste indtastning pr. sti. */
  feltfejl: Record<string, Extract<Tolket, { ok: false }>>;
}

const RANG = { fejl: 0, advarsel: 1, info: 2 } as const;

export function beregnTilstand(model: Model, valgt: number | null = null): Omit<Tilstand, 'feltfejl'> {
  const n = indlaesProjekt(model as never);
  let resultat: ProjektResultat | null = null;
  const diagnostik: Diagnostik[] = [...n.diagnostik];
  if (!n.kritisk) {
    try {
      resultat = beregnProjekt(n.model);
      diagnostik.push(...resultat.diagnostik, ...resultat.kombinationer.flatMap((k) => k.diagnostik));
    } catch (e) {
      diagnostik.push({ niveau: 'fejl', kode: 'fejl', felt: null, paragraf: '', data: { tekst: `Beregningen fejlede: ${(e as Error).message}` } });
    }
  }
  diagnostik.sort((a, b) => RANG[a.niveau] - RANG[b.niveau]);
  const antal = resultat?.kombinationer.length ?? 0;
  return { model, resultat, diagnostik, afvist: [], fejl: null, valgtKombination: valgt != null && valgt < antal ? valgt : resultat?.styrendeKombination ?? null };
}

export class Store {
  tilstand: Tilstand;
  private lyttere = new Set<() => void>();
  constructor(model: Model = standardModel(new Date().toISOString().slice(0, 10))) {
    this.tilstand = { ...beregnTilstand(model), feltfejl: {} };
  }
  subscribe(f: () => void): () => void { this.lyttere.add(f); return () => this.lyttere.delete(f); }
  private opdater(t: Tilstand) { this.tilstand = t; this.lyttere.forEach((f) => f()); }

  /** Sætter et felt fra rå indtastning. Ugyldig indtastning ændrer ikke modellen og gemmes som feltfejl. */
  saetFelt(f: FeltDef, raa: string | boolean): boolean {
    const t = tolkFelt(f, raa);
    const feltfejl = { ...this.tilstand.feltfejl };
    if (!t.ok) { feltfejl[f.k] = t; this.opdater({ ...this.tilstand, feltfejl }); return false; }
    delete feltfejl[f.k];
    const model = structuredClone(this.tilstand.model);
    saetSti(model, f.k, t.v);
    this.opdater({ ...beregnTilstand(model, this.tilstand.valgtKombination), feltfejl });
    return true;
  }
  /** Ændrer modellen direkte (til tabeller: bolte og laster). */
  aendr(f: (m: Model) => void): void {
    const model = structuredClone(this.tilstand.model);
    f(model);
    this.opdater({ ...beregnTilstand(model, this.tilstand.valgtKombination), feltfejl: {} });
  }
  /** Indlæser en projektfil (JSON-tekst). Ved fatal fejl bevares den nuværende model. */
  indlaesTekst(tekst: string): void {
    let raa: unknown;
    try { raa = JSON.parse(tekst); } catch (e) { this.opdater({ ...this.tilstand, fejl: `Ugyldig JSON: ${(e as Error).message}` }); return; }
    const r = indlaesFil(raa);
    if (!r.model) { this.opdater({ ...this.tilstand, fejl: `Filen kan ikke indlæses (${r.fejl}).` }); return; }
    this.opdater({ ...beregnTilstand(r.model), afvist: r.afvist, diagnostik: [...r.noter, ...beregnTilstand(r.model).diagnostik], feltfejl: {} });
  }
  vaelgKombination(i: number): void { this.opdater({ ...this.tilstand, valgtKombination: i }); }
  tilJson(): string { return JSON.stringify(this.tilstand.model, null, 2); }
}
