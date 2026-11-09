// Små 2D/3D-hjælpefunktioner til lastfordelingen (polygon-moment, 3×3 egenværdier, pseudo-invers).
export type Vec3 = [number, number, number];
export type Mat3 = [Vec3, Vec3, Vec3];
export type Punkt = [number, number];

export const mulMatVec = (m: Mat3, v: Vec3): Vec3 => [0, 1, 2].map((r) => m[r]![0]! * v[0] + m[r]![1]! * v[1] + m[r]![2]! * v[2]) as Vec3;
export const norm3 = (v: Vec3): number => Math.hypot(v[0], v[1], v[2]);

/** Klipper polygon til halvplanet a0 + a1·x + a2·y ≤ 0 (Sutherland–Hodgman, én kant). */
export function klipPolygon(poly: Punkt[], a: Vec3): Punkt[] {
  const f = (p: Punkt) => a[0] + a[1] * p[0] + a[2] * p[1];
  const ud: Punkt[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i]!, q = poly[(i + 1) % n]!;
    const fp = f(p), fq = f(q);
    if (fp <= 0) ud.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq);
      ud.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return ud;
}

export interface PolygonMomenter { A: number; Sx: number; Sy: number; Ixx: number; Iyy: number; Ixy: number }

/** Areal, statiske momenter og inertimomenter (om origo) for en simpel polygon. */
export function polygonMomenter(poly: Punkt[]): PolygonMomenter {
  let A = 0, Sx = 0, Sy = 0, Ixx = 0, Iyy = 0, Ixy = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = poly[i]!, [x2, y2] = poly[(i + 1) % n]!;
    const c = x1 * y2 - x2 * y1;
    A += c / 2;
    Sx += ((x1 + x2) * c) / 6;
    Sy += ((y1 + y2) * c) / 6;
    Ixx += ((x1 * x1 + x1 * x2 + x2 * x2) * c) / 12;
    Iyy += ((y1 * y1 + y1 * y2 + y2 * y2) * c) / 12;
    Ixy += ((x1 * y2 + 2 * x1 * y1 + 2 * x2 * y2 + x2 * y1) * c) / 24;
  }
  return { A, Sx, Sy, Ixx, Iyy, Ixy };
}

/** Jacobi-egenværdiopløsning af symmetrisk 3×3. Returnerer egenværdier og egenvektorer som kolonner i V. */
export function egenvaerdier(m: Mat3): { lam: Vec3; V: Mat3 } {
  const e = m.map((r) => r.slice()) as number[][];
  const V: number[][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const skala = Math.abs(e[0]![0]!) + Math.abs(e[1]![1]!) + Math.abs(e[2]![2]!) + Math.abs(e[0]![1]!) + Math.abs(e[0]![2]!) + Math.abs(e[1]![2]!);
  for (let sweep = 0; sweep < 60; sweep++) {
    const off = Math.abs(e[0]![1]!) + Math.abs(e[0]![2]!) + Math.abs(e[1]![2]!);
    if (off <= 1e-15 * skala || off === 0) break;
    for (const [o, a] of [[0, 1], [0, 2], [1, 2]] as const) {
      if (e[o]![a] === 0) continue;
      const th = (e[a]![a]! - e[o]![o]!) / (2 * e[o]![a]!);
      const t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let h = 0; h < 3; h++) { const f = e[h]![o]!, g = e[h]![a]!; e[h]![o] = c * f - s * g; e[h]![a] = s * f + c * g; }
      for (let h = 0; h < 3; h++) { const f = e[o]![h]!, g = e[a]![h]!; e[o]![h] = c * f - s * g; e[a]![h] = s * f + c * g; }
      for (let h = 0; h < 3; h++) { const f = V[h]![o]!, g = V[h]![a]!; V[h]![o] = c * f - s * g; V[h]![a] = s * f + c * g; }
    }
  }
  return { lam: [e[0]![0]!, e[1]![1]!, e[2]![2]!], V: V as Mat3 };
}

/** Løser m·x = b via pseudo-invers (egenværdier under tol·max sættes ud af spil). */
export function loesPseudo(m: Mat3, b: Vec3, tol = 1e-12): Vec3 {
  const { lam, V } = egenvaerdier(m);
  const maks = Math.max(...lam.map(Math.abs));
  const x: Vec3 = [0, 0, 0];
  if (!(maks > 0)) return x;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(lam[a]!) <= tol * maks) continue;
    const l = V[0]![a]! * b[0] + V[1]![a]! * b[1] + V[2]![a]! * b[2];
    for (let c = 0; c < 3; c++) x[c]! += (l / lam[a]!) * V[c]![a]!;
  }
  return x;
}
