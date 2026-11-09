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

  // Fortryd/gentag: stakke af modelsnapshots. Hurtige rettelser af samme felt samles til ét trin.
  private fortrydStak: Model[] = [];
  private gentagStak: Model[] = [];
  private sidsteFelt: { noegle: string; tid: number } | null = null;
  static readonly MAX_TRIN = 200;
  get kanFortryde(): boolean { return this.fortrydStak.length > 0; }
  get kanGentage(): boolean { return this.gentagStak.length > 0; }
  /** Husker den nuværende model før en ændring; samler gentagne rettelser af samme felt inden for 1,5 s. */
  private husk(noegle: string | null = null, nu = Date.now()) {
    const samme = noegle != null && this.sidsteFelt?.noegle === noegle && nu - this.sidsteFelt.tid < 1500;
    this.sidsteFelt = noegle != null ? { noegle, tid: nu } : null;
    if (samme) return;
    this.fortrydStak.push(this.tilstand.model);
    if (this.fortrydStak.length > Store.MAX_TRIN) this.fortrydStak.shift();
    this.gentagStak = [];
  }
  private tilModel(model: Model) { this.opdater({ ...beregnTilstand(model, this.tilstand.valgtKombination), feltfejl: {} }); }
  fortryd(): boolean {
    const m = this.fortrydStak.pop();
    if (!m) return false;
    this.gentagStak.push(this.tilstand.model); this.sidsteFelt = null;
    this.tilModel(m);
    return true;
  }
  gentag(): boolean {
    const m = this.gentagStak.pop();
    if (!m) return false;
    this.fortrydStak.push(this.tilstand.model); this.sidsteFelt = null;
    this.tilModel(m);
    return true;
  }

  /** Sætter et felt fra rå indtastning. Ugyldig indtastning ændrer ikke modellen og gemmes som feltfejl. */
  saetFelt(f: FeltDef, raa: string | boolean): boolean {
    const t = tolkFelt(f, raa);
    const feltfejl = { ...this.tilstand.feltfejl };
    if (!t.ok) { feltfejl[f.k] = t; this.opdater({ ...this.tilstand, feltfejl }); return false; }
    delete feltfejl[f.k];
    const model = structuredClone(this.tilstand.model);
    saetSti(model, f.k, t.v);
    if (JSON.stringify(model) !== JSON.stringify(this.tilstand.model)) this.husk(f.k);
    this.opdater({ ...beregnTilstand(model, this.tilstand.valgtKombination), feltfejl });
    return true;
  }
  /** Ændrer modellen direkte (til tabeller: bolte og laster). */
  aendr(f: (m: Model) => void): void {
    const model = structuredClone(this.tilstand.model);
    f(model);
    if (JSON.stringify(model) === JSON.stringify(this.tilstand.model)) { this.opdater({ ...this.tilstand, feltfejl: {} }); return; }
    this.husk();
    this.opdater({ ...beregnTilstand(model, this.tilstand.valgtKombination), feltfejl: {} });
  }
  /** Indlæser en projektfil (JSON-tekst). Ved fatal fejl bevares den nuværende model. */
  indlaesTekst(tekst: string): void {
    let raa: unknown;
    try { raa = JSON.parse(tekst); } catch (e) { this.opdater({ ...this.tilstand, fejl: `Ugyldig JSON: ${(e as Error).message}` }); return; }
    const r = indlaesFil(raa);
    if (!r.model) { this.opdater({ ...this.tilstand, fejl: `Filen kan ikke indlæses (${r.fejl}).` }); return; }
    this.husk();
    this.opdater({ ...beregnTilstand(r.model), afvist: r.afvist, diagnostik: [...r.noter, ...beregnTilstand(r.model).diagnostik], feltfejl: {} });
  }
  vaelgKombination(i: number): void { this.opdater({ ...this.tilstand, valgtKombination: i }); }
  tilJson(): string { return JSON.stringify(this.tilstand.model, null, 2); }
}
