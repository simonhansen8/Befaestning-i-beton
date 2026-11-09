// Danske tekster til justeringsforslag (kernen i core/forslag.ts har ingen tekst).
import type { ForslagSpec, ValgBeskrivelse } from '../core/forslag';
import { MOENSTER_NAVN } from './render-tekster';

const KANT: Record<string, string> = { xNeg: 'cx−', xPos: 'cx+', yNeg: 'cy−', yPos: 'cy+' };

export function etiket(noegle: string): string {
  if (noegle.startsWith('beton.kanter.')) return 'Kantafstand ' + KANT[noegle.slice(13)];
  const m: Record<string, string> = {
    'anker.hef': 'Forankringsdybde hef', 'beton.h': 'Elementtykkelse h', 'beton.klasse': 'Betonklasse', 'anker.d': 'Boltdiameter d', 'anker.staalklasse': 'Stålkvalitet',
    'opstilling.sx': 'Boltafstand sx', 'opstilling.sy': 'Boltafstand sy', 'opstilling.type': 'Antal bolte', 'opstilling.n': 'Antal bolte',
    'beton.armering.ankerarmeringTraek': 'Ankerarmering for træk (stangdiameter, antal bøjler)',
    'beton.armering.ankerarmeringForskydning': 'Ankerarmering for forskydning (type, diameter, antal)',
    'beton.armering.begge': 'Ankerarmering for træk og forskydning samtidig',
    'beton.armering.afskalning': 'Armering i forankringszonen (ψre,N)', 'beton.armering.kantarmering': 'Kantarmering (ψre,V)',
    'beton.armering.splitArmering': 'Revnebegrænsende armering (spaltning)',
    'beton.armering.ankerarmeringTraek.krog': 'Krog på ankerarmering for træk', 'beton.armering.ankerarmeringForskydning.krog': 'Krog på ankerarmering for forskydning',
  };
  return m[noegle] ?? noegle;
}

const FORM_V = { overflade: 'overfladearmering', boejle: 'bøjle', loekke: 'løkke' } as const;
const dk = (v: number, dec = 0) => v.toLocaleString('da-DK', { minimumFractionDigits: dec, maximumFractionDigits: dec });

function armT(b: Extract<ValgBeskrivelse, { type: 'armT' }>): string {
  const f = b.foering ? (b.foering === 'stoed' ? ', trækket ført videre ved stød i elementets armering' : ', ikke ført videre') : '';
  return `${b.antalBoejler} bøjle${b.antalBoejler > 1 ? 'r' : ''} Ø${b.diameter} (${2 * b.antalBoejler} ben pr. anker)${f}`;
}
function armV(b: Extract<ValgBeskrivelse, { type: 'armV' }>): string {
  const n = b.form === 'overflade' ? `${b.antal} ben` : b.form === 'boejle' ? `${b.antal} bøjle(r)` : `${b.antal} løkke(r) pr. anker`;
  return `${FORM_V[b.form]}: ${n} Ø${b.diameter}`;
}

export function valgTekst(b: ValgBeskrivelse): string {
  switch (b.type) {
    case 'klasse': return b.klasse;
    case 'd': return 'M' + b.d;
    case 'staal': return b.klasse;
    case 'antalBolte': return b.moenster ? `${b.antal} bolte (${(MOENSTER_NAVN[b.moenster] ?? '').replace(/^\d+ bolte?,? ?/, '')})` : `${b.antal} bolte`;
    case 'armT': return armT(b);
    case 'armV': return armV(b);
    case 'armBegge': return `${armT(b.t)} + ${armV(b.v)}`;
    case 'fjernArm': return b.hvilke === 'begge' ? 'fjern al ankerarmering (træk og forskydning)' : 'fjern ankerarmeringen';
    case 'premis': return ({
      afskalning: 'åben eller ingen armering (ψre,N = 1,0)',
      kantarmering: `kantstang Ø${b.data?.diameter} + bøjler/net a = ${b.data?.a} mm (ψre,V = 1,4)`,
      splitArmering: 'ja (wk ≤ 0,3 mm)', krogT: 'med krog (l1 ≥ 4Ø)', krogV: 'med krog (l1 ≥ 4Ø)',
    })[b.id];
  }
}

export function fraTekst(noegle: string, fra: string | null): string {
  if (fra == null) return 'ingen';
  if (noegle.endsWith('ankerarmeringTraek')) { const [n, d] = fra.split('×Ø'); return `${n} bøjle(r) Ø${d}`; }
  if (noegle.endsWith('ankerarmeringForskydning')) { const [t, rest] = fra.split(':'); const [n, d] = rest!.split('×Ø'); return `${FORM_V[t as keyof typeof FORM_V]} ${n} Ø${d}`; }
  return ({ taet: 'tæt', nej: 'nej', uden: 'uden krog (l1 ≥ 10Ø)', ingen: 'ingen', udokumenteret: 'kantarmering uden dokumenteret a og Ø' } as Record<string, string>)[fra] ?? fra;
}

export function forudsaetning(b: ValgBeskrivelse): string {
  if (b.type !== 'premis') return '';
  return ({
    afskalning: 'stangafstand i forankringszonen ≥ 150 mm (≥ 100 mm ved Ø ≤ 10 mm), eller ingen armering i zonen (EN 1992-4, 7.2.1.4(5))',
    kantarmering: `kantstang Ø ≥ 12 mm med tætliggende bøjler eller net i højst a = ${b.data?.a} mm (a ≤ 100 mm og a ≤ 2c1, mindste c1 = ${dk(b.data?.c1 ?? 0)} mm), og hef ≥ 2,5·cnom. Du skal selv udføre og bekræfte det (EN 1992-4, 7.2.2.5)`,
    splitArmering: 'armering der begrænser revnevidden til wk ≤ 0,3 mm, og den kræves ført ud (EN 1992-4, 7.2.1.7(2)b)',
    krogT: 'armeringen udføres som bøjler/løkker med krog eller bøjning efter EN 1992-1-1, 8.3',
    krogV: 'armeringen udføres med krog eller bøjning efter EN 1992-1-1, 8.3',
  })[b.id];
}

export function aendringTekst(s: ForslagSpec, x: { v?: number; valg?: { beskrivelse: ValgBeskrivelse } }): string {
  if (s.art === 'tal') {
    const d = s.step < 1 ? 1 : 0, v = x.v!;
    return `${etiket(s.noegle)}: ${dk(s.v0, d)} → ${dk(v, d)} mm (+${dk(v - s.v0, d)} mm, +${dk(((v - s.v0) / s.v0) * 100)} %)`;
  }
  return `${etiket(s.noegle)}: ${fraTekst(s.noegle, s.fra)} → ${valgTekst(x.valg!.beskrivelse)}`;
}

export function hvorforTekst(kode: string): string {
  return kode.includes('ikke-virksom') ? 'Indtastet ankerarmering er ikke virksom.' : kode;
}
