// Indlæsning af projektfiler (JSON): tolerant parser med standardværdier og kodede diagnoser (ingen tekst).
// Port af den gamle normalisering; resultatet er en typet Projektmodel som kernen kan regne på.
import type { Projektmodel } from './beregn';
import { STAALKLASSER, GEVINDAREAL, GAMMA3_AF_KONTROLKLASSE, DK_NA } from './constants';
import { fckAfKlasse } from './concrete';
import { diag, EN, type Diagnostik } from './diagnostik';
import type { IndstillingerInput } from './settings';

type Obj = Record<string, unknown>;
const erObj = (n: unknown): n is Obj => n != null && typeof n === 'object' && !Array.isArray(n);

/** Tal fra tal eller streng (dansk komma og minus tillades). undefined = ikke angivet, NaN = ugyldigt. */
export function tal(n: unknown): number | undefined {
  if (n == null || n === '') return undefined;
  if (typeof n === 'number') return n;
  if (typeof n === 'string') {
    const e = n.trim().replace(/\s/g, '').replace('−', '-').replace(',', '.');
    return e === '' ? undefined : Number(e);
  }
  return NaN;
}
export function boolsk(n: unknown, standard: boolean): boolean {
  if (n === true || n === 'true' || n === 1 || n === '1') return true;
  if (n === false || n === 'false' || n === 0 || n === '0') return false;
  return standard;
}
const vaelg = <T extends string>(n: unknown, tilladt: readonly T[], standard: T): T => ((tilladt as readonly unknown[]).includes(n) ? (n as T) : standard);
const vaelgEllerNull = <T extends string>(n: unknown, tilladt: readonly T[]): T | null => ((tilladt as readonly unknown[]).includes(n) ? (n as T) : null);

export interface IndlaesResultat {
  model: Projektmodel & { version: 1; projekt: Obj };
  diagnostik: Diagnostik[];
  /** Mindst én fejl der gør at modellen ikke kan beregnes meningsfuldt. */
  kritisk: boolean;
}

/** Øvre grænse for antal ben/bøjler/løkker pr. anker (urealistiske værdier afvises i stedet for at give uendelige beregninger). */
const ANTAL_MAX = 100;

interface TalValg { gt?: number; min?: number; max?: number; nullable?: boolean; krit?: boolean }

export function indlaesProjekt(raa: unknown): IndlaesResultat {
  const d: Diagnostik[] = [];
  let kritisk = false;
  const fejl = (kode: string, felt: string | null, paragraf = '', krit = true, data: Diagnostik['data'] = {}) => {
    d.push(diag('fejl', kode, paragraf, felt, data));
    if (krit) kritisk = true;
  };
  const info = (niveau: 'advarsel' | 'info', kode: string, paragraf: string, felt: string | null, data: Diagnostik['data'] = {}) => d.push(diag(niveau, kode, paragraf, felt, data));

  /** Læser et tal med grænser; ved ugyldigt/uden for grænse bruges standardværdien (eller null) og der meldes fejl. */
  function r(felt: string, v: unknown, standard: number, o?: TalValg & { nullable?: false }): number;
  function r(felt: string, v: unknown, standard: number | null, o: TalValg & { nullable: true }): number | null;
  function r(felt: string, v: unknown, standard: number | null, o: TalValg = {}): number | null {
    const x = tal(v);
    const fb = o.nullable ? null : standard;
    if (x === undefined) return o.nullable ? null : standard;
    const krit = o.krit ?? true;
    if (!Number.isFinite(x)) { fejl('ugyldig-vaerdi', felt, '', krit); return fb; }
    if (o.gt != null && !(x > o.gt)) { fejl('vaerdi-for-lav', felt, '', krit, { grænse: o.gt, angivet: x, streng: true }); return fb; }
    if (o.min != null && x < o.min) { fejl('vaerdi-for-lav', felt, '', krit, { grænse: o.min, angivet: x, streng: false }); return fb; }
    if (o.max != null && x > o.max) { fejl('vaerdi-for-hoej', felt, '', krit, { grænse: o.max, angivet: x }); return fb; }
    return x;
  }

  if (!erObj(raa)) fejl('model-mangler', null);
  const o: Obj = erObj(raa) ? raa : {};
  const a = erObj(o.beton) ? o.beton : {}, l = erObj(o.anker) ? o.anker : {}, c = erObj(o.plade) ? o.plade : {};
  const u = erObj(o.opstilling) ? o.opstilling : {}, di = erObj(o.indstillinger) ? o.indstillinger : {};
  const h = erObj(a.armering) ? a.armering : {}, f = erObj(a.kanter) ? a.kanter : {};
  const rå = Array.isArray(u.anker) ? u.anker : [];

  // ---- ankre i opstillingen
  const ankre = rå.map((s, i) => {
    const k = erObj(s) ? s : {};
    const idTal = tal(k.id);
    const id = idTal !== undefined && Number.isFinite(idTal) ? idTal : i + 1;
    return { id, x: r(`opstilling.anker.${id}.x`, k.x, 0), y: r(`opstilling.anker.${id}.y`, k.y, 0), slids: vaelgEllerNull(k.slids, ['x', 'y'] as const) };
  });
  if (!ankre.length) fejl('ingen-bolte', 'opstilling.anker', EN('6.2'));
  if (new Set(ankre.map((q) => q.id)).size !== ankre.length) fejl('bolt-id-ikke-entydige', 'opstilling.anker', '', false);

  // ---- anker
  const type = vaelg(l.type, ['indstoebt', 'indlimet'] as const, 'indstoebt');
  if (l.type != null && l.type !== type) info('advarsel', 'ukendt-ankertype', '', 'anker.type', { angivet: String(l.type) });
  const y = type === 'indlimet';
  const dd = r('anker.d', l.d, 16, { gt: 0 });
  const gevind = boolsk(l.gevind, true);
  let As = r('anker.As', l.As, null, { gt: 0, nullable: true });
  if (As == null) {
    As = gevind ? (GEVINDAREAL[dd] ?? (Math.PI / 4) * (0.885 * dd) ** 2) : (Math.PI / 4) * dd * dd;
    if (gevind && GEVINDAREAL[dd] == null) info('advarsel', 'as-estimeret', 'ISO 898-1', 'anker.As', { d: dd, As });
  }
  const klasse = String(l.staalklasse ?? '8.8');
  const sk = (STAALKLASSER as Record<string, { fuk: number; fyk: number; duktil: boolean }>)[klasse] ?? null;
  const fuk = r('anker.fuk', l.fuk, sk?.fuk ?? 800, { gt: 0 });
  const fyk = r('anker.fyk', l.fyk, sk?.fyk ?? 640, { gt: 0 });
  if (fyk >= fuk) fejl('fyk-over-fuk', 'anker.fyk', EN('Tabel 4.1'), false, { fyk, fuk });
  const nul = { gt: 0, nullable: true as const };
  const kr = { gt: 0, nullable: true as const, krit: false };
  const A = {
    type, d: dd, dnom: r('anker.dnom', l.dnom, null, nul) ?? dd, gevind, As,
    hef: r('anker.hef', l.hef, 100, { gt: 0 }),
    staalklasse: klasse, fuk, fyk, duktil: boolsk(l.duktil, sk?.duktil ?? true),
    dh: r('anker.dh', l.dh, 2 * dd, { gt: 0, krit: !y }),
    th: r('anker.th', l.th, 0.6 * dd, { min: 0, krit: false }),
    hovedForm: vaelg(l.hovedForm, ['rund', 'firkant'] as const, 'rund'),
    hovedSide: r('anker.hovedSide', l.hovedSide, null, kr),
    d0: r('anker.d0', l.d0, dd <= 16 ? dd + 2 : dd + 4, { gt: 0, krit: false }),
    hefMin: r('anker.hefMin', l.hefMin, null, kr), hefMax: r('anker.hefMax', l.hefMax, null, kr),
    tauRkCr: r('anker.tauRkCr', l.tauRkCr, null, { ...nul, krit: y }),
    tauRkUcr: r('anker.tauRkUcr', l.tauRkUcr, null, { ...nul, krit: y }),
    psiC: r('anker.psiC', l.psiC, 1, { gt: 0, krit: y }),
    psi0Sus: r('anker.psi0Sus', l.psi0Sus ?? l.psiSus, 0.6, { gt: 0, max: 1, krit: y }),
    alphaSus: r('anker.alphaSus', l.alphaSus, 0.6, { min: 0, max: 1, krit: y }),
    kcrN: r('anker.kcrN', l.kcrN ?? l.k1, 7.7, { gt: 0, krit: y }),
    kucrN: r('anker.kucrN', l.kucrN, 11, { gt: 0, krit: y }),
    ccrN: r('anker.ccrN', l.ccrN, null, nul), scrN: r('anker.scrN', l.scrN, null, nul),
    ccrSp: r('anker.ccrSp', l.ccrSp, null, nul), scrSp: r('anker.scrSp', l.scrSp, null, nul),
    hmin: r('anker.hmin', l.hmin, null, nul),
    cmin: r('anker.cmin', l.cmin, null, { min: 0, nullable: true, krit: false }),
    smin: r('anker.smin', l.smin, null, { min: 0, nullable: true, krit: false }),
    k7: r('anker.k7', l.k7, null, nul), k8: r('anker.k8', l.k8, null, nul),
    k11: r('anker.k11', l.k11, 2 / 3, { gt: 0, max: 1 }),
    gammaInst: r('anker.gammaInst', l.gammaInst, y ? 1.2 : 1, { gt: 0 }),
    NRksEta: r('anker.NRksEta', l.NRksEta, null, nul), VRksEta: r('anker.VRksEta', l.VRksEta, null, nul), M0RksEta: r('anker.M0RksEta', l.M0RksEta, null, nul),
    betonMin: typeof l.betonMin === 'string' ? l.betonMin : 'C20/25',
    betonMax: typeof l.betonMax === 'string' ? l.betonMax : 'C50/60',
  };
  if (!y && A.dh <= A.d) fejl('hoveddiameter-for-lille', 'anker.dh', EN('7.2.1.5'), true, { dh: A.dh, d: A.d });
  if (y && A.gammaInst < 1) info('advarsel', 'gamma-inst-under-1', 'DK NA, Tabel 4.1', 'anker.gammaInst', { gammaInst: A.gammaInst });

  // ---- beton
  const fckAngivet = r('beton.fck', a.fck, null, nul);
  const betonKlasse = typeof a.klasse === 'string' ? a.klasse : 'C30/37';
  const fck = fckAngivet ?? fckAfKlasse(betonKlasse);
  if (!Number.isFinite(fck)) fejl('ukendt-betonklasse', 'beton.klasse', 'EN 1992-1-1, Tabel 3.1', true, { klasse: betonKlasse });
  const kanter: Record<string, number | null> = {};
  for (const k of ['xNeg', 'xPos', 'yNeg', 'yPos']) kanter[k] = r(`beton.kanter.${k}`, f[k], null, { nullable: true });

  const nAnker = Math.max(1, ankre.length);
  const W = erObj(h.ankerarmeringTraek) ? h.ankerarmeringTraek : {}, G = erObj(h.ankerarmeringForskydning) ? h.ankerarmeringForskydning : {};
  const Wb = erObj(W.bekraeft) ? W.bekraeft : {};
  const Z = boolsk(W.aktiv, false), O = boolsk(G.aktiv, false);
  let afskalning = vaelgEllerNull(h.afskalning, ['taet', 'aaben'] as const);
  if (!afskalning) afskalning = h.taetArmering === true ? 'taet' : h.taetArmering === false ? 'aaben' : 'taet';
  let kantarm: unknown = h.kantarmering ?? 'ingen';
  if (kantarm === 'lige') { info('info', 'kantstang-lige', EN('7.2.2.5'), 'beton.armering.kantarmering'); kantarm = 'ingen'; }
  const kantarmering = vaelg(kantarm, ['ingen', 'boejler'] as const, 'ingen');
  const kA = r('beton.armering.kantarmeringAfstand', h.kantarmeringAfstand, null, { min: 0, nullable: true, krit: false });
  const kD = r('beton.armering.kantarmeringDiameter', h.kantarmeringDiameter, null, { min: 0, nullable: true, krit: false });
  const benPr = r('beton.armering.ankerarmeringTraek.benPrAnker', W.benPrAnker, null, { min: 0, max: ANTAL_MAX, nullable: true, krit: false });
  const antalBen = r('beton.armering.ankerarmeringTraek.antalBen', W.antalBen, null, { min: 0, max: ANTAL_MAX * 10, nullable: true, krit: false });
  const Q = W.antalBoejler == null || W.antalBoejler === '' ? null : r('beton.armering.ankerarmeringTraek.antalBoejler', W.antalBoejler, 1, { min: 1, max: ANTAL_MAX, krit: false });
  const fe = Q == null ? null : Math.max(1, Math.round(Q));
  const Ae = Math.max(1, Math.round(benPr ?? (antalBen != null ? Math.floor(antalBen / nAnker) : 2)));
  const eeV = r('beton.armering.ankerarmeringForskydning.benPrAnker', G.benPrAnker, null, { min: 0, max: ANTAL_MAX, nullable: true, krit: false });
  const weV = r('beton.armering.ankerarmeringForskydning.antalBen', G.antalBen, null, { min: 0, max: ANTAL_MAX * 10, nullable: true, krit: false });
  const fv = 'beton.armering.ankerarmeringForskydning';
  const antalBoejlerT = fe ?? Math.max(1, Math.ceil(Ae / 2));
  const forskType = vaelg(G.type === 'boejler' ? 'boejle' : G.type, ['boejle', 'overflade', 'loekke'] as const, 'boejle');
  const forsk = {
    aktiv: O, type: forskType, kant: vaelgEllerNull(G.kant, ['xNeg', 'xPos', 'yNeg', 'yPos'] as const),
    diameter: r(`${fv}.diameter`, G.diameter, 10, { gt: 0, krit: O }),
    benPrAnker: eeV as number | null,
    antalBenIAlt: eeV == null ? (weV ?? null) : null,
    antalLoekker: G.antalLoekker == null || G.antalLoekker === '' ? null : Math.max(1, Math.round(r(`${fv}.antalLoekker`, G.antalLoekker, 1, { min: 1, max: ANTAL_MAX, krit: false }))),
    antalBoejler: G.antalBoejler == null || G.antalBoejler === '' ? null : Math.max(1, Math.round(r(`${fv}.antalBoejler`, G.antalBoejler, 1, { min: 1, max: ANTAL_MAX, krit: false }))),
    fyk: r(`${fv}.fyk`, G.fyk, 500, { gt: 0, krit: O }),
    afstand: r(`${fv}.afstand`, G.afstand ?? G.afstandTilAnker, 50, { min: 0, krit: O }),
    daekToAkse: r(`${fv}.daekToAkse`, G.daekToAkse, 40, { min: 0, krit: O }),
    es: r(`${fv}.es`, G.es, null, { min: 0, nullable: true, krit: O }),
    l1: r(`${fv}.l1`, G.l1, null, { min: 0, nullable: true, krit: O }),
    krog: boolsk(G.krog ?? G.boejet, true),
    eta1: r(`${fv}.eta1`, G.eta1, null, { gt: 0, max: 1, nullable: true, krit: O }),
    cd: r(`${fv}.cd`, G.cd, null, { min: 0, nullable: true, krit: false }),
    afstandBoejler: r(`${fv}.afstandBoejler`, G.afstandBoejler, null, { gt: 0, nullable: true, krit: false }),
  };
  if (forsk.benPrAnker == null && forsk.antalBenIAlt == null) forsk.benPrAnker = 2;
  const tv = 'beton.armering.ankerarmeringTraek';
  const armering = {
    afskalning, kantarmering, kantarmeringAfstand: kA, kantarmeringDiameter: kD, splitArmering: boolsk(h.splitArmering, false),
    ankerarmeringTraek: {
      aktiv: Z, diameter: r(`${tv}.diameter`, W.diameter, 12, { gt: 0, krit: Z }),
      benPrAnker: 2 * antalBoejlerT, antalBoejler: antalBoejlerT,
      fraBenUlige: fe == null && Ae % 2 === 1 ? Ae : null,
      fraAntalBen: fe == null && benPr == null && antalBen != null ? antalBen : null,
      fyk: r(`${tv}.fyk`, W.fyk, 500, { gt: 0, krit: Z }),
      afstand: r(`${tv}.afstand`, W.afstand ?? W.afstandTilAnker, 50, { min: 0, krit: Z }),
      daeklagTop: r(`${tv}.daeklagTop`, W.daeklagTop, 40, { min: 0, krit: Z }),
      krog: boolsk(W.krog ?? W.boejet, true),
      eta1: r(`${tv}.eta1`, W.eta1, 1, { gt: 0, max: 1, krit: Z }),
      cd: r(`${tv}.cd`, W.cd, null, { min: 0, nullable: true, krit: false }),
      foering: vaelg(W.foering, ['stoed', 'ingen'] as const, 'ingen'),
      forankringsdybde: r(`${tv}.forankringsdybde`, W.forankringsdybde, null, { gt: 0, nullable: true, krit: Z }),
      drejet: boolsk(W.drejet, false),
      bekraeft: { a: boolsk(Wb.a, false), e: boolsk(Wb.e, false), f: boolsk(Wb.f, false) },
    },
    ankerarmeringForskydning: forsk,
  };
  const ur = erObj(a.urevnet) ? a.urevnet : {};
  const beton = {
    klasse: betonKlasse, fck, revnet: boolsk(a.revnet, true),
    urevnet: { sigmaL: r('beton.urevnet.sigmaL', ur.sigmaL, null, { nullable: true, krit: false }), sigmaR: r('beton.urevnet.sigmaR', ur.sigmaR, 3, { krit: false }) },
    h: r('beton.h', a.h, 300, { gt: 0 }), cnom: r('beton.cnom', a.cnom, 30, { min: 0, krit: false }), kanter, armering,
  };
  for (const k of ['xNeg', 'xPos', 'yNeg', 'yPos']) if (kanter[k] != null && kanter[k]! < 0) fejl('kantafstand-negativ', `beton.kanter.${k}`, '', false, { værdi: kanter[k]! });

  // ---- plade
  let hul: unknown = c.hulfrigang ?? 'normal';
  if (hul === 'slids') { info('advarsel', 'plade-slids-som-stor-hulfrigang', EN('6.2.2'), 'plade.hulfrigang'); hul = 'stor'; }
  const plade = {
    bx: r('plade.bx', c.bx, 300, { gt: 0 }), by: r('plade.by', c.by, 300, { gt: 0 }), t: r('plade.t', c.t, 20, { gt: 0 }),
    hulfrigang: vaelg(hul, ['normal', 'stor'] as const, 'normal'),
    afstandTilBeton: r('plade.afstandTilBeton', c.afstandTilBeton, 0, { min: 0 }),
    mellemlaeg: vaelg(c.mellemlaeg, ['ingen', 'moertel', 'aaben'] as const, 'ingen'),
    indspaending: vaelg(c.indspaending, ['fri', 'fuld'] as const, 'fri'),
  };

  // ---- indstillinger (kun angivne gyldige værdier; resten udledes af settings.ts)
  const ind: IndstillingerInput & { sigmaAdm?: number } = {};
  const kk = vaelg(di.kontrolklasse, ['lempet', 'normal', 'skaerpet'] as const, 'normal');
  ind.kontrolklasse = kk;
  // Dimensioneringstilfælde gemmes kun, når det afviger fra standarden (vedvarende/midlertidig).
  if (vaelg(di.situation, ['varig', 'ulykke'] as const, 'varig') === 'ulykke') ind.situation = 'ulykke';
  const g3 = r('indstillinger.gamma3', di.gamma3, null as unknown as number, { gt: 0, nullable: true });
  // γ3 er kun en overstyring hvis den afviger fra kontrolklassens værdi (gamle filer gemmer altid begge).
  if (g3 != null && g3 !== GAMMA3_AF_KONTROLKLASSE[kk === 'lempet' ? 'lempet' : 'normal']) ind.gamma3 = g3;
  const numNøgler = ['gammaC', 'gammaInstIndstoebt', 'gammaMsRe', 'gammaCt', 'alphaCt', 'gammaMsTraekFaktor', 'gammaMsTraekMin', 'gammaMsForskFaktor', 'gammaMsForskMin', 'gammaMsForskHoej', 'Es', 'Ec'] as const;
  for (const k of numNøgler) {
    const v = r(`indstillinger.${k}`, di[k], null as unknown as number, { gt: 0, nullable: true });
    // I ulykkestilfælde er en værdi lig vedvarende-standarden en gammel standardværdi (ikke et valg) og droppes.
    if (v != null && !(ind.situation === 'ulykke' && k !== 'Ec' && v === (DK_NA as Record<string, number>)[k])) (ind as Record<string, unknown>)[k] = v;
  }
  ind.konsekvensklasse = vaelg(di.konsekvensklasse, ['CC1', 'CC2', 'CC3'] as const, 'CC2');
  ind.sigmaAdm = r('indstillinger.sigmaAdm', di.sigmaAdm, 0, { krit: false });
  ind.interaktion = vaelg(di.interaktion, ['gunstigst', 'potens', 'lineaer'] as const, 'gunstigst');
  ind.staalInteraktionVedLoeftestang = vaelg(di.staalInteraktionVedLoeftestang, ['eftervis', 'undtag'] as const, 'undtag');
  ind.pryoutEnkeltanker = vaelg(di.pryoutEnkeltanker, ['retning', 'altid'] as const, 'retning');
  ind.forresteRaekkeTol = r('indstillinger.forresteRaekkeTol', di.forresteRaekkeTol, 0.1, { min: 0, max: 1, krit: false });
  if (di.kfiPaaLaster != null && boolsk(di.kfiPaaLaster, false)) info('advarsel', 'kfi-paa-laster-ignoreres', '', 'indstillinger.kfiPaaLaster');
  if (y && l.psi0Sus == null && l.psiSus == null) info('info', 'psi0-sus-standard', EN('7.2.1.6'), 'anker.psi0Sus');

  // ---- laster
  const laster = (Array.isArray(o.laster) ? o.laster : []).map((s, i) => {
    const k = erObj(s) ? s : {};
    const navn = k.navn != null && String(k.navn).trim() !== '' ? String(k.navn) : `LK${i + 1}`;
    const ugyldig: string[] = [];
    const t = (n: string) => { const v = tal(k[n]); return v === undefined ? 0 : Number.isFinite(v) ? v : (ugyldig.push(n), 0); };
    const as = tal(k.alphaSus);
    const alphaSus = as === undefined ? null : Number.isFinite(as) && as >= 0 && as <= 1 ? as : (ugyldig.push('alphaSus'), null);
    const out = { navn, N: t('N'), Vx: t('Vx'), Vy: t('Vy'), Mx: t('Mx'), My: t('My'), T: t('T'), alphaSus };
    if (ugyldig.length) info('advarsel', 'last-ugyldigt-felt', '', `laster.${navn}`, { felter: ugyldig.join(', ') });
    return out;
  });
  if (!laster.length) {
    laster.push({ navn: 'LK1', N: 0, Vx: 0, Vy: 0, Mx: 0, My: 0, T: 0, alphaSus: null });
    info('info', 'ingen-lastkombinationer', '', 'laster');
  }

  const model = {
    version: 1 as const, projekt: erObj(o.projekt) ? o.projekt : {},
    beton, anker: A, plade, opstilling: { ...u, anker: ankre }, laster, indstillinger: ind,
  } as unknown as IndlaesResultat['model'];
  return { model, diagnostik: d, kritisk };
}
