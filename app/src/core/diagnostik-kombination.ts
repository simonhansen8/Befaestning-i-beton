// Diagnostik for én lastkombination, afledt af kerneresultatet (ingen tekst).
import { diag, EN, type Diagnostik } from './diagnostik';
import type { KombinationsResultat, Kernemodel } from './kombination';
import type { Indstillinger } from './settings';
import type { Last } from './loads';

export function diagnostikKombination(
  m: Kernemodel & { beton: { fck?: number | null; klasse?: string | null } }, ind: Indstillinger, r: KombinationsResultat, fck: number, alphaSus: number,
): Diagnostik[] {
  const e: Diagnostik[] = [];
  const f = r.fordeling, t = r.traek;
  if (!f.konvergeret) e.push(diag('fejl', 'lastfordeling-ikke-konvergeret', EN('6.2.1'), null, { residual: f.residual }));
  const svage = t.traekAnkre.filter((_a, i) => t.kraefter[i]! < 0.05 * t.NEd_h);
  if (svage.length) e.push(diag('info', 'ankre-med-lille-traek', EN('6.2.1(3)'), null, { ankre: svage.map((a) => a.id).join(', ') }));
  if (f.C > 0) {
    const fcd = fck / ind.gammaC;
    if (f.sigmaMaks > 3 * fcd) e.push(diag('advarsel', 'betontryk-over-3fcd', 'EN 1992-1-1, 6.7', null, { sigma: f.sigmaMaks, grænse: 3 * fcd }));
    else e.push(diag('info', 'trykzone', EN('6.2.1'), null, { C: f.C, sigma: f.sigmaMaks }));
  }
  if (!r.forskydning.mulig) e.push(diag('fejl', 'forskydning-kan-ikke-optages', EN('6.2.2'), null));
  if (r.loeftestang) e.push(diag('info', 'loeftestang', EN('6.2.2.3'), 'plade.afstandTilBeton', { alphaM: m.plade.indspaending === 'fuld' ? 2 : 1 }));
  if (m.anker.type === 'indlimet' && t.NEd_g > 0 && alphaSus > m.anker.psi0Sus) e.push(diag('info', 'alpha-sus-over-psi0', EN('7.2.1.6'), null, { alphaSus, psi0Sus: m.anker.psi0Sus }));
  const at = r.armT;
  if (at.aktiv && !at.virksom) e.push(diag('fejl', 'ankerarmering-traek-ikke-virksom', EN('7.2.1.9'), 'beton.armering.ankerarmeringTraek.aktiv', { mangler: at.mangler.join(', ') }));
  if (at.aktiv && at.rad <= 0.75 * m.anker.hef && at.ikkeVirksomme > 0 && at.ikkeVirksomme < at.antalBoejler) e.push(diag('info', 'ankerarmering-boejler-for-dybt', EN('7.2.1.2(2)d'), null, { antal: at.ikkeVirksomme, af: at.antalBoejler }));
  if (r.staalForskydningAarsag === 'fuk-over-1000') e.push(diag('fejl', 'fuk-over-1000-forskydning', EN('7.2.2.3.1'), null));
  if (r.spaltningAarsag === 'revnebegraensende-armering') e.push(diag('info', 'spaltning-udeladt-armering', EN('7.2.1.7 (2) b'), null));
  const kb = r.kantbrud;
  for (const k of kb.forFjerne) e.push(diag('info', 'kantbrud-kant-for-fjern', EN('6.2.2.2 (1)'), null, { kant: k }));
  if (m.anker.dnom != null && m.anker.dnom > 60 && Object.keys(kb.kanterPr).length) e.push(diag('advarsel', 'dnom-over-60-kantbrud', EN('7.2.2.5'), null, { dnom: m.anker.dnom }));
  const av = r.armV, angivet = m.beton.armering.ankerarmeringForskydning.kant;
  if (av.aktiv && angivet && !r.armKant && kb.styrende) e.push(diag('info', 'forskydningsarmering-kant-ikke-belastet', EN('7.2.2.6'), null, { kant: angivet }));
  if (av.aktiv && !av.virksom && r.armKant) e.push(diag('fejl', 'ankerarmering-forskydning-ikke-virksom', EN('7.2.2.6'), 'beton.armering.ankerarmeringForskydning.aktiv', { mangler: av.mangler.join(', ') }));
  if (av.virksom && r.armKant) {
    const andre = Object.keys(kb.kanterPr).filter((k) => k !== r.armKant!.kant);
    if (andre.length) e.push(diag('info', 'forskydningsarmering-daekker-kun-en-kant', EN('7.2.2.6'), null, { kanter: andre.join(', ') }));
  }
  if (av.aktiv && av.form === 'overflade' && r.armKant && av.staenger) {
    const ikkeVirk = av.staenger.filter((s) => !s.virksom);
    if (ikkeVirk.length) e.push(diag('info', 'overfladearmering-staenger-ikke-virksomme', EN('7.2.2.2(3)c–d'), null, { antal: ikkeVirk.length, af: av.staenger.length }));
  }
  return e;
}
export type { Last };

/** Oplysning når forskydningsarmeringens kant er valgt automatisk (mest udnyttede kant uden armering). */
export const diagnostikValgtArmeringskant = (v: { kant: string; kombinationIndex: number }): Diagnostik =>
  diag('info', 'forskydningsarmering-kant-valgt-automatisk', EN('7.2.2.2(1)'), null, { kant: v.kant, kombination: v.kombinationIndex });
