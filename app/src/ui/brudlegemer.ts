// Brudlegemer og berørte dele for én valgt brudform, tegnet ud fra kernens faktiske mellemresultater
// (ccr, scr, A_c,N, A_c,V, c1 …). Alle legemer er IDEALISEREDE (35°-kegle, retvinklet kil); de viser geometrien bag tallene.
import type { RectUnion } from '../core/geometry';
import type { KombinationsResultat } from '../core/kombination';
import type { Del } from './model3d';

type Pkt3 = [number, number, number];
type Anker = { id: number; x: number; y: number };
export interface BrudKontekst {
  m: Record<string, any>; k: KombinationsResultat; ankre: Anker[];
  x0: number; x1: number; y0: number; y1: number; dybde: number; hef: number; d: number;
}
const dk = (v: number, n = 0) => v.toFixed(n).replace('.', ',');
const DIR: Record<string, [number, number]> = { xNeg: [-1, 0], xPos: [1, 0], yNeg: [0, -1], yPos: [0, 1] };

function areal(U: RectUnion, navn: string, z = 0.5): Del[] {
  if (!U.omrids.length) return [];
  const xs = U.omrids.flatMap((s) => [s[0][0], s[1][0]]), ys = U.omrids.flatMap((s) => [s[0][1], s[1][1]]);
  return [
    { type: 'linjer', segmenter: U.omrids.map(([a, b]) => [[a[0], a[1], z], [b[0], b[1], z]] as [Pkt3, Pkt3]) },
    { type: 'tekst', pos: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, z], tekst: `${navn} = ${dk(U.areal / 100)} cm²` },
  ];
}

const kegler = (ids: Anker[], radius: number, hoejde: number): Del[] =>
  ids.map((q) => ({ type: 'kegle', rolle: 'brud', x: q.x, y: q.y, zTop: 0, hoejde, radius }));
const baand = (q: Anker, r: number, z0: number, z1: number): Del => ({ type: 'markering', x: q.x, y: q.y, z0, z1, r });

function kil(c: BrudKontekst, kant: string, ids: number[], c1: number): Del[] {
  const dir = DIR[kant]!, per: [number, number] = [-dir[1], dir[0]];
  const ud: Del[] = [];
  for (const id of ids) {
    const q = c.ankre.find((z) => z.id === id); if (!q) continue;
    const P = (f: number, g: number, z: number): Pkt3 => [q.x + dir[0] * f + per[0] * g, q.y + dir[1] * f + per[1] * g, z];
    ud.push({ type: 'legeme', rolle: 'brud', punkter: [P(0, 0, 0), P(c1, 1.5 * c1, 0), P(c1, -1.5 * c1, 0), P(c1, 0, -c1)], flader: [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]] });
  }
  return ud;
}

/** Del-liste for brudformen `id`; tom hvis der ikke er noget at vise. */
export function brudlegemer(id: string, c: BrudKontekst, set = new Set<string>()): Del[] {
  if (set.has(id)) return [];
  set.add(id);
  const { k, m, ankre } = c, d = k.detaljer, hef = c.hef, ud: Del[] = [];
  const traek = k.traek.traekAnkre as unknown as Anker[];
  const forskAnkre = (() => {
    const V = k.forskydning.V, maks = Math.max(0, ...V);
    return ankre.filter((_q, i) => V[i]! > 0.001 * maks && V[i]! > 1);
  })();
  const styrAnker = (n: string) => { const s = k.brudformer.find((b) => b.id === n)?.styrendeAnker; return (Array.isArray(s) ? s : s != null ? [s] : []).map((i) => ankre.find((q) => q.id === i)).filter((q): q is Anker => !!q); };
  switch (id) {
    case 'N_s': for (const q of styrAnker('N_s').length ? styrAnker('N_s') : traek) ud.push(baand(q, 0.75 * c.d, -0.6 * c.d, 0.6 * c.d)); break;
    case 'V_s': for (const q of styrAnker('V_s')) ud.push(baand(q, 0.75 * c.d, -0.6 * c.d, 0.6 * c.d)); break;
    case 'N_p': {
      const bo = d.N_p?.bond;
      if (bo) {
        ud.push(...kegler(traek, bo.ccr, hef), ...areal(bo.U, 'Ap,N'));
        for (const q of traek) ud.push(baand(q, 0.8 * c.d, -hef, 0));
      } else {
        const a = m.anker, side = a.hovedForm === 'firkant' ? (a.hovedSide ?? a.dh) : a.dh;
        for (const q of traek) ud.push(baand(q, 0.6 * side, -hef - 0.2 * a.th, -hef + 1.2 * a.th));
      }
      break;
    }
    case 'N_c': if (d.N_c) ud.push(...kegler(traek, d.N_c.ccr, d.N_c.hefE), ...areal(d.N_c.U, 'Ac,N')); break;
    case 'N_sp': if (d.N_sp) ud.push(...areal(d.N_sp.U, 'Ac,N (spaltning)')); break;
    case 'N_cb': {
      const s = d.N_cb; if (!s) break;
      const dir = DIR[s.kant]!, per: [number, number] = [-dir[1], dir[0]];
      const T = s.ankre.map((q) => q.x * per[0] + q.y * per[1]);
      const lo = Math.min(...T) - 2 * s.c1, hi = Math.max(...T) + 2 * s.c1;
      const a0 = s.ankre[0]!, edge = a0.x * dir[0] + a0.y * dir[1] + s.c1; // koordinat langs udadrettet normal ved kanten
      const zTop = Math.min(0, -(hef - 2 * s.c1)), zBot = -(hef + Math.min(2 * s.c1, Math.max(0, m.beton.h - hef)));
      const ang = (f: number, g: number) => [dir[0] * f + per[0] * g, dir[1] * f + per[1] * g] as const;
      const hj = [ang(edge, lo), ang(edge - 1.5 * s.c1, hi)];
      const xs = hj.map((p) => p[0]), ys = hj.map((p) => p[1]);
      ud.push({ type: 'boks', rolle: 'brud', x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), z0: Math.max(zBot, -c.dybde), z1: zTop });
      ud.push({ type: 'tekst', pos: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, 0.5], tekst: `Ac,Nb = ${dk(s.Ac / 100)} cm² (${dk(s.Lb)} × ${dk(s.Hb)} mm)` });
      break;
    }
    case 'V_cp': if (d.V_cp?.kegle) ud.push(...kegler(forskAnkre, d.V_cp.kegle.ccr, d.V_cp.kegle.hefE), ...areal(d.V_cp.kegle.U, 'Ac,N')); break;
    case 'V_c': {
      const q = k.kantbrud.styrende; if (!q) break;
      ud.push(...kil(c, q.kant, q.ankre, q.R.c1));
      const dir = DIR[q.kant]!, xKant = q.kant === 'xNeg' || q.kant === 'xPos';
      const e = xKant ? (dir[0] < 0 ? c.x0 : c.x1) : (dir[1] < 0 ? c.y0 : c.y1), hv = Math.min(q.R.Hv, c.dybde);
      const segs: [Pkt3, Pkt3][] = [];
      for (const [a, b] of q.R.iv.segmenter) {
        const P = (t: number, z: number): Pkt3 => (xKant ? [e, t, z] : [t, e, z]);
        segs.push([P(a, 0), P(b, 0)], [P(b, 0), P(b, -hv)], [P(b, -hv), P(a, -hv)], [P(a, -hv), P(a, 0)]);
      }
      ud.push({ type: 'linjer', segmenter: segs });
      if (q.R.iv.segmenter[0]) { const [a, b] = q.R.iv.segmenter[0]; ud.push({ type: 'tekst', pos: xKant ? [e, (a + b) / 2, -hv / 2] : [(a + b) / 2, e, -hv / 2], tekst: `Ac,V = ${dk(q.R.Ac / 100)} cm²` }); }
      break;
    }
    case 'N_re': case 'N_a': {
      if (d.N_c) ud.push(...kegler(traek, d.N_c.ccr, d.N_c.hefE));
      break;
    }
    case 'N_cre': {
      const T = m.beton.armering.ankerarmeringTraek.forankringsdybde ?? hef;
      ud.push(...kegler(traek, 1.5 * T, T));
      break;
    }
    case 'V_re': case 'V_a': {
      const kant = k.armKant?.kant, fr = kant ? k.kantbrud.forreste[kant] : null;
      if (kant && fr) ud.push(...kil(c, kant, fr.ankre, fr.R.c1));
      break;
    }
    case 'NV_s': ud.push(...brudlegemer('N_s', c, set), ...brudlegemer('V_s', c, set)); break;
    case 'NV_c': case 'NV_re':
      for (const x of [d.NV?.styrendeTraek, d.NV?.styrendeForskydning]) if (x) ud.push(...brudlegemer(x, c, set));
      break;
  }
  return ud;
}

export const IDEALISERET = 'Idealiseret legeme (35°-kegle / retvinklet kil) tegnet efter beregningens værdier – ikke det virkelige brudforløb.';
