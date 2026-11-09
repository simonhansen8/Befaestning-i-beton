// Standardopstillinger af bolte (mønstre) og generering af boltkoordinater. Rene tal.
export type MoensterId = '1' | '2x' | '2y' | '4' | '6' | '8' | '9' | 'cirk' | 'fri';
export type MoensterParam = 'sx' | 'sy' | 'n' | 'r' | 'vinkel';

export const MOENSTRE: { id: MoensterId; antal: number | null; params: MoensterParam[] }[] = [
  { id: '1', antal: 1, params: [] },
  { id: '2x', antal: 2, params: ['sx'] },
  { id: '2y', antal: 2, params: ['sy'] },
  { id: '4', antal: 4, params: ['sx', 'sy'] },
  { id: '6', antal: 6, params: ['sx', 'sy'] },
  { id: '8', antal: 8, params: ['sx', 'sy'] },
  { id: '9', antal: 9, params: ['sx', 'sy'] },
  { id: 'cirk', antal: null, params: ['n', 'r', 'vinkel'] },
  { id: 'fri', antal: null, params: [] },
];

export interface OpstillingInput { type: string; sx?: number; sy?: number; n?: number; r?: number; vinkel?: number; anker: { id: number; x: number; y: number; slids?: string | null }[] }
export interface GenAnker { id: number; x: number; y: number; slids: null }

const rund = (v: number) => Math.round(v * 10) / 10 + 0;
const net = (nx: number, ny: number, dx: number, dy: number, udelad?: (i: number, j: number) => boolean): [number, number][] => {
  const r: [number, number][] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (!udelad?.(i, j)) r.push([(i - (nx - 1) / 2) * dx, (j - (ny - 1) / 2) * dy]);
  return r;
};

/** Koordinater for et mønster; 'fri' (og ukendt) returnerer de eksisterende bolte uændret. */
export function genererAnkre(o: OpstillingInput): { id: number; x: number; y: number; slids?: string | null }[] {
  const sx = +(o.sx ?? 0) || 0, sy = +(o.sy ?? 0) || 0;
  let p: [number, number][];
  switch (o.type) {
    case '1': p = [[0, 0]]; break;
    case '2x': p = net(2, 1, sx, 0); break;
    case '2y': p = net(1, 2, 0, sy); break;
    case '4': p = net(2, 2, sx, sy); break;
    case '6': p = net(3, 2, sx, sy); break;
    case '8': p = net(3, 3, sx, sy, (i, j) => i === 1 && j === 1); break;
    case '9': p = net(3, 3, sx, sy); break;
    case 'cirk': {
      const n = Math.max(2, Math.min(24, Math.round(+(o.n ?? 4) || 4))), r = +(o.r ?? 0) || 0, v = ((+(o.vinkel ?? 0) || 0) * Math.PI) / 180;
      p = Array.from({ length: n }, (_, k) => [r * Math.cos(v + (2 * Math.PI * k) / n), r * Math.sin(v + (2 * Math.PI * k) / n)] as [number, number]);
      break;
    }
    default: return o.anker;
  }
  return p.map(([x, y], k) => ({ id: k + 1, x: rund(x), y: rund(y), slids: null }));
}

/** Drejer opstillingen 90° mod uret om referencepunktet: (x,y) → (−y,x). Pladen følger med (bx/by byttes); lasterne er globale og røres ikke. */
export function drejOpstilling90<T extends OpstillingInput>(o: T): T {
  const anker = o.anker.map((a) => ({ ...a, x: rund(-a.y), y: rund(a.x), slids: a.slids === 'x' ? 'y' : a.slids === 'y' ? 'x' : (a.slids ?? null) }));
  const ud: T = { ...o, anker };
  switch (o.type) {
    case '2x': ud.type = '2y'; ud.sy = o.sx; break;
    case '2y': ud.type = '2x'; ud.sx = o.sy; break;
    case '4': case '8': case '9': ud.sx = o.sy; ud.sy = o.sx; break;
    case 'cirk': ud.vinkel = (+(o.vinkel ?? 0) || 0) + 90; break;
    case '1': break;
    default: ud.type = 'fri'; // fx 3×2: det drejede mønster findes ikke som standard
  }
  return ud;
}

/** Mindste fodplade (hele 10 mm, kun forstørrelse), så alle bolte har kantafstand ≥ 1,2·df til pladekanten (EN 1993-1-8, Tabel 3.3). */
export function tilpasPlade(ankre: { x: number; y: number }[], df: number, bx: number, by: number): { bx: number; by: number } {
  const maks = (v: number[]) => v.reduce((s, x) => Math.max(s, x), 0);
  const kant = 1.2 * df + df / 2; // fra boltens akse til pladekant: hulradius + 1,2·df (som i forslag.ts)
  const ny = (c: number, aktuel: number) => Math.max(aktuel, Math.ceil((2 * (c + kant)) / 10) * 10);
  return { bx: ny(maks(ankre.map((a) => Math.abs(a.x))), bx), by: ny(maks(ankre.map((a) => Math.abs(a.y))), by) };
}
