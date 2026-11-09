// Typer for felt-skemaet. Modellen er den indlæste projektmodel (se core/indlaes.ts).
export type Model = Record<string, any>;

export type FeltType = 'seg' | 'select' | 'switch' | 'num' | 'text' | 'date';

export interface FeltDef {
  /** Sti i modellen, fx 'anker.hef'. */
  k: string;
  /** Nøgle til fremhævning i tegningen. */
  hl: string;
  /** Symbol (HTML) og etiket. */
  sym: string;
  lbl: string;
  unit?: string;
  type: FeltType;
  /** For 'select'/'seg': [værdi, tekst]. */
  options?: [string | number, string][];
  /** Værdien er et tal (select). */
  num?: boolean;
  min?: number; max?: number;
  /** Grænsen er eksklusiv. */
  minEx?: number;
  int?: boolean;
  dec?: number;
  nullable?: boolean;
  readonly?: boolean;
  /** Standardværdi (tal) når feltet er tomt/ikke angivet. */
  dk?: number | string | boolean;
  /** Tekst for det der regnes med når feltet er tomt. */
  std?: (m: Model) => string;
  /** Vises kun når betingelsen er opfyldt. */
  show?: (m: Model) => boolean;
  /** Returnerer en forklaring når feltet er deaktiveret, ellers null. */
  disabled?: (m: Model) => string | null;
  /** Avanceret felt (skjules som standard). */
  adv?: boolean;
  /** Eksempel/ETA-fortolkning. */
  ex?: boolean | ((m: Model) => boolean);
  /** Verifikationskode (se verifikationsplanen) når værdien skal verificeres. */
  verify?: (m: Model) => string | null;
  note?: string;
  sub?: string;
  tip: string;
  ref: string;
}

/** Underrubrik eller note mellem felter. */
export interface Underrubrik { sub?: string; note?: string; show?: (m: Model) => boolean; adv?: boolean }
/** Felt med egen visning (fx kantafstande, nulstil nationale parametre). */
export interface SpecielFelt { custom: string; which?: string; show?: (m: Model) => boolean }
export type Felt = FeltDef | Underrubrik | SpecielFelt;

export interface Sektion {
  id: string;
  no: string;
  title: string;
  summary: (m: Model) => string;
  fields?: Felt[];
  /** Sektionen har egen visning (fx opstilling). */
  custom?: string;
}
