// Levende oversigt under ankerarmerings-felterne: viser de beregnede størrelser, der ikke kan indtastes (fx l1).
import type { ArmeringT, ArmeringV } from '../core/reinforcement';

type Model = Record<string, any>;
const f0 = (v: number) => Math.round(v).toString().replace('-', '−');

export function oversigtTraek(m: Model, a: ArmeringT | null): string[] {
  if (!a || !a.aktiv) return [];
  const ar = m.beton.armering.ankerarmeringTraek, hef = m.anker.hef, p = ar.diameter || 12, tan35 = Math.tan((35 * Math.PI) / 180);
  const n = Math.max(1, Math.round(ar.antalBoejler ?? 1));
  const l: string[] = [];
  l.push(`Benenes afstand til ankeret: √(x² + e²) = ${f0(a.rad)} mm (grænse 0,75·hef = ${f0(0.75 * hef)} mm).`);
  l.push(`l₁ er ikke et input, men afledt af geometrien: l₁ = hef − tan 35°·afstand − c_top − (j−1)·(⌀+1) = ${f0(hef)} − ${f0(tan35 * a.rad)} − ${f0(ar.daeklagTop)} − (j−1)·${f0(p + 1)}.`);
  const alle = Array.from({ length: n }, (_v, j) => hef - tan35 * a.rad - (ar.daeklagTop + j * (p + 1)));
  l.push(`Beregnet l₁ pr. bøjle: ${alle.map((v) => f0(v)).join(' / ')} mm. Krav l₁ ≥ ${f0(a.l1min)} mm (${ar.krog ? '4⌀ med bøjning' : '10⌀ lige stænger'}).`);
  if (a.mangler.includes('l1-for-kort')) {
    const cmax = hef - tan35 * a.rad - a.l1min - (n - 1) * (p + 1);
    const nmax = Math.floor((hef - tan35 * a.rad - ar.daeklagTop - a.l1min) / (p + 1)) + 1;
    l.push(`Løsning: ${cmax >= 0 ? `sæt dæklag til benets top c_top ≤ ${f0(cmax)} mm` : 'bøjlerne kan ikke nå kravet ved denne hef og afstand'}${nmax >= 1 ? `, eller brug højst ${nmax} bøjle${nmax === 1 ? '' : 'r'}` : ''}, mindsk afstanden x, øg hef${ar.krog ? '' : ', eller slå "Bøjle med bøjning ved overfladen" til (krav 4⌀)'}.`);
  }
  return l;
}

export function oversigtForskydning(m: Model, a: ArmeringV | null): string[] {
  if (!a || !a.aktiv) return [];
  const l: string[] = [];
  if (a.form === 'overflade' && a.staenger) {
    l.push(`Stænger pr. anker: ${a.staenger.map((s) => `v = ${f0(s.v)} mm: l₁ = ${f0(s.l1)} mm ${s.virksom ? '✓' : '✗ (ikke virksom)'}`).join('; ')}.`);
    l.push(`l₁ beregnes: c₁ − √(v² + z_s²)/1,5 − c_nom (kan begrænses ved at indtaste l₁). Krav l₁ ≥ ${f0(a.l1min ?? 0)} mm og |v| ≤ 0,75·c₁.`);
  } else l.push(`Virksomme ben pr. anker: ${f0(a.antalVirksomme)}.`);
  return l;
}
