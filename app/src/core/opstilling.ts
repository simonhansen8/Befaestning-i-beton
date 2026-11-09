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
