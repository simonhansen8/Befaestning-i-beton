// Justeringsforslag: find parametre, der kan ændres for at opnå η ≤ 1. Bruger kun beregningskernen og ændrer den ikke.
// Ren logik uden tekst: forslagene beskrives med strukturerede data; teksten sættes i ui/forslag-tekster.ts.
import { beregnProjekt, type ProjektResultat } from './beregn';
import { indlaesProjekt } from './inddata';
import { GEVINDAREAL, STAALKLASSER } from './constants';
import { hulfrigangsDiameter } from './validering';
import { genererAnkre, MOENSTRE } from './opstilling';
import { saetSti } from './sti';

type Model = Record<string, any>;
export type Aendring = [sti: string, vaerdi: unknown];

export const BETONKLASSER = ['C12/15', 'C16/20', 'C20/25', 'C25/30', 'C30/37', 'C35/45', 'C40/50', 'C45/55', 'C50/60', 'C55/67', 'C60/75', 'C70/85', 'C80/95', 'C90/105'];
const KANTER = ['xNeg', 'xPos', 'yNeg', 'yPos'] as const;

/** Strukturerede valgmuligheder (teksten laves i UI-laget). */
export type ValgBeskrivelse =
  | { type: 'klasse'; klasse: string }
  | { type: 'd'; d: number }
  | { type: 'staal'; klasse: string }
  | { type: 'antalBolte'; antal: number; moenster: string | null }
  | { type: 'armT'; antalBoejler: number; diameter: number; foering?: 'stoed' | 'ingen' | null }
  | { type: 'armV'; form: 'overflade' | 'boejle' | 'loekke'; antal: number; diameter: number }
  | { type: 'armBegge'; t: Extract<ValgBeskrivelse, { type: 'armT' }>; v: Extract<ValgBeskrivelse, { type: 'armV' }> }
  | { type: 'fjernArm'; hvilke: 'traek' | 'forskydning' | 'begge' }
  | { type: 'premis'; id: 'afskalning' | 'kantarmering' | 'splitArmering' | 'krogT' | 'krogV'; data?: Record<string, number> };

export interface Valg { beskrivelse: ValgBeskrivelse; ops: Aendring[]; cost?: number }

export type ForslagSpec =
  | { art: 'tal'; noegle: string; v0: number; vmax: number; step: number; mk: (v: number) => Aendring[] }
  | { art: 'valg'; noegle: string; fra: string | null; liste: Valg[]; lazy?: boolean; premis?: boolean };

export interface Eval { u: number; ok: boolean; r: ProjektResultat }

export function evaluer(m: Model): Eval | null {
  try {
    const n = indlaesProjekt(structuredClone(m) as never);
    if (n.kritisk) return null;
    const r = beregnProjekt(n.model);
    if (r.tilstand === 'fejl' || r.maksUdnyttelse == null || !Number.isFinite(r.maksUdnyttelse)) return null;
    if (r.kombinationer.some((k) => k.diagnostik.some((d) => d.niveau === 'fejl'))) return null;
    return { u: r.maksUdnyttelse, ok: r.ok, r };
  } catch { return null; }
}

export function styrende(r: ProjektResultat): { id: string; u: number; kombination: string } | null {
  const k = r.kombinationer[r.styrendeKombination ?? 0];
  const b = k?.resultat.brudformer.find((x) => x.id === k.resultat.styrendeBrudform);
  return k && b && b.udnyttelse != null ? { id: b.id, u: b.udnyttelse, kombination: k.navn } : null;
}

const med = (b: Model, ops: Aendring[]): Model => { const m = structuredClone(b); for (const [p, v] of ops) saetSti(m, p, v); return m; };

function pladeOps(b: Model, anker: { x: number; y: number }[]): Aendring[] {
  const d = b.anker.d, hul = hulfrigangsDiameter(d), t = Math.ceil(hul / 2 + 1.2 * hul), r10 = (o: number) => Math.ceil(o / 10) * 10;
  const x = Math.max(...anker.map((o) => Math.abs(o.x))), y = Math.max(...anker.map((o) => Math.abs(o.y)));
  const ops: Aendring[] = [], bx = r10(2 * (x + t)), by = r10(2 * (y + t));
  if (bx > b.plade.bx) ops.push(['plade.bx', bx]);
  if (by > b.plade.by) ops.push(['plade.by', by]);
  return ops;
}
function layoutOps(b: Model, patch: Record<string, unknown>): Aendring[] {
  const o = { ...b.opstilling, ...patch };
  const anker = genererAnkre(o).map((u) => ({ ...u, slids: null }));
  return [...Object.entries(patch).map(([k, v]): Aendring => ['opstilling.' + k, v]), ['opstilling.anker', anker], ...pladeOps(b, anker)];
}

const PT = 'beton.armering.ankerarmeringTraek.', PV = 'beton.armering.ankerarmeringForskydning.';
function armT(T: Model, ds: number[], ns: number[], foer: boolean): Valg[] {
  const l: Valg[] = [];
  for (const d of ds) for (const n of ns) for (const f of foer ? [T.foering, T.foering === 'stoed' ? 'ingen' : 'stoed'] : [T.foering]) {
    const ops: Aendring[] = [[PT + 'aktiv', true], [PT + 'diameter', d], [PT + 'antalBoejler', n]];
    if (f !== T.foering) ops.push([PT + 'foering', f]);
    l.push({ beskrivelse: { type: 'armT', antalBoejler: n, diameter: d, foering: f !== T.foering ? f : null }, ops, cost: 2 * n * d * d + (f !== T.foering ? 1 : 0) });
  }
  return l.sort((p, q) => p.cost! - q.cost!);
}
const FELT_V = { overflade: 'benPrAnker', boejle: 'antalBoejler', loekke: 'antalLoekker' } as const;
function armV(V: Model, ds: number[], cn: Record<'overflade' | 'boejle' | 'loekke', number[]>): Valg[] {
  const l: Valg[] = [];
  for (const t of ['overflade', 'boejle', 'loekke'] as const) for (const d of ds) for (const n of cn[t]) {
    const ben = t === 'overflade' ? n : 2 * n;
    l.push({ beskrivelse: { type: 'armV', form: t, antal: n, diameter: d },
      ops: [[PV + 'aktiv', true], [PV + 'type', t], [PV + 'diameter', d], [PV + FELT_V[t], n]], cost: ben * d * d + (t === V.type ? 0 : 1) });
  }
  return l.sort((p, q) => p.cost! - q.cost!);
}

export function forslagSpecs(b: Model): ForslagSpec[] {
  const a = b.anker, be = b.beton, op = b.opstilling, S: ForslagSpec[] = [];
  const tal = (noegle: string, v0: number, vmax: number, step: number, mk: (v: number) => Aendring[]) => { if (Number.isFinite(v0) && vmax > v0) S.push({ art: 'tal', noegle, v0, vmax, step, mk }); };
  const valg = (noegle: string, fra: string | null, liste: Valg[]) => { if (liste.length) S.push({ art: 'valg', noegle, fra, liste }); };

  tal('anker.hef', a.hef, a.hefMax > a.hef ? a.hefMax : a.hef * 2, 5, (v) => [['anker.hef', v]]);
  tal('beton.h', be.h, Math.max(be.h * 2.5, be.h + 500), 10, (v) => [['beton.h', v]]);
  if (be.fck == null) {
    const i = BETONKLASSER.indexOf(be.klasse); let mx = BETONKLASSER.indexOf(a.betonMax); if (mx < 0) mx = BETONKLASSER.indexOf('C50/60');
    if (i >= 0) valg('beton.klasse', be.klasse, BETONKLASSER.slice(i + 1, mx + 1).map((c) => ({ beskrivelse: { type: 'klasse', klasse: c }, ops: [['beton.klasse', c]] })));
  }
  valg('anker.d', 'M' + a.d, Object.keys(GEVINDAREAL).map(Number).filter((t) => t > a.d && t <= 30).map((t) => {
    const ops: Aendring[] = [['anker.d', t], ['anker.As', a.gevind !== false ? GEVINDAREAL[t] ?? Math.PI / 4 * (0.885 * t) ** 2 : Math.PI / 4 * t * t]];
    if (a.dh != null) ops.push(['anker.dh', Math.max(a.dh, Math.round(a.dh * t / a.d))]);
    if (a.th != null) ops.push(['anker.th', Math.max(a.th, Math.round(a.th * t / a.d))]);
    if (a.d0 != null) ops.push(['anker.d0', Math.max(a.d0, t + (t <= 16 ? 2 : 4))]);
    if (a.dnom != null) ops.push(['anker.dnom', Math.max(a.dnom, t)]);
    return { beskrivelse: { type: 'd', d: t } as ValgBeskrivelse, ops };
  }));
  if (a.fuk != null) {
    const K = STAALKLASSER as Record<string, { fuk: number; fyk: number; duktil: boolean }>;
    valg('anker.staalklasse', a.staalklasse, Object.keys(K).filter((k) => K[k]!.fuk > a.fuk && K[k]!.duktil).sort((p, q) => K[p]!.fuk - K[q]!.fuk || K[p]!.fyk - K[q]!.fyk)
      .map((k) => ({ beskrivelse: { type: 'staal', klasse: k } as ValgBeskrivelse, ops: [['anker.staalklasse', k], ['anker.fuk', K[k]!.fuk], ['anker.fyk', K[k]!.fyk], ['anker.duktil', K[k]!.duktil]] as Aendring[] })));
  }
  const params = MOENSTRE.find((x) => x.id === op.type)?.params ?? [];
  for (const k of ['sx', 'sy'] as const) if (params.includes(k)) tal('opstilling.' + k, op[k], Math.max(op[k] * 3, op[k] + 600), 10, (v) => layoutOps(b, { [k]: v }));
  const cnt = Object.fromEntries(MOENSTRE.filter((x) => x.antal != null && x.id !== 'fri').map((x) => [x.id, x.antal!])) as Record<string, number>;
  if (cnt[op.type]) {
    const c0 = cnt[op.type]!;
    valg('opstilling.type', c0 + ' bolte', MOENSTRE.filter((x) => cnt[x.id] != null && cnt[x.id]! > c0).sort((p, q) => cnt[p.id]! - cnt[q.id]!)
      .map((x) => ({ beskrivelse: { type: 'antalBolte', antal: cnt[x.id]!, moenster: x.id } as ValgBeskrivelse, ops: layoutOps(b, { type: x.id, sx: op.sx || 150, sy: op.sy || 150, n: op.n || 6, r: op.r || 150 }) })));
  } else if (op.type === 'cirk') {
    const n0 = Math.round(+op.n || 4), l: Valg[] = [];
    for (let n = n0 + 1; n <= Math.min(24, n0 + 8); n++) l.push({ beskrivelse: { type: 'antalBolte', antal: n, moenster: null }, ops: layoutOps(b, { n }) });
    valg('opstilling.n', n0 + ' bolte', l);
  }
  const an: { x: number; y: number }[] = op.anker ?? [], xs = an.map((u) => u.x), ys = an.map((u) => u.y);
  const c0Af = (e: (typeof KANTER)[number]) => ({ xNeg: be.kanter.xNeg + Math.min(...xs), xPos: be.kanter.xPos - Math.max(...xs), yNeg: be.kanter.yNeg + Math.min(...ys), yPos: be.kanter.yPos - Math.max(...ys) }[e]);
  if (an.length) for (const e of KANTER) {
    if (be.kanter[e] == null) continue;
    const c0 = c0Af(e);
    tal('beton.kanter.' + e, c0, Math.max(c0 * 3, c0 + 600), 5, (v) => [['beton.kanter.' + e, { xNeg: v - Math.min(...xs), xPos: v + Math.max(...xs), yNeg: v - Math.min(...ys), yPos: v + Math.max(...ys) }[e]]]);
  }
  const ar = be.armering ?? {}, T = ar.ankerarmeringTraek, V = ar.ankerarmeringForskydning, P = 'beton.armering.';
  const fraT = T ? (T.aktiv ? `${T.antalBoejler}×Ø${T.diameter}` : null) : null;
  if (T) {
    const l = armT(T, [8, 10, 12, 14, 16], [1, 2, 3, 4, 5, 6], true);
    if (T.aktiv) l.unshift({ beskrivelse: { type: 'fjernArm', hvilke: 'traek' }, ops: [[PT + 'aktiv', false]], cost: -1 });
    valg(P + 'ankerarmeringTraek', fraT, l);
  }
  if (V) {
    const cur = V.aktiv ? `${V.type}:${V.type === 'overflade' ? V.benPrAnker : V.type === 'loekke' ? V.antalLoekker : V.antalBoejler}×Ø${V.diameter}` : null;
    const l = armV(V, [8, 10, 12, 14, 16], { overflade: [2, 3, 4, 5, 6, 8, 10, 12], boejle: [1, 2, 3, 4, 5, 6], loekke: [1, 2, 3, 4, 5, 6] });
    if (V.aktiv) l.unshift({ beskrivelse: { type: 'fjernArm', hvilke: 'forskydning' }, ops: [[PV + 'aktiv', false]], cost: -1 });
    valg(P + 'ankerarmeringForskydning', cur, l);
  }
  if (T && V) {
    const lt = armT(T, [10, 12, 16], [1, 2, 3, 4, 6], false), lv = armV(V, [10, 12, 16], { overflade: [2, 4, 6, 8, 12], boejle: [1, 2, 3, 4, 6], loekke: [1, 2, 3, 4, 6] });
    const l: Valg[] = [];
    for (const x of lt) for (const y of lv) l.push({ beskrivelse: { type: 'armBegge', t: x.beskrivelse as never, v: y.beskrivelse as never }, ops: [...x.ops, ...y.ops], cost: x.cost! + y.cost! });
    if (T.aktiv || V.aktiv) l.push({ beskrivelse: { type: 'fjernArm', hvilke: 'begge' }, ops: [[PT + 'aktiv', false], [PV + 'aktiv', false]], cost: -1 });
    l.sort((p, q) => p.cost! - q.cost!);
    valg(P + 'begge', null, l);
    (S[S.length - 1] as { lazy?: boolean }).lazy = true;
  }
  const premis = (noegle: string, fra: string | null, id: Extract<ValgBeskrivelse, { type: 'premis' }>['id'], ops: Aendring[], data?: Record<string, number>) => {
    valg(noegle, fra, [{ beskrivelse: { type: 'premis', id, data }, ops }]);
    (S[S.length - 1] as { premis?: boolean }).premis = true;
  };
  if (ar.afskalning === 'taet') premis(P + 'afskalning', 'taet', 'afskalning', [[P + 'afskalning', 'aaben']]);
  if (be.revnet && (ar.kantarmering === 'ingen' || !(ar.kantarmeringAfstand > 0 && ar.kantarmeringAfstand <= 100) || !(ar.kantarmeringDiameter >= 12))) {
    const cs = an.length ? KANTER.filter((e) => be.kanter[e] != null).map(c0Af) : [], cm = cs.length ? Math.min(...cs) : 100;
    const av = Math.max(25, Math.min(100, Math.floor(2 * cm / 5) * 5)), dia = Math.max(12, ar.kantarmeringDiameter || 0);
    const a0 = ar.kantarmering === 'boejler' && ar.kantarmeringAfstand > 0 && ar.kantarmeringAfstand <= Math.min(100, 2 * cm) ? ar.kantarmeringAfstand : av;
    premis(P + 'kantarmering', ar.kantarmering === 'boejler' ? 'udokumenteret' : 'ingen', 'kantarmering', [[P + 'kantarmering', 'boejler'], [P + 'kantarmeringAfstand', a0], [P + 'kantarmeringDiameter', dia]], { a: a0, diameter: dia, c1: cm });
  }
  if (!ar.splitArmering && be.revnet) premis(P + 'splitArmering', 'nej', 'splitArmering', [[P + 'splitArmering', true]]);
  if (T?.aktiv && !T.krog) premis(PT + 'krog', 'uden', 'krogT', [[PT + 'krog', true]]);
  if (V?.aktiv && !V.krog) premis(PV + 'krog', 'uden', 'krogV', [[PV + 'krog', true]]);
  return S;
}

export interface Loesning { ops: Aendring[]; u: number; r: ProjektResultat; v?: number; valg?: Valg; rang?: number }
export interface SpecResultat { spec: ForslagSpec; hit: Loesning | null; best: Loesning | null }

export function loes(b: Model, s: ForslagSpec): SpecResultat {
  const res: SpecResultat = { spec: s, hit: null, best: null };
  const proev = (ops: Aendring[]) => evaluer(med(b, ops));
  if (s.art === 'valg') {
    for (let k = 0; k < s.liste.length; k++) {
      const o = s.liste[k]!, ev = proev(o.ops);
      if (!ev) continue;
      if (!res.best || ev.u < res.best.u) res.best = { u: ev.u, ops: o.ops, valg: o, r: ev.r };
      if (ev.ok) { res.hit = { ops: o.ops, u: ev.u, r: ev.r, valg: o, rang: k }; break; }
    }
    return res;
  }
  const k0 = Math.floor(s.v0 / s.step) + 1, k1 = Math.floor(s.vmax / s.step);
  if (k1 < k0) return res;
  const ved = (k: number): Loesning | null => {
    const v = k * s.step, ops = s.mk(v), ev = proev(ops);
    if (ev && (!res.best || ev.u < res.best.u)) res.best = { u: ev.u, v, ops, r: ev.r };
    return ev && ev.ok ? { v, ops, u: ev.u, r: ev.r } : null;
  };
  const stride = Math.max(1, Math.ceil((k1 - k0) / 30));
  let lo = k0 - 1, hi = -1, hr: Loesning | null = null;
  for (let k = k0; ; k += stride) {
    if (k > k1) k = k1;
    const h = ved(k);
    if (h) { hi = k; hr = h; break; }
    lo = k;
    if (k >= k1) break;
  }
  if (hi < 0 || !hr) return res;
  while (hi - lo > 1) { const m = (lo + hi) >> 1, h = ved(m); if (h) { hi = m; hr = h; } else lo = m; }
  res.hit = { v: hi * s.step, ops: hr.ops, u: hr.u, r: hr.r };
  return res;
}

export interface ForslagResultat {
  fejl: boolean; u0: number; styrende: ReturnType<typeof styrende>;
  forslag: SpecResultat[]; uden: ForslagSpec[]; hvorfor: string[];
}

export function beregnForslag(b: Model): ForslagResultat {
  const cur = evaluer(b);
  if (!cur) return { fejl: true, u0: NaN, styrende: null, forslag: [], uden: [], hvorfor: [] };
  const out: SpecResultat[] = [], uden: ForslagSpec[] = [];
  let armHit = false;
  for (const s of forslagSpecs(b)) {
    const lazy = s.art === 'valg' && s.lazy;
    if (lazy && armHit) continue;
    const r = loes(b, s);
    if (r.hit) { out.push(r); if (/ankerarmering/.test(s.noegle)) armHit = true; }
    else if (r.best && r.best.u < cur.u * 0.98 && !lazy) out.push(r);
    else if (r.best && lazy && r.best.u < cur.u * 0.98 && !armHit) out.push(r);
    else if (!lazy) uden.push(s);
  }
  const rel = (r: SpecResultat) => r.hit
    ? (r.spec.art === 'tal' ? (r.hit.v! - r.spec.v0) / r.spec.v0 : 0.08 * ((r.hit.rang ?? 0) + 1) + (r.spec.premis ? 0.5 : 0))
    : 1e3 - (cur.u - r.best!.u);
  out.sort((p, q) => rel(p) - rel(q));
  const hvorfor: string[] = [];
  for (const k of cur.r.kombinationer) for (const d of k.diagnostik) if (/virksom|l1/.test(d.kode) && !hvorfor.includes(d.kode)) hvorfor.push(d.kode);
  return { fejl: false, u0: cur.u, styrende: styrende(cur.r), forslag: out, uden, hvorfor };
}
