// Ét state: model → (indlæsning/normalisering) → beregning. Alle ændringer går gennem `saet`/`erstat`; resultatet afledes altid.
import { beregnProjekt, type ProjektResultat } from '../core/beregn';
import type { Diagnostik } from '../core/diagnostik';
import { indlaesFil, standardModel, type Afvist } from '../core/indlaes';
import { afledAs, indlaesProjekt } from '../core/inddata';
import { fckAf } from '../core/concrete';
import { anvendHilti, erHiltiHY200V3, hiltiPsiC, STOERRELSER, type Stoerrelse } from '../core/produkter';
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

/** Holder afledte felter i modellen i trit med deres grundlag (så skrivebeskyttede felter viser den værdi, der regnes med). */
export function synkAfledte(model: Model): void {
  const a = (model as { anker?: Record<string, any> }).anker;
  if (!a) return;
  if (typeof a.d === 'number' && Number.isFinite(a.d) && a.d > 0) a.As = Math.round(afledAs(a.d, a.gevind !== false) * 10) / 10; // kun til visning; kernen afleder selv den eksakte værdi
  // ψc for Hilti HIT-HY 200 V3 følger betonklassen: ψc = (fck/20)^0,1 (ETA-19/0601, Tabel C1).
  if (erHiltiHY200V3(a.produkt)) {
    const fck = fckAf((model as { beton?: { klasse?: string; fck?: number | null } }).beton ?? {});
    if (Number.isFinite(fck) && fck > 0) a.psiC = hiltiPsiC(fck);
  }
}

/**
 * Når boltdiameteren skiftes, følger de størrelsesafhængige værdier med:
 * - Hilti HIT-HY 200 V3: produktdata hentes igen for den nye størrelse (samme temperaturområde og borehul).
 * - Uden produkt: hovedmål (dh, th, hovedside) skaleres med d_ny/d_gammel, og d0 forskydes med samme tillæg.
 * Andre produkter røres ikke (kernen advarer ikke om dem; brugeren skal anvende produktet igen).
 */
export function foelgDiameter(model: Model, dGammel: number, dNy: number): void {
  const a = (model as { anker?: Record<string, any> }).anker;
  if (!a || !(dGammel > 0) || !(dNy > 0) || dGammel === dNy) return;
  if (erHiltiHY200V3(a.produkt)) {
    if ((STOERRELSER as readonly number[]).includes(dNy)) {
      const t = a.psi0Sus === 0.89 ? 'II' : a.psi0Sus === 0.72 ? 'III' : 'I';
      anvendHilti(model as never, dNy as Stoerrelse, t, a.gammaInst === 1.4 ? 'vandfyldt' : 'toert-vaadt');
    }
    return;
  }
  if (a.produkt) return;
  const k = dNy / dGammel, mm = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * k) : v);
  a.dh = mm(a.dh); a.th = mm(a.th); if (a.hovedSide != null) a.hovedSide = mm(a.hovedSide);
  if (typeof a.d0 === 'number' && Number.isFinite(a.d0)) a.d0 = Math.max(dNy + 1, a.d0 + dNy - dGammel);
}

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
    if (f.k === 'anker.d') foelgDiameter(model, Number(this.tilstand.model.anker?.d), Number(t.v));
    synkAfledte(model);
    if (JSON.stringify(model) !== JSON.stringify(this.tilstand.model)) this.husk(f.k);
    this.opdater({ ...beregnTilstand(model, this.tilstand.valgtKombination), feltfejl });
    return true;
  }
  /** Ændrer modellen direkte (til tabeller: bolte og laster). */
  aendr(f: (m: Model) => void): void {
    const model = structuredClone(this.tilstand.model);
    f(model);
    synkAfledte(model);
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
    // En gemt As, der ikke passer til d (fx fra en ældre version), rettes og noteres, så brugeren ser det.
    const gemt = (r.model as { anker?: { As?: unknown } }).anker?.As;
    synkAfledte(r.model);
    const ny = (r.model as { anker?: { As?: unknown; d?: unknown } }).anker;
    const noter = [...r.noter];
    if (typeof gemt === 'number' && typeof ny?.As === 'number' && Math.abs(gemt - ny.As) > 0.005 * ny.As) {
      noter.push({ niveau: 'advarsel', kode: 'as-afledt-af-d', felt: 'anker.As', paragraf: 'ISO 898-1', data: { d: ny.d as number, angivet: gemt, As: ny.As } });
    }
    const b = beregnTilstand(r.model);
    this.opdater({ ...b, afvist: r.afvist, diagnostik: [...noter, ...b.diagnostik], feltfejl: {} });
  }
  vaelgKombination(i: number): void { this.opdater({ ...this.tilstand, valgtKombination: i }); }
  tilJson(): string { return JSON.stringify(this.tilstand.model, null, 2); }
}
