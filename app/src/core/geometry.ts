// Geometri-hjælpere: betonkanter, afstande og projicerede arealer (rektangel-union).
export type Rect = [number, number, number, number]; // [xmin, ymin, xmax, ymax]
export type KantNavn = 'xNeg' | 'xPos' | 'yNeg' | 'yPos';
export const KANTER: readonly KantNavn[] = ['xNeg', 'xPos', 'yNeg', 'yPos'];
export type Kanter = Record<KantNavn, number | null>;
export interface Pkt { x: number; y: number }

/** Afstand fra anker til en given betonkant (∞ hvis kanten ikke findes). Kanter angives som positiv afstand fra origo. */
export function kantafstand(a: Pkt, kanter: Partial<Kanter>, kant: KantNavn): number {
  const v = kanter[kant];
  if (v == null) return Infinity;
  switch (kant) {
    case 'xNeg': return a.x + v;
    case 'xPos': return v - a.x;
    case 'yNeg': return a.y + v;
    case 'yPos': return v - a.y;
  }
}

/** Mindste kantafstand c for alle ankre og alle kanter. */
export function minKantafstand(ankre: Pkt[], kanter: Partial<Kanter>): number {
  let c = Infinity;
  for (const a of ankre) for (const k of KANTER) c = Math.min(c, kantafstand(a, kanter, k));
  return c;
}

/** Klipper rektangel til betonens udstrækning. */
export function klipRect(r: Rect, kanter: Partial<Kanter>): Rect {
  return [
    kanter.xNeg != null ? Math.max(r[0], -kanter.xNeg) : r[0],
    kanter.yNeg != null ? Math.max(r[1], -kanter.yNeg) : r[1],
    kanter.xPos != null ? Math.min(r[2], kanter.xPos) : r[2],
    kanter.yPos != null ? Math.min(r[3], kanter.yPos) : r[3],
  ];
}

export interface RectUnion { areal: number; celler: Rect[]; omrids: [[number, number], [number, number]][] }

/** Areal, celler og omrids af en union af akseparallelle rektangler (koordinatkompression). */
export function rectUnion(rects: Rect[]): RectUnion {
  const e = rects.filter((d) => d[2] > d[0] && d[3] > d[1]);
  if (!e.length) return { areal: 0, celler: [], omrids: [] };
  const xs = [...new Set(e.flatMap((d) => [d[0], d[2]]))].sort((a, b) => a - b);
  const ys = [...new Set(e.flatMap((d) => [d[1], d[3]]))].sort((a, b) => a - b);
  const nx = xs.length - 1, ny = ys.length - 1;
  const g = Array.from({ length: nx }, () => new Uint8Array(ny));
  let areal = 0;
  const celler: Rect[] = [];
  for (let i = 0; i < nx; i++) {
    const mx = (xs[i]! + xs[i + 1]!) / 2;
    for (let j = 0; j < ny; j++) {
      const my = (ys[j]! + ys[j + 1]!) / 2;
      for (const r of e) {
        if (mx > r[0] && mx < r[2] && my > r[1] && my < r[3]) {
          g[i]![j] = 1;
          areal += (xs[i + 1]! - xs[i]!) * (ys[j + 1]! - ys[j]!);
          celler.push([xs[i]!, ys[j]!, xs[i + 1]!, ys[j + 1]!]);
          break;
        }
      }
    }
  }
  const fyldt = (i: number, j: number) => i >= 0 && j >= 0 && i < nx && j < ny && g[i]![j] === 1;
  const omrids: RectUnion['omrids'] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    if (!g[i]![j]) continue;
    if (!fyldt(i - 1, j)) omrids.push([[xs[i]!, ys[j]!], [xs[i]!, ys[j + 1]!]]);
    if (!fyldt(i + 1, j)) omrids.push([[xs[i + 1]!, ys[j]!], [xs[i + 1]!, ys[j + 1]!]]);
    if (!fyldt(i, j - 1)) omrids.push([[xs[i]!, ys[j]!], [xs[i + 1]!, ys[j]!]]);
    if (!fyldt(i, j + 1)) omrids.push([[xs[i]!, ys[j + 1]!], [xs[i + 1]!, ys[j + 1]!]]);
  }
  return { areal, celler, omrids };
}

/** Projiceret areal Ac,N: union af kvadrater med side `s` om hvert anker, klippet til betonen. */
export function projiceretAreal(ankre: Pkt[], s: number, kanter: Partial<Kanter>): RectUnion {
  const h = s / 2;
  return rectUnion(ankre.map((a) => klipRect([a.x - h, a.y - h, a.x + h, a.y + h], kanter)));
}

/** Koordinat langs en kant (y for x-kanter, x for y-kanter). */
export const koordLangsKant = (a: Pkt, kant: KantNavn): number => (kant === 'xNeg' || kant === 'xPos' ? a.y : a.x);

/** Betonens udstrækning langs en kant [min, max] (±∞ hvis ingen kant). */
export function udstraekningLangsKant(kant: KantNavn, k: Partial<Kanter>): [number, number] {
  return kant === 'xNeg' || kant === 'xPos'
    ? [k.yNeg != null ? -k.yNeg : -Infinity, k.yPos != null ? k.yPos : Infinity]
    : [k.xNeg != null ? -k.xNeg : -Infinity, k.xPos != null ? k.xPos : Infinity];
}

export interface Interval { laengde: number; segmenter: [number, number][]; fra: number; til: number }

/** Union af intervaller [p−r, p+r] klippet til [lo, hi]. */
export function intervalUnion(positioner: number[], r: number, lo = -Infinity, hi = Infinity): Interval {
  const iv = positioner.map((a): [number, number] => [Math.max(lo, a - r), Math.min(hi, a + r)]).filter((a) => a[1] > a[0]).sort((a, b) => a[0] - b[0]);
  const seg: [number, number][] = [];
  for (const a of iv) {
    const sidste = seg[seg.length - 1];
    if (sidste && a[0] <= sidste[1]) sidste[1] = Math.max(sidste[1], a[1]);
    else seg.push([a[0], a[1]]);
  }
  return { laengde: seg.reduce((s, a) => s + a[1] - a[0], 0), segmenter: seg, fra: seg.length ? seg[0]![0] : 0, til: seg.length ? seg[seg.length - 1]![1] : 0 };
}
