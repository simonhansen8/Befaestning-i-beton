// Snit (SVG): lodret snit gennem boltene, set langs x (snit i x-z-planen) eller y. Ren funktion fra model til SVG-tekst.
import type { Model } from './skema-typer';

const f1 = (v: number) => v.toFixed(1);
const heltal = (v: number) => Math.round(v).toString();

export type SnitAkse = 'x' | 'y';

export function snitSvg(m: Model, akse: SnitAkse = 'x'): string {
  const a = m.anker, be = m.beton, pl = m.plade;
  const ankre: { id: number; x: number; y: number }[] = m.opstilling.anker ?? [];
  const pos = (q: { x: number; y: number }) => (akse === 'x' ? q.x : q.y);
  const bredde = akse === 'x' ? pl.bx : pl.by;
  const [kNeg, kPos] = (akse === 'x' ? [be.kanter?.xNeg, be.kanter?.xPos] : [be.kanter?.yNeg, be.kanter?.yPos]) as (number | null | undefined)[];
  const hef = a.hef, d = a.d, e = pl.afstandTilBeton ?? 0, t = pl.t;
  const ps = ankre.map(pos);
  const margin = Math.max(150, 0.9 * hef);
  const x0 = kNeg != null ? -kNeg : Math.min(-bredde / 2, ...ps) - margin;
  const x1 = kPos != null ? kPos : Math.max(bredde / 2, ...ps) + margin;
  const dybdeMax = 2 * hef + 60, dybde = Math.min(be.h, dybdeMax), afbrudt = be.h > dybdeMax;
  const topZ = e + t + 1.4 * d;
  const bredT = x1 - x0, hoejT = dybde + topZ + 40;
  const W = 440, S = (W - 40) / bredT, H = Math.min(420, hoejT * S + 70);
  const X = (x: number) => 20 + (x - x0) * S, Z = (z: number) => 30 + (topZ - z) * S;
  const o: string[] = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${f1(H)}" class="snit" role="img" aria-label="Snit gennem boltene">`);
  o.push(`<defs><pattern id="skraaSnit" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" stroke-opacity=".3" stroke-width="1"/></pattern></defs>`);
  o.push(`<rect x="${f1(X(x0))}" y="${f1(Z(0))}" width="${f1(bredT * S)}" height="${f1(dybde * S)}" fill="url(#skraaSnit)" stroke="currentColor" stroke-width="1.5"/>`);
  if (afbrudt) o.push(`<path d="M${f1(X(x0))} ${f1(Z(-dybde))} l6 -4 l6 8 l6 -8 l6 8 l6 -4" stroke="currentColor" fill="none"/>`);
  const frie = [kNeg != null ? x0 : null, kPos != null ? x1 : null].filter((v) => v != null) as number[];
  for (const v of frie) o.push(`<line x1="${f1(X(v))}" y1="${f1(Z(0))}" x2="${f1(X(v))}" y2="${f1(Z(-dybde))}" stroke="currentColor" stroke-width="3"/>`);
  o.push(`<line x1="${f1(X(x0))}" y1="${f1(Z(0))}" x2="${f1(X(x1))}" y2="${f1(Z(0))}" stroke="currentColor" stroke-width="2"/>`);
  // fodplade
  o.push(`<rect x="${f1(X(-bredde / 2))}" y="${f1(Z(e + t))}" width="${f1(bredde * S)}" height="${f1(t * S)}" fill="var(--accent)" fill-opacity=".35" stroke="var(--accent)"/>`);
  // bolte (alle projiceret; dem uden for snitlinjen er svagere)
  const indstoebt = a.type !== 'indlimet';
  for (const q of ankre) {
    const p = pos(q), pa = akse === 'x' ? q.y : q.x;
    const i = Math.abs(pa) < 1 ? 1 : 0.35;
    o.push(`<g opacity="${i}"><rect x="${f1(X(p - d / 2))}" y="${f1(Z(topZ))}" width="${f1(d * S)}" height="${f1((topZ + hef) * S)}" fill="currentColor"/>`);
    if (indstoebt) { const dh = a.hovedForm === 'firkant' ? (a.hovedSide ?? a.dh) : a.dh; o.push(`<rect x="${f1(X(p - dh / 2))}" y="${f1(Z(-hef + a.th))}" width="${f1(dh * S)}" height="${f1(a.th * S)}" fill="currentColor"/>`); }
    o.push(`<rect x="${f1(X(p - 0.95 * d))}" y="${f1(Z(e + t + 0.8 * d))}" width="${f1(1.9 * d * S)}" height="${f1(0.8 * d * S)}" fill="currentColor"/></g>`);
  }
  // mål: hef ved første bolt, h til højre, afstand til kanter
  const lin = (xa: number, za: number, xb: number, zb: number) => `<line x1="${f1(xa)}" y1="${f1(za)}" x2="${f1(xb)}" y2="${f1(zb)}" stroke="var(--warn)" stroke-width="1"/>`;
  const txt = (x: number, z: number, s: string, anker = 'middle') => `<text x="${f1(x)}" y="${f1(z)}" font-size="10" text-anchor="${anker}" fill="var(--warn)">${s}</text>`;
  if (ankre.length) {
    const p = pos(ankre[0]!), xm = X(p + 2.2 * d);
    o.push(lin(xm, Z(0), xm, Z(-hef)), txt(xm + 4, Z(-hef / 2), `hef ${heltal(hef)}`, 'start'));
    for (const [kv, retn] of [[kNeg, -1], [kPos, 1]] as const) {
      if (kv == null) continue;
      const nær = ps.reduce((b, v) => (Math.abs(v - retn * kv) < Math.abs(b - retn * kv) ? v : b), ps[0]!);
      const c = Math.abs(retn * kv - nær), ym = Z(0) - 8;
      o.push(lin(X(nær), ym, X(retn * kv), ym), txt((X(nær) + X(retn * kv)) / 2, ym - 3, `c ${heltal(c)}`));
    }
  }
  const xr = X(x1) - 6;
  o.push(lin(xr, Z(0), xr, Z(-dybde)), txt(xr - 4, Z(-dybde / 2), `h ${heltal(be.h)}`, 'end'));
  o.push(txt(X(x0) + 2, H - 8, `Snit i ${akse}-z-planen`, 'start'));
  o.push(`</svg>`);
  return o.join('');
}
