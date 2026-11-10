// Ankerarmering (EN 1992-4, 7.2.1.9 for træk og 7.2.2.6 for forskydning). Rene tal; ingen tekst.
import { vedhaeftning } from './concrete';
import { betonkegle, type KegleInput } from './cone';
import { kantafstand, KANTER, type Kanter, type KantNavn, type Pkt } from './geometry';
import type { Anker, ForskydningsFordeling } from './loads';
import type { KantKandidat, ForresteRaekke } from './edgebreakout';
import { udnyttelse, type Eftervisning, type TraekOversigt } from './tension';

export interface TraekArmering {
  aktiv: boolean; diameter: number; antalBoejler: number; fyk: number; afstand: number; daeklagTop: number;
  krog: boolean; eta1: number; cd: number | null; foering: 'stoed' | 'ingen'; forankringsdybde: number | null;
  /** Brugerens bekræftelse af forudsætningerne a, e og f i 7.2.1.2(2), som programmet ikke selv kan kontrollere. */
  bekraeft?: { a: boolean; e: boolean; f: boolean };
  /** Bøjleparrene drejet 90° om ankeret (kun tegning; beregningen er uafhængig af retningen). */
  drejet?: boolean;
  /** Afstand fra boltens akse til bøjleparrets plan (mm); null = lige fri af skaftet (d/2 + ⌀/2 + 2). Indgår i afstanden til benene. */
  planAfstand?: number | null;
  /** Frit drejningsvinkel af bøjleparrene om ankeret (°, kun tegning); null = 0° eller 90° efter 'drejet'. */
  vinkel?: number | null;
  /** Overfladearmering som bøjlerne omslutter (kun tegning): diameter og c/c-afstand. */
  fladeDiameter?: number; fladeAfstand?: number;
}
export interface ForskydningsArmering {
  aktiv: boolean; type: 'boejle' | 'overflade' | 'loekke'; kant: KantNavn | null; diameter: number;
  benPrAnker: number | null; antalBenIAlt: number | null; antalLoekker: number | null; antalBoejler: number | null;
  fyk: number; afstand: number | null; daekToAkse: number | null; l1: number | null; krog: boolean; eta1: number | null; es: number | null; cd: number | null;
  /** Afstand mellem bøjler/løkker (c/c, ind i elementet fra ankeret); null = alle regnes med og lægges ⌀+1 under hinanden. */
  afstandBoejler?: number | null;
  /** Brugerens bekræftelse af 7.2.2.2(3)f): kantstang langs kanten er dimensioneret med trykstivere (45°). Kun overfladearmering. */
  bekraeftKantstang?: boolean;
  /** Kantstang langs kanten (fig. 7.10 a), kun overfladearmering: diameter (mm). null = ikke angivet, så kantstangen eftervises ikke (kræver bekræftelse). */
  kantstangDiameter?: number | null;
  /** Trykstivernes vinkel fra belastningsretningen (vinkelret på kanten), °. Standard 45° (7.2.2.2(3)f). */
  trykstiverVinkel?: number | null;
}

/** Reduktion af forankringslængde ved stor dæklagstykkelse for bøjede stænger (cd > 3Ø). */
export const forankringsFaktor = (krog: boolean, cd: number | null, d: number): number => (krog && cd != null && cd > 3 * d ? 0.7 : 1);

/** Mindste bukkediameter for bøjler og kroge (EN 1992-1-1, Tabel 8.1N): 4⌀ for ⌀ ≤ 16 mm, ellers 7⌀. */
export const dornDiameter = (ds: number): number => (ds <= 16 ? 4 : 7) * ds;

export interface ForankringsLaengde { fbd: number; fyd: number; sigmaSd: number; lbRqd: number; lbMin: number; alpha: number; lbd: number }
/** Forankringslængde uden for brudlegemet (EN 1992-4, 7.2.1.2(2)d / 7.2.2.6 henviser til EN 1992-1-1, 8.4.4):
 *  lbd = α1·lb,rqd ≥ lb,min = max(0,3·lb,rqd; 10⌀; 100 mm), lb,rqd = ⌀/4·σsd/fbd med σsd = udnyttelsen af armeringen (N_re / V_re) · fyk/γs, højst fyd.
 *  Forenkling: α2–α5 = 1 (konservativt); α1 = 0,7 for bukkede ender med dæklag > 3⌀ (som i N_a). */
export function forankringsLaengde(p: { fck: number; eta1: number; ds: number; fyk: number; gammaS: number; krog: boolean; cd: number | null; alphaCt: number; gammaCt: number; udnyttelse?: number | null }): ForankringsLaengde {
  const b = vedhaeftning({ fck: p.fck, eta1: p.eta1, ds: p.ds, alphaCt: p.alphaCt, gammaCt: p.gammaCt });
  const fyd = p.fyk / p.gammaS, sigmaSd = fyd * Math.min(1, Math.max(0, p.udnyttelse ?? 1)), lbRqd = (p.ds / 4) * (sigmaSd / b.fbd), alpha = forankringsFaktor(p.krog, p.cd, p.ds);
  const lbMin = Math.max(0.3 * lbRqd, 10 * p.ds, 100);
  return { fbd: b.fbd, fyd, sigmaSd, lbRqd, lbMin, alpha, lbd: Math.max(alpha * lbRqd, lbMin) };
}

// ------------------------------------------------------------------ Træk

export type ManglerT = 'dia-over-16' | 'fyk-over-600' | 'afstand-over-0.75hef' | 'l1-for-kort' | 'intet-ben' | 'skaerer-skaft';
export interface ArmeringT {
  aktiv: boolean; virksom: boolean; mangler: ManglerT[];
  l1: number; l1Liste: number[]; l1min: number; rad: number; ben: number;
  /** Antal bøjler pr. anker i alt og hvor mange der ikke regnes med (l1 < minimum). */
  antalBoejler: number; ikkeVirksomme: number;
}

/** Virkning af ankerarmering for træk: forankringslængder l1 af hver bøjle (35°-kegle) og krav iht. 7.2.1.2(2). */
export function armeringTraekVirkning(ar: TraekArmering, hef: number, ankerD: number): ArmeringT {
  if (!ar.aktiv) return { aktiv: false, virksom: false, mangler: [], l1: 0, l1Liste: [], l1min: 0, rad: 0, ben: 0, antalBoejler: 0, ikkeVirksomme: 0 };
  const p = ar.diameter || 12;
  const n = 2 * ar.antalBoejler;
  const x = ar.afstand;
  const Mfri = ankerD / 2 + p / 2 + 2, M = ar.planAfstand != null && ar.planAfstand > 0 ? ar.planAfstand : Mfri;
  const rad = Math.hypot(x, M);
  const radOk = rad <= 0.75 * hef;
  const antal = n / 2, tan35 = Math.tan((35 * Math.PI) / 180);
  const l1min = (ar.krog ? 4 : 10) * p;
  const alle = Array.from({ length: antal }, (_, j) => hef - tan35 * rad - (ar.daeklagTop + j * (p + 1)));
  const virkListe = alle.map((v) => radOk && v >= l1min);
  const a = alle.filter((_v, i) => virkListe[i] || !radOk);
  const l1 = a.length ? Math.min(...a) : alle[0]!;
  const mangler: ManglerT[] = [];
  if (p > 16) mangler.push('dia-over-16');
  if (ar.fyk > 600) mangler.push('fyk-over-600');
  if (!radOk) mangler.push('afstand-over-0.75hef');
  if (M < ankerD / 2 + p / 2 - 1e-9) mangler.push('skaerer-skaft');
  if (l1 < l1min) mangler.push('l1-for-kort');
  if (!(ar.antalBoejler >= 1)) mangler.push('intet-ben');
  return { aktiv: true, virksom: mangler.length === 0, mangler, l1, l1Liste: a, l1min, rad, ben: 2 * a.length, antalBoejler: alle.length, ikkeVirksomme: alle.length - virkListe.filter(Boolean).length };
}

export interface TraekArmeringInput {
  ar: TraekArmering; virkning: ArmeringT; hef: number; fck: number;
  gammaMsRe: number; gammaMc: number; gammaCt: number; alphaCt: number;
  kegle: Omit<KegleInput, 'ankre' | 'e1' | 'e2' | 'momentfaktor' | 'hefOverstyring'>;
}
export interface TraekArmeringResultat { N_re: Eftervisning; N_a: Eftervisning; N_cre: Eftervisning }

const irr = (id: string): Eftervisning => ({ id, relevant: false, NEd: 0, NRd: 0, NRk: 0, udnyttelse: null, styrendeAnker: null });

/** N_re (armeringens flydning), N_a (forankring i brudlegemet) og N_cre (kegle ved armeringens ende). */
export function eftervisTraekArmering(p: TraekArmeringInput, t: TraekOversigt): TraekArmeringResultat {
  const ud = { N_re: irr('N_re'), N_a: irr('N_a'), N_cre: irr('N_cre') };
  if (!p.virkning.virksom || !(t.NEd_h > 0)) return ud;
  const e = p.virkning, d = p.ar.diameter;
  const As = (Math.PI / 4) * d * d;
  const NRk = e.ben * As * p.ar.fyk;
  const NRd = NRk / p.gammaMsRe;
  const N_re: Eftervisning = { id: 'N_re', relevant: true, NEd: t.NEd_h, NRd, NRk, udnyttelse: udnyttelse(t.NEd_h, NRd), styrendeAnker: t.idMaxN };
  const b = vedhaeftning({ fck: p.fck, eta1: p.ar.eta1, ds: d, alphaCt: p.alphaCt, gammaCt: p.gammaCt });
  const f = forankringsFaktor(p.ar.krog, p.ar.cd, d);
  const g = (As * p.ar.fyk) / p.gammaMsRe;
  const sum = 2 * e.l1Liste.reduce((s, l) => s + Math.min((l * Math.PI * d * b.fbd) / f, g), 0);
  const N_a: Eftervisning = { id: 'N_a', relevant: true, NEd: t.NEd_h, NRd: sum, NRk: 0, udnyttelse: udnyttelse(t.NEd_h, sum), styrendeAnker: t.idMaxN };
  let N_cre = irr('N_cre');
  if (p.ar.foering !== 'stoed') {
    const T = p.ar.forankringsdybde ?? p.hef;
    const k = betonkegle({ ...p.kegle, ankre: t.traekAnkre, e1: t.eN1, e2: t.eN2, momentfaktor: null, hefOverstyring: T });
    const A = k.NRk / p.gammaMc;
    N_cre = { id: 'N_cre', relevant: true, NEd: t.NEd_g, NRd: A, NRk: k.NRk, udnyttelse: udnyttelse(t.NEd_g, A), styrendeAnker: t.traekAnkre[0]?.id ?? null };
  }
  return { N_re, N_a, N_cre };
}

// ------------------------------------------------------------ Forskydning

/** Kant som forskydningsarmeringen vender mod (ri/ad): angivet fri kant, ellers den nærmeste. */
export function armeringsKant(angivet: KantNavn | null, ankre: Pkt[], kanter: Partial<Kanter>): KantNavn | null {
  if (angivet && kanter[angivet] != null) return angivet;
  let bedst: KantNavn | null = null, r = Infinity;
  for (const k of KANTER) {
    if (kanter[k] == null) continue;
    const a = Math.min(...ankre.map((q) => kantafstand(q, kanter, k)));
    if (a < r) { r = a; bedst = k; }
  }
  return bedst;
}

export interface ArmKant { kant: KantNavn; row: number[]; c1: number; R: { c1: number }; dist: ForskydningsFordeling }

/** Den række/kant som forskydningsarmeringen dækker (7.2.2.6) – fra kantbruddets kandidater. */
export function vaelgArmKant(ar: ForskydningsArmering, kanterPr: Partial<Record<KantNavn, KantKandidat>>, forreste: Partial<Record<KantNavn, ForresteRaekke>>, styrendeKant: KantNavn | null): ForresteRaekke | null {
  if (!ar.aktiv) return null;
  if (ar.kant) return kanterPr[ar.kant] ? (forreste[ar.kant] ?? null) : null;
  return styrendeKant ? (forreste[styrendeKant] ?? null) : null;
}

export interface Staenger { v: number; l1: number; virksom: boolean }

export type ManglerV = 'fyk-over-600' | 'dia-over-16' | 'ingen-virksomme-ben' | 'intet-virksomt-ben-forreste';
export interface ArmeringV {
  aktiv: boolean; virksom: boolean; mangler: ManglerV[]; form: 'boejle' | 'overflade' | 'loekke' | null;
  ben: number; l1min: number | null; l1: number | null; eta1: number; staenger: Staenger[] | null; antalVirksomme: number;
  /** Bøjler/løkker med afstand fra første (mm) og om de ligger inden for 0,5·c1; null uden angivet bøjleafstand. */
  boejler: { pos: number; virksom: boolean }[] | null; zone: number | null;
}

export interface VirkningVInput {
  ar: ForskydningsArmering; h: number; cnom: number; ankerD: number;
  ankre: (Anker)[]; kanter: Partial<Kanter>; forresteRaekkeTol: number;
  /** Rækken (forreste række mod armeringskanten) som armeringen dækker – null hvis ingen. */
  armKant: ForresteRaekke | null;
}

/** Overfladearmeringens stænger pr. anker (7.2.2.2(3)): lateral afstand v, forankringslængde l1 og om de er virksomme. */
function overfladeStaenger(p: VirkningVInput, kant: KantNavn, c1e: number | null): { staenger: Staenger[]; U: Anker[] } {
  const m = p.ar, k = m.diameter;
  const T = m.afstand ?? Math.max(p.ankerD * 1.8, 30);
  const daek = m.daekToAkse ?? 40;
  const F = p.ankre.map((q) => kantafstand(q, p.kanter, kant));
  const D = Math.min(...F);
  const ne = c1e != null ? c1e : D;
  const tol = Math.max(1, p.forresteRaekkeTol * D);
  const U = p.ankre.filter((_q, i) => F[i]! <= D + tol);
  const W = Math.max(1, Math.round(m.benPrAnker ?? Math.floor((m.antalBenIAlt ?? 2 * U.length) / U.length)));
  const G = (m.krog ? 4 : 10) * k;
  const Z = (v: number) => { const w = ne - Math.hypot(v, daek) / 1.5 - p.cnom; return m.l1 != null ? Math.min(m.l1, w) : w; };
  const staenger: Staenger[] = [];
  for (let i = 0; i < W; i++) {
    const v = (i % 2 ? -1 : 1) * (T + Math.floor(i / 2) * Math.max(4 * k, 50));
    const l1 = Z(v);
    staenger.push({ v, l1, virksom: Math.abs(v) <= 0.75 * D && l1 >= G });
  }
  return { staenger, U };
}

/** Virkning af ankerarmering for forskydning (xd). */
export function armeringForskydningVirkning(p: VirkningVInput): ArmeringV {
  const t = p.ar;
  const tom: ArmeringV = { aktiv: false, virksom: false, mangler: [], form: null, ben: 0, l1min: null, l1: null, eta1: 1, staenger: null, antalVirksomme: 0, boejler: null, zone: null };
  if (!t.aktiv) return tom;
  const dia = t.diameter, form = t.type;
  const mangler: ManglerV[] = [];
  if (t.fyk > 600) mangler.push('fyk-over-600');
  const e = p.armKant;
  const a = e ? e.ankre.length : 1;
  const l = t.benPrAnker ?? Math.floor((t.antalBenIAlt ?? 0) / a);
  let c = l, u: number | null = null, h: number | null = null, stg: Staenger[] | null = null;
  let boejler: ArmeringV['boejler'] = null, zone: number | null = null;
  if (form === 'overflade') {
    if (dia > 16) mangler.push('dia-over-16');
    h = (t.krog ? 4 : 10) * dia;
    if (e) {
      const { staenger, U } = overfladeStaenger(p, e.kant, e.R.c1);
      let y: { bars: Staenger[]; virk: Staenger[] } | null = null;
      for (const id of e.ankre) {
        const bars = U.some((q) => q.id === id) ? staenger : [];
        const virk = bars.filter((b) => b.virksom);
        if (!y || virk.length < y.virk.length) y = { bars, virk };
      }
      stg = y ? y.bars : [];
      c = y ? y.virk.length : 0;
      u = stg.length ? Math.min(...stg.filter((b) => b.virksom).map((b) => b.l1)) : null;
      if (c === 0) mangler.push('ingen-virksomme-ben');
    }
  } else {
    const n = form === 'boejle' ? (t.antalBoejler ?? Math.max(1, Math.ceil((l * a) / 2))) : (t.antalLoekker ?? Math.max(1, Math.ceil(l / 2)));
    let ne = n;
    if (t.afstandBoejler != null && t.afstandBoejler > 0) {
      // bøjler/løkker følger efter hinanden ind i elementet med afstanden s; kun dem inden for 0,5·c1 regnes med (fortolkning, skal verificeres)
      zone = 0.5 * (e ? e.R.c1 : Infinity);
      boejler = Array.from({ length: n }, (_v, j) => ({ pos: j * t.afstandBoejler!, virksom: j * t.afstandBoejler! <= zone! + 1e-9 }));
      ne = boejler.filter((b) => b.virksom).length;
    }
    c = form === 'boejle' ? (2 * ne) / a : 2 * ne;
  }
  if (form !== 'boejle' && !(c >= 1)) mangler.push('intet-virksomt-ben-forreste');
  const eta1 = t.eta1 ?? (p.h <= 250 ? 1 : 0.7);
  return { aktiv: true, virksom: mangler.length === 0, mangler, form, ben: c, l1min: h, l1: u, eta1, staenger: stg, antalVirksomme: c, boejler, zone };
}

export interface ForskydningsArmeringInput {
  ar: ForskydningsArmering; virkning: ArmeringV; armKant: ForresteRaekke; kantKandidat: KantKandidat | undefined;
  pladeAfstandTilBeton: number; pladeT: number; lastHoejde?: number | null; h: number; cnom: number; hef: number; fck: number;
  gammaMsRe: number; gammaCt: number; alphaCt: number;
  /** Basisfordeling (alle ankre) af forskydning. */
  fordeling: ForskydningsFordeling; ankre: Anker[];
}
export interface ForskydningsArmeringResultat { V_re: Eftervisning; V_a: Eftervisning; V_ek?: Eftervisning }

/** V_re (flydning af armering inkl. excentricitet) og V_a (forankring, kun overfladearmering). */
export function eftervisForskydningsArmering(p: ForskydningsArmeringInput): ForskydningsArmeringResultat {
  const { ar, virkning: e } = p;
  const d = ar.diameter;
  const es = ar.es ?? (p.lastHoejde ?? p.pladeAfstandTilBeton + p.pladeT) + (ar.daekToAkse ?? 40);
  const z = 0.85 * Math.min(p.h - p.cnom, 2 * p.hef, 2 * p.armKant.R.c1);
  const dists = [p.kantKandidat?.dist, p.armKant.dist].filter((x): x is ForskydningsFordeling => !!x && x.mulig !== false);
  let y = -1, g = 0;
  p.ankre.forEach((_q, j) => {
    const base = Math.hypot(p.fordeling.Vx[j]!, p.fordeling.Vy[j]!);
    const m = Math.max(base, ...dists.map((x) => x.V[j]!));
    if (m > y) { y = m; g = j; }
  });
  const id = p.ankre[g]!.id;
  const NEd = (es / z + 1) * y;
  const k10 = ar.type === 'overflade' ? 1 : 0.5;
  const As = (Math.PI / 4) * d * d;
  const NRk = k10 * e.ben * As * ar.fyk;
  const NRd = NRk / p.gammaMsRe;
  const V_re: Eftervisning = { id: 'V_re', relevant: true, NEd, NRd, NRk, udnyttelse: udnyttelse(NEd, NRd), styrendeAnker: id };
  if (e.form !== 'overflade') return { V_re, V_a: irr('V_a') };
  const b = vedhaeftning({ fck: p.fck, eta1: e.eta1, ds: d, alphaCt: p.alphaCt, gammaCt: p.gammaCt });
  const f = forankringsFaktor(ar.krog, ar.cd, d);
  const g2 = (As * ar.fyk) / p.gammaMsRe;
  const sum = (e.staenger ?? []).filter((s) => s.virksom).reduce((s, st) => s + Math.min((st.l1 * Math.PI * d * b.fbd) / f, g2), 0);
  const V_a: Eftervisning = { id: 'V_a', relevant: true, NEd, NRd: sum, NRk: 0, udnyttelse: udnyttelse(NEd, sum), styrendeAnker: id };
  // kantstang (fig. 7.10 a, 7.2.2.2(3)f): trykstivere fra ankeret til knuderne ved de vinkelrette stænger; kantstangen er trækbånd mellem knuderne.
  // Kraft pr. vinkelret stang = NEd/n (n = virksomme stænger pr. anker). Strutten har den tværgående komposant F_stang·tan(α) (α fra belastningsretningen),
  // som kantstangen optager som træk: T_ek = F_stang·tan α (α = 45° → T_ek = F_stang).
  if (ar.kantstangDiameter != null && ar.kantstangDiameter > 0) {
    const n = Math.max(1, e.ben), alfa = ((ar.trykstiverVinkel ?? 45) * Math.PI) / 180, T = (NEd / n) * Math.tan(alfa);
    const NRk_ek = ((Math.PI / 4) * ar.kantstangDiameter ** 2) * ar.fyk, NRd_ek = NRk_ek / p.gammaMsRe;
    const V_ek: Eftervisning = { id: 'V_ek', relevant: true, NEd: T, NRd: NRd_ek, NRk: NRk_ek, udnyttelse: udnyttelse(T, NRd_ek), styrendeAnker: id };
    return { V_re, V_a, V_ek };
  }
  return { V_re, V_a };
}
