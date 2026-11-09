// Indlæsning af projektfiler, trin 1: flet en vilkårlig JSON-fil ind over standardmodellen. Ugyldige værdier afvises
// (standardværdien bevares) og gamle feltnavne migreres. Resultatet er en fuldstændig, ensartet model. Ingen tekst.
import { STANDARD_BETONKLASSER } from './validering';
import { STAALKLASSER } from './constants';
import { diag, type Diagnostik } from './diagnostik';

type Obj = Record<string, any>;

export const PROJEKT_VERSION = 1;

/** Standardmodel (som nyt projekt). `dato` angives udefra, så funktionen er ren. */
export function standardModel(dato = ''): Obj {
  return {
    version: PROJEKT_VERSION,
    projekt: { navn: 'Eksempel: søjlefod HE200B ved kant', element: 'Fundament F3, akse B/4', nr: '', udfoertAf: '', kontrolleretAf: '', dato, eksempel: true },
    beton: {
      klasse: 'C30/37', fck: null, revnet: true, urevnet: { sigmaL: null, sigmaR: 3 }, h: 500, cnom: 30,
      kanter: { xNeg: 250, xPos: null, yNeg: null, yPos: null },
      armering: {
        afskalning: 'taet', kantarmering: 'ingen', kantarmeringAfstand: null, kantarmeringDiameter: null, splitArmering: false,
        ankerarmeringTraek: { aktiv: false, diameter: 12, antalBoejler: 1, fyk: 500, afstand: 50, daeklagTop: 40, krog: true, eta1: 1, foering: 'ingen', forankringsdybde: null, cd: null },
        ankerarmeringForskydning: {
          aktiv: false, type: 'boejle', diameter: 10, benPrAnker: 2, antalBoejler: 1, antalLoekker: 1, fyk: 500, afstand: 50, daekToAkse: 40,
          l1: null, krog: true, eta1: null, kant: null, es: null, cd: null,
        },
      },
    },
    anker: {
      type: 'indstoebt', d: 20, dnom: null, gevind: true, As: 245, hef: 180, staalklasse: '8.8', fuk: 800, fyk: 640, duktil: true,
      dh: 40, th: 16, hovedForm: 'rund', hovedSide: null, produkt: '', d0: 24, hefMin: 90, hefMax: 400, tauRkCr: 6.5, tauRkUcr: 13,
      psiC: 1, psi0Sus: 0.74, alphaSus: 0.6, kcrN: 7.7, kucrN: 11, ccrN: null, scrN: null, ccrSp: null, scrSp: null, hmin: null, cmin: null, smin: null,
      k7: null, k8: null, k11: 0.6667, gammaInst: 1.2, NRksEta: null, VRksEta: null, M0RksEta: null, betonMin: 'C20/25', betonMax: 'C50/60',
    },
    plade: { bx: 340, by: 340, t: 25, hulfrigang: 'normal', afstandTilBeton: 0, mellemlaeg: 'ingen', indspaending: 'fri' },
    opstilling: {
      type: '4', sx: 240, sy: 240, n: 6, r: 150, vinkel: 0,
      anker: [{ id: 1, x: -120, y: -120, slids: null }, { id: 2, x: 120, y: -120, slids: null }, { id: 3, x: -120, y: 120, slids: null }, { id: 4, x: 120, y: 120, slids: null }],
    },
    laster: [
      { navn: 'LK1 vind', N: 75e3, Vx: -18e3, Vy: 0, Mx: 0, My: -6e6, T: 0, alphaSus: 0 },
      { navn: 'LK2 egen', N: -12e4, Vx: -3e4, Vy: 8e3, Mx: 0, My: 22e6, T: 0, alphaSus: null },
      { navn: 'LK3 vind y', N: 4e4, Vx: 0, Vy: 22e3, Mx: 9e6, My: 0, T: 15e5, alphaSus: 0 },
    ],
    indstillinger: {
      kontrolklasse: 'normal', gamma3: 1, gammaC: 1.45, gammaInstIndstoebt: 1, gammaMsRe: 1.2, gammaCt: 1.7, alphaCt: 1,
      gammaMsTraekFaktor: 1.2, gammaMsTraekMin: 1.5, gammaMsForskFaktor: 1, gammaMsForskMin: 1.35, gammaMsForskHoej: 1.65,
      konsekvensklasse: 'CC2', kfiPaaLaster: false, sigmaAdm: 0, Es: 21e4, Ec: null, interaktion: 'gunstigst',
      staalInteraktionVedLoeftestang: 'undtag', forresteRaekkeTol: 0.1, pryoutEnkeltanker: 'retning',
    },
    meta: { redigeret: {} },
  };
}

/** Streng talparser (dansk): komma som decimaltegn, punktum kun som tusindtalsseparator. */
export function parseTal(n: unknown): number {
  if (typeof n === 'number') return Number.isFinite(n) ? n : NaN;
  if (n == null) return NaN;
  let e = String(n).replace(/[\s   ]/g, '').replace(/[−–]/g, '-');
  if (e === '' || e === '-') return NaN;
  if (e.startsWith('+')) e = e.slice(1);
  if ((e.match(/,/g) || []).length > 1) return NaN;
  if ((e.match(/\./g) || []).length > 0) {
    if (!/^-?\d{1,3}(\.\d{3})+(,\d*)?$/.test(e)) return NaN;
    e = e.replace(/\./g, '');
  }
  e = e.replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(e)) return NaN;
  const s = Number(e);
  return Number.isFinite(s) ? s : NaN;
}
const talFraFelt = (n: unknown): number => (typeof n === 'number' ? (Number.isFinite(n) ? n : NaN) : typeof n === 'string' ? parseTal(n.trim().replace(/^M(?=\d)/i, '')) : NaN);
const boolFraFelt = (n: unknown): boolean | undefined =>
  typeof n === 'boolean' ? n : n === 'true' || n === 1 || n === '1' || n === 'ja' ? true : n === 'false' || n === 0 || n === '0' || n === 'nej' ? false : undefined;

const TILLADT: Record<string, readonly (string | null)[]> = {
  'anker.type': ['indstoebt', 'indlimet'], 'anker.hovedForm': ['rund', 'firkant'],
  'beton.armering.afskalning': ['taet', 'aaben'], 'beton.armering.kantarmering': ['ingen', 'boejler'],
  'beton.armering.ankerarmeringForskydning.type': ['boejle', 'overflade', 'loekke'],
  'plade.hulfrigang': ['normal', 'stor'], 'plade.mellemlaeg': ['ingen', 'moertel', 'aaben'], 'plade.indspaending': ['fri', 'fuld'],
  'indstillinger.kontrolklasse': ['lempet', 'normal'], 'beton.armering.ankerarmeringTraek.foering': ['stoed', 'ingen'],
  'indstillinger.konsekvensklasse': ['CC1', 'CC2', 'CC3'], 'indstillinger.interaktion': ['gunstigst', 'potens', 'lineaer'],
  'indstillinger.staalInteraktionVedLoeftestang': ['eftervis', 'undtag'], 'indstillinger.pryoutEnkeltanker': ['retning', 'altid'],
  'beton.armering.ankerarmeringForskydning.kant': [null, 'xNeg', 'xPos', 'yNeg', 'yPos'],
  'beton.klasse': STANDARD_BETONKLASSER.slice(0, 11), 'anker.betonMin': STANDARD_BETONKLASSER.slice(0, 11), 'anker.betonMax': STANDARD_BETONKLASSER.slice(0, 11),
  'anker.staalklasse': [...Object.keys(STAALKLASSER).filter((k) => ['4.6', '5.6', '5.8', '8.8', '10.9', 'A4-70', 'A4-80', 'SD'].includes(k)), 'bruger'],
};
const STANDARD_DIAMETRE = [8, 10, 12, 16, 20, 22, 24, 27, 30];
const erObj = (x: unknown): x is Obj => x != null && typeof x === 'object' && !Array.isArray(x);

/** Migrerer gamle feltnavne og normerer enkelte værdier (ændrer `n` direkte). */
function migrer(n: Obj, noter: Diagnostik[]): void {
  const t = n.beton?.armering;
  if (t) {
    if ('taetArmering' in t && !('afskalning' in t)) {
      t.afskalning = 'taet';
      noter.push(diag('info', 'taetArmering-erstattet', 'EN 1992-4, 7.2.1.4', 'beton.armering.afskalning'));
    }
    delete t.taetArmering;
    if (t.kantarmering === 'lige') { t.kantarmering = 'ingen'; noter.push(diag('info', 'kantstang-lige-fjernet', 'EN 1992-4, 7.2.2.5', 'beton.armering.kantarmering')); }
    const s = n.opstilling?.anker?.length || 1;
    for (const r of ['ankerarmeringTraek', 'ankerarmeringForskydning']) {
      const o = t[r];
      if (o && 'antalBen' in o && !('benPrAnker' in o)) {
        o.benPrAnker = Math.max(1, Math.round(o.antalBen / s));
        noter.push(diag('info', 'antal-ben-omregnet', '', `beton.armering.${r}`, { antalBen: o.antalBen, benPrAnker: o.benPrAnker }));
      }
      if (o) delete o.antalBen;
    }
  }
  const i = n.anker;
  if (i) {
    if ('psiSus' in i && !('psi0Sus' in i)) i.psi0Sus = i.psiSus;
    delete i.psiSus;
    if ('k1' in i && !('kcrN' in i)) i.kcrN = i.k1;
    delete i.k1;
  }
  const ind = n.indstillinger;
  if (ind?.kontrolklasse === 'skaerpet') {
    ind.kontrolklasse = 'normal'; ind.gamma3 = 1;
    noter.push(diag('advarsel', 'skaerpet-kontrolklasse', 'DK NA', 'indstillinger.kontrolklasse'));
  }
  // Bevidst afvigelse fra den gamle indlæsning: en angivet γ3 overskrives ikke længere af kontrolklassen (γ3 kan overstyres manuelt).
  if (n.plade?.hulfrigang === 'slids') { n.plade.hulfrigang = 'normal'; noter.push(diag('info', 'slidshul-pr-bolt', 'EN 1992-4, 6.2.2', 'plade.hulfrigang')); }
}

export interface Afvist { felt: string; vaerdi: unknown }
export interface FilResultat {
  model: Obj | null;
  /** Værdier der blev afvist (standardværdi bevaret). */
  afvist: Afvist[];
  noter: Diagnostik[];
  /** Fatal fejl: filen kan ikke bruges. */
  fejl: 'ikke-objekt' | 'mangler-hovedfelter' | 'ingen-bolte' | 'ingen-laster' | null;
}

export function indlaesFil(raa: unknown, opt: { fraBruger?: boolean; dato?: string } = {}): FilResultat {
  const afvist: Afvist[] = [], noter: Diagnostik[] = [];
  const fatal = (fejl: NonNullable<FilResultat['fejl']>): FilResultat => ({ model: null, afvist, noter, fejl });
  if (!erObj(raa)) return fatal('ikke-objekt');
  const n = structuredClone(raa) as Obj;
  if (!n.anker || !n.beton || !n.opstilling || !Array.isArray(n.laster)) return fatal('mangler-hovedfelter');
  migrer(n, noter);
  const s = standardModel(opt.dato ?? ''), r = structuredClone(s);
  const flet = (d: Obj, h: Obj, f: Obj, sti: string) => {
    for (const b of Object.keys(d)) {
      const p = sti ? `${sti}.${b}` : b;
      if (p === 'opstilling.anker' || p === 'laster' || p === 'meta') continue;
      const g = d[b];
      if (h == null || !(b in h)) continue;
      const y = h[b];
      if (erObj(g)) { if (erObj(y)) flet(g, y, f[b], p); else afvist.push({ felt: p, vaerdi: y }); continue; }
      if (TILLADT[p]) { if (TILLADT[p]!.includes(y)) f[b] = y; else afvist.push({ felt: p, vaerdi: y }); }
      else if (typeof g === 'number' || g === null) {
        if (y === null && g === null) f[b] = null;
        else if (y === null && typeof g === 'number' && NULLBARE.has(p)) f[b] = null;
        else { const v = talFraFelt(y); if (Number.isFinite(v)) f[b] = v; else afvist.push({ felt: p, vaerdi: y }); }
      } else if (typeof g === 'boolean') { const v = boolFraFelt(y); if (v !== undefined) f[b] = v; else afvist.push({ felt: p, vaerdi: y }); }
      else if (typeof g === 'string') { if (y == null) continue; f[b] = String(y); }
    }
  };
  flet(s, n, r, '');
  if (typeof r.anker.d === 'number' && !STANDARD_DIAMETRE.includes(r.anker.d)) noter.push(diag('info', 'ikke-standarddiameter', '', 'anker.d', { d: r.anker.d }));
  const a = Array.isArray(n.opstilling.anker) ? n.opstilling.anker : [];
  const ankre: Obj[] = [];
  a.forEach((d: any, h: number) => {
    const x = talFraFelt(d?.x), y = talFraFelt(d?.y);
    if (Number.isFinite(x) && Number.isFinite(y)) ankre.push({ id: ankre.length + 1, x, y, slids: d?.slids === 'x' || d?.slids === 'y' ? d.slids : null });
    else afvist.push({ felt: `opstilling.anker[${h}]`, vaerdi: d });
  });
  if (!ankre.length) return fatal('ingen-bolte');
  r.opstilling.anker = ankre;
  if (!['1', '2x', '2y', '4', '6', '8', '9', 'cirk', 'fri'].includes(r.opstilling.type)) r.opstilling.type = 'fri';
  const laster: Obj[] = [];
  n.laster.forEach((d: any, h: number) => {
    if (!d || typeof d !== 'object') { afvist.push({ felt: `laster[${h}]`, vaerdi: d }); return; }
    const f: Obj = { navn: String(d.navn ?? `LK${h + 1}`), N: 0, Vx: 0, Vy: 0, Mx: 0, My: 0, T: 0, alphaSus: null };
    for (const m of ['N', 'Vx', 'Vy', 'Mx', 'My', 'T']) {
      if (d[m] == null) continue;
      const b = talFraFelt(d[m]);
      if (Number.isFinite(b)) f[m] = b; else afvist.push({ felt: `laster[${h}].${m}`, vaerdi: d[m] });
    }
    if (d.alphaSus != null) {
      const m = talFraFelt(d.alphaSus);
      if (Number.isFinite(m) && m >= 0 && m <= 1) f.alphaSus = m; else afvist.push({ felt: `laster[${h}].alphaSus`, vaerdi: d.alphaSus });
    }
    laster.push(f);
  });
  if (!laster.length) return fatal('ingen-laster');
  r.laster = laster;
  const u = n.meta?.redigeret;
  r.meta = { redigeret: u && typeof u === 'object' ? { ...u } : null };
  if (!r.meta.redigeret) r.meta.redigeret = { '*': true };
  r.projekt.eksempel = n.projekt?.eksempel === true && !!n.meta;
  r.version = PROJEKT_VERSION;
  if ((opt.fraBruger ?? true) && n.version == null) noter.push(diag('info', 'intet-versionsfelt', '', 'version'));
  return { model: r, afvist, noter, fejl: null };
}

/** Felter med talværdi som standard, hvor null er tilladt (valgfrie produktdata o.l.). */
const NULLBARE = new Set<string>([
  'indstillinger.Ec', 'beton.kanter.xNeg', 'beton.kanter.xPos', 'beton.kanter.yNeg', 'beton.kanter.yPos', 'anker.As', 'anker.hovedSide', 'anker.scrN', 'anker.scrSp',
  'anker.NRksEta', 'anker.VRksEta', 'anker.M0RksEta', 'anker.ccrN', 'anker.ccrSp', 'anker.cmin', 'anker.dnom', 'anker.hmin', 'anker.k7', 'anker.k8', 'anker.smin',
  'beton.armering.ankerarmeringForskydning.antalBoejler', 'beton.armering.ankerarmeringForskydning.antalLoekker', 'beton.armering.ankerarmeringForskydning.cd',
  'beton.armering.ankerarmeringForskydning.es', 'beton.armering.ankerarmeringForskydning.eta1', 'beton.armering.ankerarmeringForskydning.l1',
  'beton.armering.ankerarmeringTraek.cd', 'beton.armering.ankerarmeringTraek.forankringsdybde', 'beton.armering.kantarmeringAfstand',
  'beton.armering.kantarmeringDiameter', 'beton.fck', 'beton.urevnet.sigmaL',
]);
