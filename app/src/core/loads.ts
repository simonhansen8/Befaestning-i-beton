// Lastfordeling (EN 1992-4, 6.2.1 og 6.2.2): fordeling af N, Mx, My på ankre via stiv fodplade med trykzone,
// og fordeling af Vx, Vy, T. Rene funktioner uden tekst/HTML; enheder N, mm, MPa, Nmm.
import { egenvaerdier, klipPolygon, loesPseudo, mulMatVec, norm3, polygonMomenter, type Mat3, type Punkt, type Vec3 } from './linalg';

export interface Last { navn?: string; N: number; Vx: number; Vy: number; Mx: number; My: number; T: number }
export interface Anker { id: number; x: number; y: number; slids?: 'x' | 'y' | null }
export interface Plade { bx: number; by: number }
export interface Kanter { xNeg: number | null; xPos: number | null; yNeg: number | null; yPos: number | null }

/** Ganger lasten med K_FI. Gunstig (negativ) normalkraft skaleres højst med 1 (på den sikre side). */
export function skalerLast(l: Last, kfi: number): Last {
  if (kfi === 1) return { ...l };
  return { ...l, N: l.N > 0 ? kfi * l.N : Math.min(1, kfi) * l.N, Vx: kfi * l.Vx, Vy: kfi * l.Vy, Mx: kfi * l.Mx, My: kfi * l.My, T: kfi * l.T };
}

export interface TraekFordeling {
  /** Ankerkraft pr. anker [N] (≥ 0 = træk). */
  F: number[];
  /** Resulterende trykkraft under pladen [N] og dens angrebspunkt [mm]. */
  C: number; xC: number; yC: number;
  sigmaMaks: number;
  polygon: Punkt[];
  iterationer: number;
  konvergeret: boolean;
  residual: number;
}

/**
 * Stiv plade med plan tøjning ε = q0 + q1·x/l + q2·y/l. Ankre optager kun træk (Es·As·ε), betonen kun tryk (Ec),
 * klippet til pladens og betonkanternes udstrækning. Ligevægt findes med dæmpet Newton (linjesøgning).
 */
export function fordelTraek(
  ankre: Anker[], As: number, plade: Plade, last: Last, opt: { Es?: number; Ec?: number; kanter?: Partial<Kanter> } = {},
): TraekFordeling {
  const Es = opt.Es ?? 210000, Ec = opt.Ec ?? 30000;
  const n = ankre.length;
  const l = Math.max(plade.bx, plade.by) / 2;
  const N = last.N || 0, Mx = last.Mx || 0, My = last.My || 0;
  const h: Vec3 = [N, -My / l, Mx / l];
  const lastNorm = Math.abs(N) + (Math.abs(Mx) + Math.abs(My)) / l;
  const tom: TraekFordeling = { F: new Array(n).fill(0), C: 0, xC: 0, yC: 0, sigmaMaks: 0, polygon: [], iterationer: 0, konvergeret: true, residual: 0 };
  if (lastNorm < 1e-6) return tom;

  const kA = Es * As;           // ankerstivhed
  const kC = Ec * l * l;        // betonstivhed (skaleret)
  const g: Vec3[] = ankre.map((a) => [1, a.x / l, a.y / l]);
  const k = opt.kanter ?? {};
  const x0 = Math.max(-plade.bx / 2, k.xNeg != null ? -k.xNeg : -Infinity) / l;
  const x1 = Math.min(plade.bx / 2, k.xPos != null ? k.xPos : Infinity) / l;
  const y0 = Math.max(-plade.by / 2, k.yNeg != null ? -k.yNeg : -Infinity) / l;
  const y1 = Math.min(plade.by / 2, k.yPos != null ? k.yPos : Infinity) / l;
  const rect: Punkt[] = x1 > x0 && y1 > y0 ? [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] : [];

  const momentMat = (m: ReturnType<typeof polygonMomenter>): Mat3 => [[m.A, m.Sx, m.Sy], [m.Sx, m.Ixx, m.Ixy], [m.Sy, m.Ixy, m.Iyy]];

  const eval_ = (q: Vec3) => {
    const K: Mat3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < n; i++) {
      const gi = g[i]!;
      if (q[0] * gi[0] + q[1] * gi[1] + q[2] * gi[2] > 0) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) K[a]![b]! += kA * gi[a]! * gi[b]!;
    }
    const P = klipPolygon(rect, q);
    let M: ReturnType<typeof polygonMomenter> | null = null;
    if (P.length >= 3) {
      M = polygonMomenter(P);
      const mm = momentMat(M);
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) K[a]![b]! += kC * mm[a]![b]!;
    }
    const Kq = mulMatVec(K, q);
    const E = 0.5 * (q[0] * Kq[0] + q[1] * Kq[1] + q[2] * Kq[2]) - (h[0] * q[0] + h[1] * q[1] + h[2] * q[2]);
    return { K, R: [Kq[0] - h[0], Kq[1] - h[1], Kq[2] - h[2]] as Vec3, P, M, E };
  };

  // Startgæt: alle ankre aktive + hele betonen aktiv
  const K0: Mat3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const gi of g) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) K0[a]![b]! += kA * gi[a]! * gi[b]!;
  const Mfuld = rect.length ? polygonMomenter(rect) : { A: 0, Sx: 0, Sy: 0, Ixx: 0, Iyy: 0, Ixy: 0 };
  const F0 = momentMat(Mfuld);
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) K0[a]![b]! += kC * F0[a]![b]!;

  let q = loesPseudo(K0, h);
  const tol = 1e-9 * (lastNorm + 1);
  let cur = eval_(q);
  let iter = 0, konv = false;
  for (iter = 1; iter <= 100; iter++) {
    if (norm3(cur.R) <= tol) { konv = true; break; }
    const { lam } = egenvaerdier(cur.K);
    const lamMaks = Math.max(...lam.map(Math.abs)), lamMin = Math.min(...lam.map(Math.abs));
    let Kn = cur.K;
    if (!(lamMin > 1e-8 * lamMaks)) { const reg = 0.01 * kC; Kn = cur.K.map((r, a) => r.map((v, b) => v + reg * F0[a]![b]!)) as Mat3; }
    const dq = loesPseudo(Kn, cur.R.map((v) => -v) as Vec3);
    const slope = cur.R[0] * dq[0] + cur.R[1] * dq[1] + cur.R[2] * dq[2];
    let step = 1, qn: Vec3, nxt: ReturnType<typeof eval_>;
    for (;;) {
      qn = [q[0] + step * dq[0], q[1] + step * dq[1], q[2] + step * dq[2]];
      nxt = eval_(qn);
      if (nxt.E <= cur.E + 1e-4 * step * Math.min(0, slope) || step <= 1 / 1024) break;
      step /= 2;
    }
    q = qn; cur = nxt;
  }
  const residual = norm3(cur.R);
  if (!konv && residual <= tol) konv = true;

  const F = g.map((gi) => kA * Math.max(0, q[0] * gi[0] + q[1] * gi[1] + q[2] * gi[2]));
  let C = 0, xC = 0, yC = 0, sigmaMaks = 0, polygon: Punkt[] = [];
  if (cur.M && cur.P.length >= 3) {
    const M = cur.M;
    const fe = q[0] * M.A + q[1] * M.Sx + q[2] * M.Sy;
    C = -kC * fe;
    if (C > 1e-9 * (lastNorm + 1)) {
      xC = (l * (q[0] * M.Sx + q[1] * M.Ixx + q[2] * M.Ixy)) / fe;
      yC = (l * (q[0] * M.Sy + q[1] * M.Ixy + q[2] * M.Iyy)) / fe;
      sigmaMaks = -Math.min(...cur.P.map((p) => Ec * (q[0] + q[1] * p[0] + q[2] * p[1])));
      polygon = cur.P.map((p) => [p[0] * l, p[1] * l] as Punkt);
    } else C = 0;
  }
  return { F, C, xC, yC, sigmaMaks, polygon, iterationer: iter, konvergeret: konv && residual <= 1e-6 * (lastNorm + 1), residual };
}

export interface ForskydningsFordeling { Vx: number[]; Vy: number[]; V: number[]; mulig: boolean }

/** Stivheder pr. anker: slidshul i x-retning ophæver stivheden i x (kx = 0) osv. */
export const slidsStivhed = (ankre: Anker[]) => ({
  kx: ankre.map((a) => (a.slids === 'x' ? 0 : 1)),
  ky: ankre.map((a) => (a.slids === 'y' ? 0 : 1)),
});

/** Fordeling af Vx, Vy og torsion T på ankrene (stive forskydningsstivheder kx, ky). */
export function fordelForskydning(ankre: Anker[], kx: number[], ky: number[], last: Last): ForskydningsFordeling {
  const n = ankre.length;
  const Vx = last.Vx || 0, Vy = last.Vy || 0, T = last.T || 0;
  const l = Math.max(1, ...ankre.map((a) => Math.hypot(a.x, a.y)));
  const xs = ankre.map((a) => a.x / l), ys = ankre.map((a) => a.y / l);
  let sx = 0, sy = 0, sxy_y = 0, sxy_x = 0, st = 0;
  for (let i = 0; i < n; i++) {
    sx += kx[i]!; sy += ky[i]!; sxy_y += kx[i]! * ys[i]!; sxy_x += ky[i]! * xs[i]!;
    st += kx[i]! * ys[i]! * ys[i]! + ky[i]! * xs[i]! * xs[i]!;
  }
  const K: Mat3 = [[sx, 0, -sxy_y], [0, sy, sxy_x], [-sxy_y, sxy_x, st]];
  const b: Vec3 = [Vx, Vy, T / l];
  const u = loesPseudo(K, b);
  const res = mulMatVec(K, u).map((v, i) => v - b[i]!) as Vec3;
  const lastNorm = Math.abs(Vx) + Math.abs(Vy) + Math.abs(T) / l;
  const mulig = norm3(res) <= 1e-7 * (lastNorm + 1e-9) || lastNorm < 1e-9;
  const fx: number[] = [], fy: number[] = [], f: number[] = [];
  for (let i = 0; i < n; i++) {
    fx.push(kx[i]! * (u[0] - u[2] * ys[i]!));
    fy.push(ky[i]! * (u[1] + u[2] * xs[i]!));
    f.push(Math.hypot(fx[i]!, fy[i]!));
  }
  return { Vx: fx, Vy: fy, V: f, mulig };
}
