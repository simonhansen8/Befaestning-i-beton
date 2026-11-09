// Genererer "facit"-sættet: deterministiske modeller (seedet PRNG) + nuværende programs resultater.
// Kør:  NODE_PATH=$(npm root -g) node golden/generate.mjs [antal] [udfil]
// Bruges som orakel/regressionsnet under genopbygningen (se rapporter/arkitekturvurdering.md).
import { openEngine, clone, merge } from '../tests/lib/engine.mjs';
import fs from 'node:fs';

const N = +(process.argv[2] || 300);
const OUT = process.argv[3] || new URL('./cases.json', import.meta.url).pathname;

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry32(20261109);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi, step = 1) => lo + step * Math.floor(rnd() * ((hi - lo) / step + 1));
const chance = (p) => rnd() < p;

const STEEL = { '4.6': [400, 240, true], '5.6': [500, 300, true], '5.8': [500, 400, false], '8.8': [800, 640, true], '10.9': [1000, 900, true], 'A4-70': [700, 450, true] };
const AS = { 12: 84.3, 16: 157, 20: 245, 24: 353, 30: 561 };
const CLS = ['C20/25', 'C25/30', 'C30/37', 'C35/45', 'C40/50', 'C50/60'];

function layout() {
  const kind = pick(['1', '2x', '2y', '4', '6', '9', 'cirk']);
  const sx = int(100, 300, 20), sy = int(100, 300, 20);
  let pts = [];
  const grid = (nx, ny) => { for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) pts.push([(i - (nx - 1) / 2) * sx, (j - (ny - 1) / 2) * sy]); };
  if (kind === '1') pts = [[0, 0]];
  else if (kind === '2x') grid(2, 1); else if (kind === '2y') grid(1, 2);
  else if (kind === '4') grid(2, 2); else if (kind === '6') grid(3, 2); else if (kind === '9') grid(3, 3);
  else { const n = int(4, 8), r = int(100, 220, 20), v = pick([0, 15, 30]); for (let k = 0; k < n; k++) { const a = (v + 360 * k / n) * Math.PI / 180; pts.push([Math.round(r * Math.cos(a) * 10) / 10, Math.round(r * Math.sin(a) * 10) / 10]); } }
  return { kind, sx, sy, pts };
}

function makeCase(i, base) {
  const L = layout();
  const d = pick([12, 16, 20, 24]);
  const indl = chance(0.3);
  const hef = indl ? int(80, 300, 10) : int(Math.max(80, 4 * d), 260, 10);
  const stk = pick(Object.keys(STEEL));
  const [fuk, fyk, duktil] = STEEL[stk];
  const maxx = Math.max(...L.pts.map(p => Math.abs(p[0])), 0), maxy = Math.max(...L.pts.map(p => Math.abs(p[1])), 0);
  const kanter = { xNeg: null, xPos: null, yNeg: null, yPos: null };
  for (const k of ['xNeg', 'xPos', 'yNeg', 'yPos']) if (chance(0.3)) kanter[k] = int(Math.round((k[0] === 'x' ? maxx : maxy) + 100 + 1.5 * hef) , 900, 10);
  const h = int(Math.max(Math.round(hef + 100), 200), 600, 20);
  const nl = int(1, 3);
  const laster = Array.from({ length: nl }, (_, k) => ({
    navn: 'LK' + (k + 1), N: int(-60, 120, 10) * 1000, Vx: int(-40, 40, 5) * 1000, Vy: int(-40, 40, 5) * 1000,
    Mx: int(-6, 6) * 1e6, My: int(-6, 6) * 1e6, T: chance(0.3) ? int(0, 3) * 1e6 : 0, alphaSus: chance(0.5) ? 0 : null,
  }));
  const ind = {};
  if (chance(0.25)) ind.kontrolklasse = pick(['lempet', 'skaerpet']);
  if (chance(0.15)) { ind.konsekvensklasse = pick(['CC1', 'CC3']); ind.kfiPaaLaster = chance(0.6); }
  if (chance(0.2)) ind.interaktion = pick(['potens', 'lineaer']);
  if (chance(0.15)) ind.pryoutEnkeltanker = 'altid';
  if (chance(0.15)) ind.staalInteraktionVedLoeftestang = 'eftervis';
  if (chance(0.1)) ind.gammaC = pick([1.5, 1.8]);
  const patch = {
    projekt: { navn: 'golden ' + i, eksempel: false },
    beton: { klasse: pick(CLS), fck: null, revnet: chance(0.75), h, kanter },
    anker: { type: indl ? 'indlimet' : 'indstoebt', d, As: AS[d], gevind: true, hef, staalklasse: stk, fuk, fyk, duktil,
             dh: indl ? 0 : Math.round(d * 1.8), th: indl ? 0 : Math.round(d * 0.8) },
    plade: { bx: Math.max(100, Math.ceil((2 * maxx + 3 * d + 40) / 10) * 10), by: Math.max(100, Math.ceil((2 * maxy + 3 * d + 40) / 10) * 10), t: pick([15, 20, 25]), hulfrigang: pick(['normal', 'normal', 'stor']) },
    opstilling: { type: L.kind, sx: L.sx, sy: L.sy, anker: L.pts.map((p, k) => ({ id: k + 1, x: p[0], y: p[1], slids: null })) },
    laster, indstillinger: ind,
  };
  if (indl) { patch.anker.tauRkCr = pick([5, 7.5, 9]); patch.anker.tauRkUcr = pick([10, 13]); patch.anker.d0 = d + 4; patch.anker.dh = null; patch.anker.th = null; }
  return merge(base, patch);
}

const compact = (o) => {
  const r = o.result;
  return {
    tilstand: o.tilstand,
    fejl: (o.fejl || []).map(f => f.fid || f.tekst?.slice(0, 60)),
    ok: r?.ok, maksUdnyttelse: r?.maksUdnyttelse, styrendeBrudform: r?.styrendeBrudform, styrendeKombination: r?.styrendeKombination,
    partialkoefficienter: r?.partialkoefficienter,
    eftervisninger: r?.eftervisninger?.map(e => ({ id: e.id, relevant: e.relevant, NEd: e.NEd, NRd: e.NRd, NRk: e.NRk, VEd: e.VEd, VRd: e.VRd, VRk: e.VRk, udnyttelse: e.udnyttelse, styrendeAnker: e.styrendeAnker })),
    advarsler: r?.advarsler?.length,
    kombinationer: r?.kombinationer?.map(k => ({ navn: k.navn, ankerkraefter: k.ankerkraefter, trykzone: k.trykzone && { C: k.trykzone.C, xC: k.trykzone.xC, yC: k.trykzone.yC, Cmax: k.trykzone.Cmax, hjoerner: k.trykzone.polygon?.length }, fordeling: k.fordeling })),
  };
};

const e = await openEngine();
const cases = [];
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const model = makeCase(i, e.baseModel);
  const out = await e.load(model);
  cases.push({ id: i, model, resultat: compact(out) });
}
await e.close();
const ok = cases.filter(c => c.resultat.tilstand === 'ok').length;
fs.writeFileSync(OUT, JSON.stringify({ app: 'index.html (gammel kerne)', antal: cases.length, beregnede: ok, cases }, null, 0));
console.log(`${cases.length} modeller, ${ok} beregnet, ${cases.length - ok} afvist af validering, ${(Date.now() - t0) / 1000}s`);
