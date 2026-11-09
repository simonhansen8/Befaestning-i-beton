// Modelvalidering på tværs af felter (geometri, produktgrænser, gyldighedsområder). Rene funktioner → Diagnostik[].
import { fckAfKlasse } from './concrete';
import { DK_NA, GAMMA3_AF_KONTROLKLASSE } from './constants';
import { diag, EN, type Diagnostik } from './diagnostik';
import { kantafstand, KANTER } from './geometry';
import type { Indstillinger } from './settings';
import type { Kernemodel } from './kombination';

/** Hulfrigang df [mm] for boltdiameter (EN 1992-4 Tabel 6.1 / EN 1090-2). */
const HUL: Record<number, number> = { 6: 7, 8: 9, 10: 12, 12: 14, 14: 16, 16: 18, 18: 20, 20: 22, 22: 24, 24: 26, 27: 30, 30: 33 };
export const hulfrigangsDiameter = (d: number): number => HUL[d] ?? d + 3;

export const STANDARD_BETONKLASSER = ['C12/15', 'C16/20', 'C20/25', 'C25/30', 'C30/37', 'C35/45', 'C40/50', 'C45/55', 'C50/60', 'C55/67', 'C60/75', 'C70/85', 'C80/95', 'C90/105'];

export interface ValideringsModel extends Kernemodel {
  anker: Kernemodel['anker'] & { smin: number | null; cmin: number | null; hefMin: number | null; hefMax: number | null; betonMin: string; betonMax: string; fuk: number; fyk: number; dnom: number };
  beton: Kernemodel['beton'] & { urevnet: { sigmaL: number | null; sigmaR: number }; klasse: string };
}

export function validerModel(m: ValideringsModel, ind: Indstillinger, fck: number, sigmaAdm = 0): Diagnostik[] {
  const e: Diagnostik[] = [];
  const i = m.anker, s = m.beton, r = m.plade, o = s.kanter, a = m.opstilling.anker;
  const indl = i.type === 'indlimet', c = i.d, df = hulfrigangsDiameter(c);
  for (const q of a) {
    for (const k of KANTER) if (kantafstand(q, o, k) < 0) e.push(diag('fejl', 'bolt-uden-for-beton', '§11', `anker.${q.id}`, { id: q.id, kant: k }));
    if (Math.abs(q.x) > r.bx / 2 - df / 2 || Math.abs(q.y) > r.by / 2 - df / 2) {
      e.push(diag('fejl', 'bolt-uden-for-fodplade', '§11', `anker.${q.id}`, { id: q.id, bx: r.bx, by: r.by, df }));
    } else {
      const t = Math.min(r.bx / 2 - Math.abs(q.x), r.by / 2 - Math.abs(q.y));
      if (t < 1.2 * df) e.push(diag('advarsel', 'bolt-taet-paa-pladekant', 'EN 1993-1-8, Tabel 3.3', `anker.${q.id}`, { id: q.id, afstand: t, grænse: 1.2 * df }));
    }
  }
  const smin = i.smin ?? 5 * c;
  for (let p = 0; p < a.length; p++) for (let q = p + 1; q < a.length; q++) {
    const s2 = Math.hypot(a[p]!.x - a[q]!.x, a[p]!.y - a[q]!.y);
    if (s2 < 1) e.push(diag('fejl', 'bolte-sammenfaldende', '§4.1', `anker.${a[q]!.id}`, { id1: a[p]!.id, id2: a[q]!.id, s: s2 }));
    else if (s2 < smin) e.push(diag(i.smin != null ? 'fejl' : 'advarsel', 'bolteafstand-under-smin', '7.1 / ETA', `anker.${a[q]!.id}`, { id1: a[p]!.id, id2: a[q]!.id, s: s2, smin, kilde: i.smin != null ? (indl ? 'ETA' : 'produkt') : 'standard 5d' }));
  }
  const f = indl ? 5 * c : Math.max(5 * c, s.cnom + i.dh / 2), cmin = i.cmin ?? f;
  for (const q of a) {
    const t = Math.min(...KANTER.map((k) => kantafstand(q, o, k)));
    if (!indl && t >= 0 && t < i.dh / 2) e.push(diag('fejl', 'hoved-uden-for-beton', '§11', `anker.${q.id}`, { id: q.id, c: t, halvHoved: i.dh / 2 }));
    else if (t >= 0 && t < cmin) e.push(diag(i.cmin != null ? 'fejl' : 'advarsel', 'kantafstand-under-cmin', '7.1 / ETA', `anker.${q.id}`, { id: q.id, c: t, cmin, kilde: i.cmin != null ? (indl ? 'ETA' : 'produkt') : indl ? 'standard 5d' : 'skøn' }));
  }
  const hmin = indl ? (i.hmin ?? Math.max(i.hef + 30, i.hef + 2 * i.d0, 100)) : (i.hmin ?? i.hef + i.th + Math.max(50, s.cnom));
  if (s.h < hmin) e.push(diag('fejl', 'tykkelse-under-hmin', 'ETA / EAD 330924', 'beton.h', { h: s.h, hmin, angivet: i.hmin != null }));
  if (i.hef < 40) e.push(diag('fejl', 'hef-under-40', EN('1.3(2)'), 'anker.hef', { hef: i.hef }));
  if (indl) {
    if (i.hefMin != null && i.hef < i.hefMin) e.push(diag('fejl', 'hef-under-hefmin', 'ETA', 'anker.hef', { hef: i.hef, hefMin: i.hefMin }));
    if (i.hefMax != null && i.hef > i.hefMax) e.push(diag('fejl', 'hef-over-hefmax', 'ETA', 'anker.hef', { hef: i.hef, hefMax: i.hefMax }));
    if (i.hef > 20 * c) e.push(diag('fejl', 'hef-over-20d', EN('1.3(2)'), 'anker.hef', { hef: i.hef, grænse: 20 * c }));
    else if (i.hef < 4 * c) e.push(diag('advarsel', 'hef-under-4d', 'ETA', 'anker.hef', { hef: i.hef, grænse: 4 * c }));
    const lo = fckAfKlasse(i.betonMin), hi = fckAfKlasse(i.betonMax);
    if ((Number.isFinite(lo) && fck < lo) || (Number.isFinite(hi) && fck > hi)) e.push(diag('advarsel', 'betonklasse-uden-for-eta', 'ETA', 'beton.klasse', { klasse: s.klasse, min: i.betonMin, max: i.betonMax }));
    if (s.revnet && i.tauRkCr == null) e.push(diag('fejl', 'taurk-cr-mangler', 'ETA', 'anker.tauRkCr'));
    if (!s.revnet && i.tauRkUcr == null) e.push(diag('fejl', 'taurk-ucr-mangler', EN('4.7 (2)'), 'anker.tauRkUcr'));
    if (i.tauRkCr != null && i.tauRkUcr != null && i.tauRkUcr < i.tauRkCr) e.push(diag('advarsel', 'taurk-ucr-under-cr', 'ETA', 'anker.tauRkUcr'));
    e.push(diag('info', 'produktvaerdier-fra-eta', 'ETA', null));
  } else {
    if (i.dh > 6 * i.th + c) e.push(diag('info', 'hoved-areal-begraenset', '7.2.1.5', 'anker.th', { dh: i.dh, grænse: 6 * i.th + c }));
    if (i.ccrSp == null) e.push(diag('info', 'ccrsp-er-skoen', EN('7.2.1.7'), 'anker.ccrSp'));
  }
  if (fck > 60) e.push(diag('info', 'fck-over-60', EN('7.1(2)'), 'beton.fck', { fck }));
  if (!(fck >= 12 && fck <= 90)) e.push(diag('advarsel', 'fck-uden-for-c12-c90', EN('1.1'), 'beton.klasse', { fck }));
  if (!STANDARD_BETONKLASSER.includes(s.klasse) && (m.beton as { fck?: number | null }).fck == null) e.push(diag('info', 'betonklasse-ikke-standard', 'EN 1992-1-1, Tabel 3.1', 'beton.klasse', { klasse: s.klasse, fck }));
  if (i.dnom > 60) e.push(diag('advarsel', 'dnom-over-60', EN('7.2.2.5'), 'anker.dnom', { dnom: i.dnom }));
  if (i.fuk > 1000) e.push(diag('fejl', 'fuk-over-1000', EN('7.2.2.3.1'), 'anker.fuk', { fuk: i.fuk }));
  const ud: string[] = [];
  if (o.xNeg != null && r.bx / 2 > o.xNeg) ud.push('x'); if (o.xPos != null && r.bx / 2 > o.xPos) ud.push('x+');
  if (o.yNeg != null && r.by / 2 > o.yNeg) ud.push('y'); if (o.yPos != null && r.by / 2 > o.yPos) ud.push('y+');
  const tom = (o.xNeg != null && o.xPos != null && -o.xNeg >= o.xPos) || (o.yNeg != null && o.yPos != null && -o.yNeg >= o.yPos) ||
    (o.xNeg != null && -o.xNeg >= r.bx / 2) || (o.xPos != null && o.xPos <= -r.bx / 2) || (o.yNeg != null && -o.yNeg >= r.by / 2) || (o.yPos != null && o.yPos <= -r.by / 2);
  if (tom) e.push(diag('fejl', 'plade-ikke-paa-beton', EN('6.2.1'), 'plade.bx'));
  else if (ud.length) e.push(diag('advarsel', 'plade-rager-ud-over-kant', EN('6.2.1'), 'plade.bx', { kanter: ud.join(', ') }));
  e.push(diag('info', 'plade-forudsat-stiv', EN('6.2.1 (2)'), 'plade.t'));
  e.push(diag('info', 'ligningsnumre-ikke-kontrolleret', 'EN 1992-4', null));
  if (r.t < c) e.push(diag('advarsel', 'plade-tynd', EN('6.2.1 (2)'), 'plade.t', { t: r.t, d: c }));
  if (r.hulfrigang === 'stor') e.push(diag('advarsel', 'stor-hulfrigang', EN('6.2.2.1 / Tabel 6.1'), 'plade.hulfrigang'));
  if (r.mellemlaeg === 'ingen' && (r.afstandTilBeton ?? 0) > 0) e.push(diag('advarsel', 'mellemlaeg-inkonsistent', EN('6.2.2.3'), 'plade.mellemlaeg', { e: r.afstandTilBeton ?? 0 }));
  if (a.some((q) => q.slids)) e.push(diag('info', 'slidshuller', EN('6.2.2.2 (2)'), null, { bolte: a.filter((q) => q.slids).map((q) => `${q.id} (${q.slids})`).join(', ') }));
  if (!s.revnet) {
    e.push(diag('info', 'urevnet-forudsaetning', EN('4.7 (2)') + ' + DK NA', 'beton.revnet'));
    const sl = s.urevnet.sigmaL;
    if (sl != null && sl + s.urevnet.sigmaR > sigmaAdm) e.push(diag('advarsel', 'urevnet-ikke-eftervist', EN('4.7 (2)'), 'beton.urevnet.sigmaL', { sum: sl + s.urevnet.sigmaR, sigmaAdm }));
  }
  const ar = s.armering;
  if (ar.kantarmering === 'boejler' && s.revnet && i.hef < 2.5 * s.cnom) e.push(diag('advarsel', 'psi-re-v-hef-for-lille', EN('7.2.2.5'), 'beton.armering.kantarmering', { hef: i.hef, grænse: 2.5 * s.cnom }));
  if (ar.kantarmering === 'boejler' && s.revnet) {
    if (ar.kantarmeringAfstand == null || ar.kantarmeringDiameter == null || ar.kantarmeringAfstand > 100 || ar.kantarmeringDiameter < 12) e.push(diag('advarsel', 'psi-re-v-krav-ikke-opfyldt', EN('7.2.2.5'), 'beton.armering.kantarmeringAfstand'));
    else e.push(diag('info', 'psi-re-v-krav-pr-kant', EN('7.2.2.5'), 'beton.armering.kantarmeringAfstand'));
  }
  if (ar.ankerarmeringTraek.aktiv) e.push(diag('advarsel', 'ankerarmering-traek-forbehold', EN('7.2.1.2(2)a, e, f'), 'beton.armering.ankerarmeringTraek.aktiv', { stoed: ar.ankerarmeringTraek.foering === 'stoed' }));
  if (ar.ankerarmeringForskydning.aktiv) e.push(diag('advarsel', 'ankerarmering-forskydning-forbehold', EN('7.2.2.2(2)'), 'beton.armering.ankerarmeringForskydning.aktiv', { type: ar.ankerarmeringForskydning.type }));
  return e;
}

/** Nationale parametre der afviger fra DK NA (til dokumentation). γ3 sammenlignes med værdien fra kontrolklassen. */
export function afvigelserFraDkNa(ind: Indstillinger, gamma3Effektiv: number): Diagnostik[] {
  const std: Record<string, number> = { ...DK_NA, gamma3: GAMMA3_AF_KONTROLKLASSE[ind.kontrolklasse] };
  const nu: Record<string, number> = {
    gammaC: ind.gammaC, gamma3: gamma3Effektiv, gammaInstIndstoebt: ind.gammaInstIndstoebt, gammaMsRe: ind.gammaMsRe, gammaCt: ind.gammaCt, alphaCt: ind.alphaCt,
    gammaMsTraekFaktor: ind.gammaMsTraekFaktor, gammaMsTraekMin: ind.gammaMsTraekMin, gammaMsForskFaktor: ind.gammaMsForskFaktor, gammaMsForskMin: ind.gammaMsForskMin,
    gammaMsForskHoej: ind.gammaMsForskHoej, Es: ind.Es,
  };
  const ud: Diagnostik[] = [];
  for (const k of ['gammaC', 'gamma3', 'gammaInstIndstoebt', 'gammaMsRe', 'gammaCt', 'alphaCt', 'gammaMsTraekFaktor', 'gammaMsTraekMin', 'gammaMsForskFaktor', 'gammaMsForskMin', 'gammaMsForskHoej', 'Es']) {
    if (nu[k] !== std[k]) ud.push(diag('info', 'national-parameter-aendret', 'DK NA', `indstillinger.${k}`, { parameter: k, vaerdi: nu[k]!, dkNa: std[k]! }));
  }
  if (ind.EcOverstyring != null) ud.push(diag('info', 'national-parameter-aendret', 'DK NA', 'indstillinger.Ec', { parameter: 'Ec', vaerdi: ind.EcOverstyring, dkNa: null }));
  return ud;
}
