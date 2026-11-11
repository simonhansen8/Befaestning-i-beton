// Levende oversigt under ankerarmerings-felterne: viser de beregnede størrelser, der ikke kan indtastes (fx l1).
import { forankringsFaktor, type ArmeringT, type ArmeringV } from '../core/reinforcement';

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
  } else {
    l.push(`Virksomme ben pr. anker: ${f0(a.antalVirksomme)}.`);
    if (a.boejler) l.push(`Bøjler med afstand ${f0(a.boejler[1]?.pos ?? 0)} mm: ${a.boejler.map((b) => `${f0(b.pos)} mm ${b.virksom ? '✓' : '✗'}`).join(', ')} – kun dem inden for 0,5·c₁ = ${f0(a.zone ?? 0)} mm regnes med.`);
  }
  return l;
}

/**
 * De to kantarmeringer er forskellige valg med forskellige krav, og kun den ene regner for en given række:
 * ankerarmering for forskydning (7.2.2.6) erstatter betonkantbruddet for den dækkede række; kantarmering (ψre,V, 7.2.2.5(13)) er kun en faktor i betonkantbruddet.
 */
export function kantvalg(m: Model, kr: any): { aktiv: boolean; tekst: string; advarsel?: boolean }[] {
  const ar = m.beton.armering, av = ar.ankerarmeringForskydning;
  const kant = (k: string) => ({ xNeg: 'x−', xPos: 'x+', yNeg: 'y−', yPos: 'y+' } as Record<string, string>)[k] ?? k;
  const dak = !!(av.aktiv && kr?.armV?.virksom && kr?.armKant);
  const l: { aktiv: boolean; tekst: string; advarsel?: boolean }[] = [];
  if (!av.aktiv) l.push({ aktiv: false, tekst: 'Ankerarmering for forskydning (7.2.2.6, fig. 7.10) er slået fra.' });
  else if (dak) l.push({ aktiv: true, tekst: `Ankerarmering for forskydning (${av.type === 'overflade' ? 'overfladearmering' : av.type === 'boejle' ? 'bøjler' : 'løkker'}, 7.2.2.6) bærer forskydningen mod kant ${kant(kr.armKant.kant)}. Betonkantbrud og ψre,V regnes ikke for den række.` });
  else l.push({ aktiv: false, tekst: 'Ankerarmering for forskydning er slået til, men virker ikke (se advarslerne) – betonkantbrud med ψre,V regnes i stedet.' });
  const psi = kr?.armKant ? kr?.kantbrud?.forreste?.[kr.armKant.kant]?.psiRe : undefined;
  if (ar.kantarmering === 'ingen') l.push({ aktiv: false, tekst: 'Kantarmering for betonkantbrud (ψre,V, 7.2.2.5(13)): ingen – ψre,V = 1,0.' });
  else if (dak) l.push({ aktiv: false, tekst: 'Kantarmering for betonkantbrud (ψre,V): ikke i brug for den række, der dækkes af ankerarmeringen. Den gælder stadig for øvrige kanter og rækker.' });
  else l.push({ aktiv: true, tekst: `Kantarmering for betonkantbrud (ψre,V, 7.2.2.5(13)): ψre,V = ${psi != null ? String(psi).replace('.', ',') : '1,4 hvis kravene er opfyldt'} i V_Rk,c.` });
  if (dak) {
    const u = (id: string) => kr?.brudformer?.find((x: { id: string }) => x.id === id)?.udnyttelse as number | null | undefined;
    const alfa = forankringsFaktor(av.krog, av.cd, av.diameter || 10);
    const tal = (x: number) => x.toFixed(2).replace('.', ',');
    const over = (['V_a', 'V_re', 'V_ek'] as const).filter((id) => (u(id) ?? 0) > 1);
    l.push({ aktiv: true, advarsel: over.length > 0, tekst: `Forankring i brudprismet: l1 = ${kr.armV.l1 != null ? Math.round(kr.armV.l1) : '–'} mm, α1 = ${tal(alfa)}${av.krog && alfa === 1 ? ' (krogens virkning kræver cd > 3⌀: angiv cd)' : ''}.${over.length ? ` Ankerarmeringen kan ikke bære forskydningen: ${over.map((id) => `${id} = ${Math.round((u(id) ?? 0) * 100)} %`).join(', ')}. Den erstatter betonkantbruddet, så resultatet kan være dårligere end uden armering. Øg l1 eller armering, angiv cd, eller slå ankerarmeringen fra.` : ''}` });
  }
  return l;
}
