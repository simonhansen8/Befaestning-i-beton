// Plantegning (SVG): betonkanter, fodplade, bolte med trækkraft, trykzone og forskydningsretning for en kombination.
// Ren funktion fra model + kombinationsresultat til SVG-tekst; y-aksen vender opad som i modellen.
import type { KombinationsResultat } from '../core/kombination';
import type { Model } from './skema-typer';

const f1 = (v: number) => v.toFixed(1);

export function plantegningSvg(m: Model, k: KombinationsResultat | null): string {
  const ankre: { id: number; x: number; y: number; slids?: string | null }[] = m.opstilling.anker;
  const bx = m.plade.bx, by = m.plade.by, d = m.anker.d;
  const kanter = m.beton.kanter as Record<string, number | null>;
  const ext = Math.max(bx, by, ...ankre.flatMap((a) => [Math.abs(a.x) + 60, Math.abs(a.y) + 60]),
    ...Object.values(kanter).map((v) => (v == null ? 0 : Math.min(v, 2.5 * Math.max(bx, by)))));
  const r = ext * 1.15;                          // halv udstrækning af synsfeltet [mm]
  const S = 400 / (2 * r);                       // mm → px
  const X = (x: number) => 200 + x * S, Y = (y: number) => 200 - y * S;
  const o: string[] = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" class="plan" role="img" aria-label="Plantegning af fodplade og bolte">`);
  o.push(`<defs><pattern id="skraa" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" stroke-opacity=".25" stroke-width="1"/></pattern></defs>`);
  // beton: hele feltet er beton, uden for fri kant skraveres
  const xn = kanter.xNeg, xp = kanter.xPos, yn = kanter.yNeg, yp = kanter.yPos;
  const bet = { x0: xn == null ? -r : -xn, x1: xp == null ? r : xp, y0: yn == null ? -r : -yn, y1: yp == null ? r : yp };
  o.push(`<rect x="0" y="0" width="400" height="400" fill="url(#skraa)"/>`);
  o.push(`<rect x="${f1(X(bet.x0))}" y="${f1(Y(bet.y1))}" width="${f1((bet.x1 - bet.x0) * S)}" height="${f1((bet.y1 - bet.y0) * S)}" fill="var(--card)" stroke="none"/>`);
  const kant = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${f1(X(x1))}" y1="${f1(Y(y1))}" x2="${f1(X(x2))}" y2="${f1(Y(y2))}" stroke="currentColor" stroke-width="2"/>`;
  if (xn != null) o.push(kant(-xn, bet.y0, -xn, bet.y1));
  if (xp != null) o.push(kant(xp, bet.y0, xp, bet.y1));
  if (yn != null) o.push(kant(bet.x0, -yn, bet.x1, -yn));
  if (yp != null) o.push(kant(bet.x0, yp, bet.x1, yp));
  // fodplade
  o.push(`<rect x="${f1(X(-bx / 2))}" y="${f1(Y(by / 2))}" width="${f1(bx * S)}" height="${f1(by * S)}" fill="color-mix(in srgb, var(--accent) 8%, transparent)" stroke="var(--accent)" stroke-width="1.5"/>`);
  // trykzone
  const pol = k?.fordeling.polygon ?? [];
  if (pol.length >= 3) o.push(`<polygon points="${pol.map((p) => `${f1(X(p[0]))},${f1(Y(p[1]))}`).join(' ')}" fill="var(--warn)" fill-opacity=".28" stroke="var(--warn)" stroke-width="1"/>`);
  // akser
  o.push(`<line x1="${f1(X(-r))}" y1="${f1(Y(0))}" x2="${f1(X(r))}" y2="${f1(Y(0))}" stroke="currentColor" stroke-opacity=".3" stroke-dasharray="4 3"/>`);
  o.push(`<line x1="${f1(X(0))}" y1="${f1(Y(-r))}" x2="${f1(X(0))}" y2="${f1(Y(r))}" stroke="currentColor" stroke-opacity=".3" stroke-dasharray="4 3"/>`);
  o.push(`<text x="392" y="${f1(Y(0) - 3)}" text-anchor="end" font-size="9" fill="currentColor" fill-opacity=".6">x</text><text x="${f1(X(0) + 4)}" y="10" font-size="9" fill="currentColor" fill-opacity=".6">y</text>`);
  // bolte
  const maxF = Math.max(1, ...(k?.fordeling.F ?? [0]));
  const maxV = Math.max(1, ...(k?.forskydning.V ?? [0]));
  ankre.forEach((a, i) => {
    const F = k?.fordeling.F[i] ?? 0;
    const rad = Math.max(3, (d / 2) * S);
    const tr = F > 0 ? Math.min(1, F / maxF) : 0;
    o.push(`<circle cx="${f1(X(a.x))}" cy="${f1(Y(a.y))}" r="${f1(rad)}" fill="color-mix(in srgb, var(--err) ${Math.round(tr * 70)}%, var(--card))" stroke="currentColor" stroke-width="1.2"><title>Bolt ${a.id}: træk ${F > 0 ? f1(F / 1000) : '0'} kN</title></circle>`);
    if (k) {
      const vx = k.forskydning.Vx[i] ?? 0, vy = k.forskydning.Vy[i] ?? 0, V = Math.hypot(vx, vy);
      if (V > 1e-6 * maxV) {
        const L = 26 * Math.min(1, V / maxV) + 6;
        const ex = X(a.x) + (vx / V) * L, ey = Y(a.y) - (vy / V) * L;
        o.push(`<line x1="${f1(X(a.x))}" y1="${f1(Y(a.y))}" x2="${f1(ex)}" y2="${f1(ey)}" stroke="var(--accent)" stroke-width="1.6"/>`);
        o.push(`<circle cx="${f1(ex)}" cy="${f1(ey)}" r="2.2" fill="var(--accent)"/>`);
      }
    }
    o.push(`<text x="${f1(X(a.x) + rad + 2)}" y="${f1(Y(a.y) - rad - 1)}" font-size="9" fill="currentColor">${a.id}${F > 0 ? ` · ${f1(F / 1000)}` : ''}</text>`);
  });
  if (k && k.fordeling.C > 0) o.push(`<circle cx="${f1(X(k.fordeling.xC))}" cy="${f1(Y(k.fordeling.yC))}" r="3" fill="var(--warn)"><title>Resultant af trykzonen: ${f1(k.fordeling.C / 1000)} kN</title></circle>`);
  o.push('</svg>');
  return o.join('');
}

/** Forklaring til plantegningen (tekst i præsentationslaget). */
export const PLAN_FORKLARING = 'Skravering = uden for beton · blå ramme = fodplade · rød fyld = ankertræk (kN ved bolt) · gul = trykzone · blå pil = forskydning.';
