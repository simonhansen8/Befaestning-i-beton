// Beregningen for én brudform vist trin for trin (formel, indsatte værdier, resultat). Ingen ny beregning:
// alle tal kommer fra kernens mellemresultater (KombinationsResultat.detaljer og brudformerne).
import type { Brudform, KombinationsResultat } from '../core/kombination';
import { SPORBARHED } from '../core/sporbarhed';
import { fckAf } from '../core/concrete';
import { BRUDFORM } from './render-tekster';

type Model = Record<string, any>;
export interface Trin { s: string; f?: string; v: string }
export interface Detalje { id: string; titel: string; ref: string; trin: Trin[]; noter: string[] }

const T = (v: unknown, d = 1): string => {
  if (typeof v !== 'number') return String(v ?? '–');
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
  return (+v.toFixed(d)).toString().replace('.', ',').replace('-', '−');
};
const kN = (v: number) => `${T(v / 1e3, 1)} kN`;
const mm = (v: number) => `${T(v, 1)} mm`;
const cm2 = (v: number) => `${T(v / 100, 0)} cm² (${T(v, 0)} mm²)`;
const t = (s: string, f: string | undefined, v: string): Trin => ({ s, f, v });

/** Fælles afslutning: karakteristisk → regningsmæssig kapacitet og udnyttelse. */
function afslut(b: Brudform, gammaNavn: string, gamma: number | null): Trin[] {
  const g = gamma ?? (b.Rd > 0 ? b.Rk / b.Rd : null);
  return [
    ...(b.Rk ? [t('Karakteristisk kapacitet', 'R<sub>k</sub>', kN(b.Rk))] : []),
    ...(g != null && b.Rk ? [t('Regningsmæssig kapacitet', `R<sub>d</sub> = R<sub>k</sub> / ${gammaNavn}, ${gammaNavn} = ${T(g, 2)}`, kN(b.Rd))] : b.Rd ? [t('Regningsmæssig kapacitet', 'R<sub>d</sub>', kN(b.Rd))] : []),
    ...(b.Ed ? [t('Regningsmæssig last', 'E<sub>d</sub>', kN(b.Ed))] : []),
    t('Udnyttelse', 'E<sub>d</sub> / R<sub>d</sub>', b.udnyttelse == null ? '–' : `${T(b.udnyttelse * 100, 1)} %`),
  ];
}

function kegleTrin(r: NonNullable<KombinationsResultat['detaljer']['N_c']>, fck: number, hef: number): Trin[] {
  const l: Trin[] = [
    t('Faktor k<sub>1</sub>', undefined, T(r.k1, 1)),
    t('Effektiv forankringsdybde', r.hefE < hef - 1e-9 ? "h'<sub>ef</sub> (smalt element, 7.2.1.4(2))" : 'h<sub>ef</sub>', mm(r.hefE)),
    t('Basiskapacitet', 'N<sup>0</sup><sub>Rk,c</sub> = k<sub>1</sub>·√f<sub>ck</sub>·h<sub>ef</sub><sup>1,5</sup>', `${T(r.k1, 1)}·√${T(fck, 0)}·${T(r.hefE, 0)}^1,5 = ${kN(r.N0)}`),
    t('Karakteristisk kantafstand / akseafstand', 'c<sub>cr,N</sub>, s<sub>cr,N</sub>', `${T(r.ccr, 0)} / ${T(r.scr, 0)} mm`),
    t('Projiceret areal (gruppe, afskåret af kanter)', 'A<sub>c,N</sub>', cm2(r.U.areal)),
    t('Referenceareal', 'A<sup>0</sup><sub>c,N</sub> = s<sub>cr,N</sub>²', cm2(r.A0)),
    t('Kantafstandsfaktor', 'ψ<sub>s,N</sub> (7.4) = min(1; 0,7 + 0,3·c/c<sub>cr,N</sub>), c = ' + (Number.isFinite(r.c) ? mm(r.c) : '∞'), T(r.pS, 3)),
    t('Afskalningsarmering', 'ψ<sub>re,N</sub> (7.5)', T(r.pRe, 3)),
    t('Excentricitet', 'ψ<sub>ec,N</sub> (7.6) = ψ<sub>ec,N,1</sub>·ψ<sub>ec,N,2</sub>', T(r.pEc, 3)),
    t('Trykzonefaktor', `ψ<sub>M,N</sub> (7.7) – ${r.pMgrund}`, T(r.pM, 3)),
  ];
  return l;
}

export function beregningsdetalje(id: string, m: Model, k: KombinationsResultat): Detalje | null {
  const b = k.brudformer.find((x) => x.id === id);
  if (!b) return null;
  const d = k.detaljer, g = d.gamma, fck = Math.min(fckAf(m.beton), 60), hef = m.anker.hef;
  const sp = SPORBARHED.find((x) => x.id === id);
  const ud: Detalje = { id, titel: `${id} ${BRUDFORM[id] ?? ''}`.trim(), ref: sp ? `EN 1992-4, ${sp.paragraf}` : '', trin: [], noter: [] };
  const a = ud.trin;
  const note = (s: string) => ud.noter.push(s);
  switch (id) {
    case 'N_s':
      a.push(t('Spændingsareal og brudstyrke', 'A<sub>s</sub>, f<sub>uk</sub>', `${T(d.N_s!.As, 1)} mm², ${T(d.N_s!.fuk, 0)} MPa`));
      a.push(t('Karakteristisk stålbrud', d.N_s!.eta != null ? 'N<sub>Rk,s</sub> = ETA-værdi' : 'N<sub>Rk,s</sub> = A<sub>s</sub>·f<sub>uk</sub> (7.1)', kN(b.Rk)));
      a.push(...afslut(b, 'γ<sub>Ms</sub>', g.Ms).slice(1));
      note('Eftervises for det mest belastede anker.');
      break;
    case 'N_p': {
      const bo = d.N_p?.bond;
      if (bo) {
        a.push(t('Vedhæftningsstyrke', 'τ<sub>Rk</sub>·ψ<sub>c</sub>', `${T(bo.tau, 2)} MPa`));
        a.push(t('Basiskapacitet', 'N<sup>0</sup><sub>Rk,p</sub> = ψ<sub>sus</sub>·τ·π·d·h<sub>ef</sub>', kN(bo.N0)));
        a.push(t('Akseafstand / kantafstand', 's<sub>cr,Np</sub> = min(7,3·d·√(ψ<sub>sus</sub>·τ<sub>Rk,ucr</sub>); 3·h<sub>ef</sub>), c<sub>cr,Np</sub> = s<sub>cr,Np</sub>/2', `${T(bo.scr, 0)} / ${T(bo.ccr, 0)} mm`));
        a.push(t('Projiceret areal / reference', 'A<sub>p,N</sub> / A<sup>0</sup><sub>p,N</sub>', `${cm2(bo.U.areal)} / ${cm2(bo.A0)}`));
        a.push(t('Gruppefaktor', `ψ<sub>g,Np</sub> (n = ${bo.n}, s = ${T(bo.s, 0)} mm; ψ⁰<sub>g,Np</sub> = ${T(bo.psi0g, 3)})`, T(bo.pG, 3)));
        a.push(t('Kantafstand / afskalning / excentricitet', 'ψ<sub>s,Np</sub>, ψ<sub>re,Np</sub>, ψ<sub>ec,Np</sub>', `${T(bo.pS, 3)}, ${T(bo.pRe, 3)}, ${T(bo.pEc, 3)}`));
        a.push(t('Langtidslast', 'ψ<sub>sus</sub>', T(bo.psiSus, 3)));
        a.push(...afslut(b, 'γ<sub>Mp</sub>', g.Mp));
      } else {
        const p = d.N_p!;
        a.push(t('Hovedareal (ankerhoved)', 'A<sub>h</sub>', mm(p.ah!).replace('mm', 'mm²')));
        a.push(t('Faktor', `k<sub>2</sub> (${m.beton.revnet ? 'revnet' : 'urevnet'} beton)`, T(p.k2, 1)));
        a.push(t('Karakteristisk udtrækning', 'N<sub>Rk,p</sub> = k<sub>2</sub>·A<sub>h</sub>·f<sub>ck</sub> (7.12)', `${T(p.k2, 1)}·${T(p.ah!, 0)}·${T(fck, 0)} = ${kN(b.Rk)}`));
        a.push(...afslut(b, 'γ<sub>Mp</sub>', g.Mp).slice(1));
      }
      break;
    }
    case 'N_c':
      if (d.N_c) { a.push(...kegleTrin(d.N_c, fck, hef)); a.push(t('Karakteristisk betonkegle', 'N<sub>Rk,c</sub> = N<sup>0</sup><sub>Rk,c</sub>·A<sub>c,N</sub>/A<sup>0</sup><sub>c,N</sub>·ψ<sub>s</sub>·ψ<sub>re</sub>·ψ<sub>ec</sub>·ψ<sub>M</sub>', kN(d.N_c.NRk))); }
      a.push(...afslut(b, 'γ<sub>Mc</sub>', g.Mc).slice(1));
      if (d.N_c?.smal) note(`Smalt element: h'ef = max(c<sub>max</sub>/c<sub>cr,N</sub>·h<sub>ef</sub>; s<sub>max</sub>/s<sub>cr,N</sub>·h<sub>ef</sub>) (c<sub>max</sub> = ${T(d.N_c.smal.cmax, 0)}, s<sub>max</sub> = ${T(d.N_c.smal.smax, 0)} mm).`);
      break;
    case 'N_sp': {
      const s = d.N_sp;
      if (s) {
        a.push(t('Basiskapacitet', 'N<sup>0</sup><sub>Rk,sp</sub> = min(N<sub>Rk,p</sub>; N<sup>0</sup><sub>Rk,c</sub>)', `min(${kN(s.N0p)}; ${kN(s.N0c)}) = ${kN(s.N0)}`));
        a.push(t('Karakteristisk kantafstand / akseafstand', `c<sub>cr,sp</sub> (${s.kildeC}), s<sub>cr,sp</sub> = 2·c<sub>cr,sp</sub>`, `${T(s.ccrSp, 0)} / ${T(s.scrSp, 0)} mm`));
        a.push(t('Mindste elementtykkelse', `h<sub>min</sub> (${s.kildeH})`, mm(s.hmin)));
        a.push(t('Projiceret areal / reference', 'A<sub>c,N</sub> / A<sup>0</sup><sub>c,N</sub> = s<sub>cr,sp</sub>²', `${cm2(s.U.areal)} / ${cm2(s.A0)}`));
        a.push(t('Kantafstand, afskalning, excentricitet', 'ψ<sub>s,N</sub>, ψ<sub>re,N</sub>, ψ<sub>ec,N,1</sub>·ψ<sub>ec,N,2</sub>', `${T(s.pS, 3)}, ${T(s.pRe, 3)}, ${T(s.pEc1 * s.pEc2, 3)}`));
        a.push(t('Elementhøjde', 'ψ<sub>h,sp</sub> = min((h/h<sub>min</sub>)<sup>2/3</sup>; ((h<sub>ef</sub>+1,5c)/h<sub>min</sub>)<sup>2/3</sup>; 2)', T(s.psiH, 3)));
        a.push(...afslut(b, 'γ<sub>Msp</sub>', g.Msp));
      }
      if (sp?.forbehold.length) note('Åbent forbehold: ' + sp.forbehold.join('; ') + '.');
      break;
    }
    case 'N_cb': {
      const s = d.N_cb;
      if (s) {
        a.push(t('Kant og kantafstand', 'c<sub>1</sub>', `${s.kant}, ${mm(s.c1)}`));
        a.push(t('Ankre i gruppen / største akseafstand', 'n, s<sub>2</sub>', `${s.n} / ${mm(s.s2)}`));
        a.push(t('Basiskapacitet', 'N<sup>0</sup><sub>Rk,cb</sub> = k<sub>5</sub>·c<sub>1</sub>·√A<sub>h</sub>·√f<sub>ck</sub>', kN(s.N0)));
        a.push(t('Projiceret areal / reference', 'A<sub>c,Nb</sub> = L<sub>b</sub>·H<sub>b</sub> / (4c<sub>1</sub>)²', `${cm2(s.Ac)} (${T(s.Lb, 0)} × ${T(s.Hb, 0)}) / ${cm2(s.A0)}`));
        a.push(t('Faktorer', `ψ<sub>s,Nb</sub> (c<sub>2</sub> = ${T(s.c2, 0)}), ψ<sub>g,Nb</sub>, ψ<sub>ec,Nb</sub> (e = ${T(s.eN, 0)})`, `${T(s.pS, 3)}, ${T(s.pG, 3)}, ${T(s.pEc, 3)}`));
        a.push(...afslut(b, 'γ<sub>Mc</sub>', g.Mc));
      }
      break;
    }
    case 'N_re': case 'N_a': case 'N_cre': {
      const at = m.beton.armering.ankerarmeringTraek, ar = k.armT;
      a.push(t('Stangdiameter, antal bøjler, ben', '⌀, n<sub>b</sub>, n = 2·n<sub>b</sub>', `${T(at.diameter, 0)} mm, ${at.antalBoejler}, ${ar.ben}`));
      a.push(t('Benenes afstand til ankeret', `√(x² + e²), x = ${T(at.afstand, 0)} mm (grænse 0,75·h<sub>ef</sub> = ${T(0.75 * hef, 0)} mm)`, mm(ar.rad)));
      a.push(t('Forankringslængde i brudkeglen pr. bøjle', 'l<sub>1</sub> = h<sub>ef</sub> − tan35°·afstand − c<sub>top</sub> − (j−1)(⌀+1); krav ≥ ' + T(ar.l1min, 0) + ' mm', ar.l1Liste.map((v) => T(v, 0)).join(' / ') + ' mm'));
      if (id === 'N_re') a.push(t('Flydning', 'N<sub>Rk,re</sub> = n·A<sub>s</sub>·f<sub>yk</sub>', `${ar.ben}·${T(Math.PI / 4 * at.diameter ** 2, 1)}·${T(at.fyk, 0)} = ${kN(b.Rk)}`));
      if (id === 'N_a') a.push(t('Forankring i brudkeglen', 'N<sub>Rd,a</sub> = 2·Σ min(l<sub>1</sub>·π·⌀·f<sub>bd</sub>/α; A<sub>s</sub>·f<sub>yk</sub>/γ<sub>Ms,re</sub>)', kN(b.Rd)));
      if (id === 'N_cre') a.push(t('Betonkegle ved armeringens ende', "N<sub>Rk,c,re</sub> med h'<sub>ef,re</sub> = " + (at.forankringsdybde ?? hef) + ' mm', kN(b.Rk)));
      a.push(...afslut(b, id === 'N_cre' ? 'γ<sub>Mc</sub>' : 'γ<sub>Ms,re</sub>', id === 'N_a' ? null : id === 'N_cre' ? g.Mc : g.MsRe).slice(id === 'N_a' ? 0 : 1));
      break;
    }
    case 'V_s': {
      const s = d.V_s!;
      a.push(t('Spændingsareal og brudstyrke', 'A<sub>s</sub>, f<sub>uk</sub>', `${T(s.As, 1)} mm², ${T(s.fuk, 0)} MPa`));
      a.push(t('Udførelse', undefined, s.loeftestang ? 'Med løftestang (7.2.2.3.2): V<sub>Rk,s</sub> = α<sub>M</sub>·M<sub>Rk,s</sub>/l, M<sub>Rk,s</sub> reduceret for samtidig træk' : 'Uden løftestang (7.2.2.3.1): V<sub>Rk,s</sub> = k<sub>7</sub>·k<sub>6</sub>·A<sub>s</sub>·f<sub>uk</sub>'));
      a.push(...afslut(b, 'γ<sub>Ms,V</sub>', g.MsV));
      break;
    }
    case 'V_cp': {
      const s = d.V_cp;
      if (s?.kegle) a.push(...kegleTrin(s.kegle, fck, hef).filter((x) => !x.s.startsWith('Trykzone')));
      a.push(t('Pry-out faktor', 'k<sub>8</sub>', T(s?.k8, 1)));
      a.push(t('Karakteristisk pry-out', 'V<sub>Rk,cp</sub> = k<sub>8</sub>·N<sub>Rk,c</sub>' + (k.armV.virksom || k.armT.virksom ? '·0,75 (virksom ankerarmering)' : ''), kN(b.Rk)));
      a.push(...afslut(b, 'γ<sub>Mc,V</sub>', g.McV).slice(1));
      if (s?.enkeltStyrer) note('Et enkelt anker i gruppen er styrende for pry-out (ikke gruppen som helhed).');
      break;
    }
    case 'V_c': {
      const q = k.kantbrud.styrende;
      if (q) {
        const R = q.R;
        a.push(t('Kant og afstand', 'c<sub>1</sub>' + (R.smal ? ` (smalt element, oprindeligt ${T(R.c1org ?? R.c1, 0)} mm)` : ''), `${q.kant}, ${mm(R.c1)}`));
        a.push(t('Forskydning vinkelret / parallelt med kanten', 'V<sub>⊥</sub>, V<sub>∥</sub>; α<sub>V</sub> = ' + T((q.alphaV * 180) / Math.PI, 1) + '°', `${kN(q.Vperp)}, ${kN(q.Vpar)}`));
        a.push(t('Basiskapacitet', 'V<sup>0</sup><sub>Rk,c</sub> = k<sub>9</sub>·d<sub>nom</sub><sup>α</sup>·l<sub>f</sub><sup>β</sup>·√f<sub>ck</sub>·c<sub>1</sub><sup>1,5</sup>', `${T(R.k9, 1)}·${T(m.anker.dnom ?? m.anker.d, 0)}^${T(R.alpha, 3)}·${T(R.lf, 0)}^${T(R.beta, 3)}·√${T(fck, 0)}·${T(R.c1, 0)}^1,5 = ${kN(R.V0)}`));
        a.push(t('Projiceret areal / reference', 'A<sub>c,V</sub> = L<sub>v</sub>·H<sub>v</sub> / A<sup>0</sup><sub>c,V</sub> = 4,5·c<sub>1</sub>²', `${cm2(R.Ac)} (${T(R.Lv, 0)} × ${T(R.Hv, 0)}) / ${cm2(R.A0)}`));
        a.push(t('Sidekant og elementtykkelse', 'ψ<sub>s,V</sub>, ψ<sub>h,V</sub>', `${T(R.pS, 3)}, ${T(R.pH, 3)}`));
        a.push(t('Excentricitet, vinkel, kantarmering, 0,8-reduktion', 'ψ<sub>ec,V</sub>, ψ<sub>α,V</sub>, ψ<sub>re,V</sub>, f<sub>0,8</sub>', `${T(q.psiEc, 3)}, ${T(q.psiA, 3)}, ${T(q.psiRe, 3)}, ${T(q.f08, 2)}`));
        a.push(...afslut(b, 'γ<sub>Mc,V</sub>', g.McV));
        if (m.beton.armering.ankerarmeringForskydning?.aktiv && k.armV.virksom) note('Forskydningsarmeringen erstatter kantbrud mod den armerede kant; øvrige kanter vises her.');
      }
      break;
    }
    case 'V_re': case 'V_a': {
      const av = m.beton.armering.ankerarmeringForskydning, ar = k.armV;
      a.push(t('Udformning, stangdiameter, virksomme ben pr. anker', 'k<sub>10</sub>' + (ar.form === 'overflade' ? ' = 1,0' : ' = 0,5'), `${ar.form}, ⌀${T(av.diameter, 0)} mm, ${ar.antalVirksomme}`));
      if (ar.staenger) a.push(t('Stænger (lateral afstand v, l<sub>1</sub>)', '|v| ≤ 0,75·c<sub>1</sub>, l<sub>1</sub> = c<sub>1</sub> − √(v²+z<sub>s</sub>²)/1,5 − c<sub>nom</sub>', ar.staenger.map((s) => `${T(s.v, 0)}: ${T(s.l1, 0)}${s.virksom ? '' : ' ✗'}`).join('; ') + ' mm'));
      a.push(t('Last på armeringen', 'N<sub>Ed,re</sub> = (e<sub>s</sub>/z + 1)·V<sub>Ed</sub> (Fig. 6.8)', kN(b.Ed)));
      a.push(id === 'V_re'
        ? t('Flydning', 'N<sub>Rk,re</sub> = k<sub>10</sub>·n·A<sub>s</sub>·f<sub>yk</sub>', kN(b.Rk))
        : t('Forankring i brudprismet', 'N<sub>Rd,a</sub> = Σ min(l<sub>1</sub>·π·⌀·f<sub>bd</sub>/α; A<sub>s</sub>·f<sub>yk</sub>/γ<sub>Ms,re</sub>)', kN(b.Rd)));
      a.push(...afslut(b, 'γ<sub>Ms,re</sub>', id === 'V_re' ? g.MsRe : null).slice(id === 'V_re' ? 1 : 2));
      break;
    }
    case 'NV_s': {
      const s = d.NV_s!;
      a.push(t('Udnyttelse træk / forskydning (stål)', 'β<sub>N</sub> = N<sub>Ed</sub>/N<sub>Rd,s</sub>, β<sub>V</sub> = V<sub>Ed</sub>/V<sub>Rd,s</sub>', `${T(s.betaN, 3)}, ${T(s.betaV, 3)}`));
      a.push(t('Interaktion', 'β<sub>N</sub>² + β<sub>V</sub>² ≤ 1 (7.54)', `${T(s.betaN ** 2 + s.betaV ** 2, 3)}`));
      a.push(t('Udnyttelse', undefined, b.udnyttelse == null ? '–' : `${T(b.udnyttelse * 100, 1)} %`));
      break;
    }
    case 'NV_c': case 'NV_re': {
      const s = d.NV!;
      a.push(t('Største udnyttelse, træk', `β<sub>N</sub> (${s.styrendeTraek ?? '–'})`, T(s.betaN, 3)));
      a.push(t('Største udnyttelse, forskydning', `β<sub>V</sub> (${s.styrendeForskydning ?? '–'})`, T(s.betaV, 3)));
      if (id === 'NV_c' || s.I755 != null) {
        a.push(t('Potensformel', 'β<sub>N</sub><sup>1,5</sup> + β<sub>V</sub><sup>1,5</sup> ≤ 1 (7.55)', T(s.I755, 3)));
        a.push(t('Lineær formel', '(β<sub>N</sub> + β<sub>V</sub>)/1,2 ≤ 1 (7.56)', T(s.I756, 3)));
        a.push(t('Anvendt', s.ligning, b.udnyttelse == null ? '–' : `${T(b.udnyttelse * 100, 1)} %`));
      } else {
        a.push(t('Med ankerarmering', `β<sub>N</sub><sup>k11</sup> + β<sub>V</sub><sup>k11</sup> ≤ 1 (7.57), k<sub>11</sub> = ${T(s.k11, 2)}`, b.udnyttelse == null ? '–' : `${T(b.udnyttelse * 100, 1)} %`));
      }
      break;
    }
    default:
      a.push(...afslut(b, 'γ', null));
  }
  if (sp && id !== 'N_sp' && sp.forbehold.length) note('Åbne forbehold (docs/kritiske-fund.md): ' + sp.forbehold.join('; ') + '.');
  return ud;
}
