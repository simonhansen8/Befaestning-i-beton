// Rapport: selvstændigt HTML-dokument til udskrift/PDF. Inddata afledes af felt-skemaet (altid i takt med formularen),
// resultater og bemærkninger kommer fra beregningen. Ren funktion; al brugertekst escapes.
import type { ProjektResultat } from '../core/beregn';
import type { KombinationsResultat } from '../core/kombination';
import { SPORBARHED } from '../core/sporbarhed';
import { PLAN_FORKLARING, plantegningSvg } from './plantegning';
import { snitSvg } from './snit';
import { KANTFELTER, SEKTIONER } from './felter';
import { BRUDFORM } from './render-tekster';
import type { FeltDef, Model } from './skema-typer';
import { tekst } from './tekster';
import { laesSti, visFelt } from './vaerdi';

export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const dk = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',').replace('-', '−') : '∞');
const proc = (u: number | null | undefined) => (u == null ? '–' : Number.isFinite(u) ? `${(u * 100).toFixed(u < 0.995 ? 0 : 1).replace('.', ',')} %` : '∞');
/** Etiketter i skemaet indeholder <sub>; fjern øvrige tags for sikkerheds skyld. */
const sub = (s: string) => s.replace(/<(?!\/?sub>)[^>]*>/g, '');

function inddataTabeller(m: Model): string {
  const ud: string[] = [];
  for (const s of SEKTIONER) {
    if (s.custom === 'layout') {
      ud.push(`<h3>${esc(s.title)}</h3><table><tr><th>Bolt</th><th>x [mm]</th><th>y [mm]</th><th>Slids</th></tr>${m.opstilling.anker.map((a: any) => `<tr><td>${esc(a.id)}</td><td>${dk(a.x, 0)}</td><td>${dk(a.y, 0)}</td><td>${esc(a.slids ?? '–')}</td></tr>`).join('')}</table>`);
      continue;
    }
    if (s.custom === 'loads') {
      ud.push(`<h3>${esc(s.title)} (designværdier inkl. K<sub>FI</sub>)</h3><table><tr><th>Navn</th><th>N [kN]</th><th>V<sub>x</sub> [kN]</th><th>V<sub>y</sub> [kN]</th><th>M<sub>x</sub> [kNm]</th><th>M<sub>y</sub> [kNm]</th><th>T [kNm]</th><th>α<sub>sus</sub></th></tr>${m.laster.map((l: any) => `<tr><td>${esc(l.navn)}</td><td>${dk(l.N / 1e3)}</td><td>${dk(l.Vx / 1e3)}</td><td>${dk(l.Vy / 1e3)}</td><td>${dk(l.Mx / 1e6, 2)}</td><td>${dk(l.My / 1e6, 2)}</td><td>${dk(l.T / 1e6, 2)}</td><td>${l.alphaSus == null ? 'std.' : dk(l.alphaSus, 2)}</td></tr>`).join('')}</table>`);
      continue;
    }
    const felter = [...((s.fields ?? []).filter((f): f is FeltDef => 'k' in f)), ...(s.id === 'beton' ? KANTFELTER : [])]
      .filter((f) => (!f.show || f.show(m)) && !f.adv);
    const rk = felter.map((f) => {
      const v = laesSti(m, f.k);
      const vis = f.type === 'switch' ? (v ? 'ja' : 'nej') : f.options ? (f.options.find(([ov]) => ov === v || (v == null && ov === ''))?.[1] ?? String(v ?? '')) : v == null ? (f.std ? f.std(m) : '–') : visFelt(f, v);
      return `<tr><td>${sub(f.sym)}</td><td>${sub(f.lbl)}</td><td class="t">${esc(vis)}</td><td>${sub(f.unit ?? '')}</td><td class="ref">${esc(f.ref)}</td></tr>`;
    });
    if (rk.length) ud.push(`<h3>${esc(s.title)}</h3><table class="inddata">${rk.join('')}</table>`);
  }
  return ud.join('\n');
}

/** Beregningsspor pr. brudform (samme form som brud-detaljer.ts): trin med beskrivelse, formel og indsatte værdier (HTML-strenge). */
export interface RapportTrin { s: string; f?: string; v: string }
export interface RapportDetalje { id: string; titel: string; ref: string; trin: RapportTrin[]; noter: string[] }
export interface RapportValg {
  /** Medtag ligninger (formler, normhenvisninger og indsatte værdier) pr. brudform for hver lastkombination. */
  ligninger?: boolean;
  /** Leverer beregningssporet; uden den kan ligninger ikke medtages. */
  detalje?: (id: string, m: Model, k: KombinationsResultat) => RapportDetalje | null;
}

const KLASSE = (u: number | null | undefined) => (u == null || !Number.isFinite(u) ? (u === Infinity ? 'bad' : 'na') : u > 1 ? 'bad' : u > 0.8 ? 'warn' : 'ok');
const bar = (u: number | null | undefined) => (u == null ? '' : `<span class="bar ${KLASSE(u)}"><i style="width:${Math.min(100, Math.max(0, Number.isFinite(u) ? u * 100 : 100) / 1.25).toFixed(0)}%"></i></span>`);
const kn = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) || v === 0 ? '–' : dk(v / 1e3, d));
const norm = (id: string) => 'EN 1992-4, ' + (SPORBARHED.find((x) => x.id === id)?.paragraf ?? '');
const ankerListe = (a: number | number[] | null | undefined, m: Model) => {
  const ids = m.opstilling.anker.map((x: any) => x.id);
  const l = Array.isArray(a) ? a : a == null ? [] : [a];
  return l.map((i) => ids[i - 1] ?? i).join(', ');
};

const CSS = `
:root{--ink:#14202a;--ink2:#4a5863;--ink3:#7b8791;--rule:#d5dbe0;--rule2:#e8ecef;--accent:#1b5fd0;--ok:#1b7a3d;--okbg:#e6f4ea;--warn:#a15c00;--warnbg:#fdf1dc;--bad:#b42318;--badbg:#fbe9e7}
*{box-sizing:border-box}
html{background:#e7eaec}
body{margin:0;font:10pt/1.42 "Segoe UI",system-ui,-apple-system,Helvetica,Arial,sans-serif;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.side{max-width:210mm;margin:16px auto;background:#fff;padding:18mm 16mm 16mm;box-shadow:0 1px 6px rgba(0,0,0,.18)}
.vaerktoej{max-width:210mm;margin:12px auto 0;display:flex;justify-content:flex-end;gap:8px}
.vaerktoej button{font:inherit;padding:6px 14px;border-radius:6px;border:1px solid #1a2228;background:#1a2228;color:#fff;cursor:pointer}
header.top{display:flex;justify-content:space-between;align-items:flex-end;gap:12mm;border-bottom:2px solid var(--ink);padding-bottom:5pt}
h1{font-size:18pt;line-height:1.2;margin:0;font-weight:650}
.norm{color:var(--ink2);font-size:9.5pt;margin-top:2pt}
.build{color:var(--ink3);font-size:8.5pt;text-align:right;white-space:nowrap}
h2{font-size:12.5pt;margin:20pt 0 6pt;padding-bottom:2pt;border-bottom:1px solid var(--ink);font-weight:650;break-after:avoid}
h3{font-size:10.5pt;margin:12pt 0 3pt;font-weight:650;break-after:avoid}
h3.fl{display:flex;justify-content:space-between;align-items:baseline;gap:10pt}
h3 .u{font-variant-numeric:tabular-nums}
h3 small{font-weight:400;color:var(--ink3);font-size:8.5pt}
table{border-collapse:collapse;width:100%;margin:3pt 0 6pt;font-size:9pt}
th,td{padding:2.2pt 5pt;border-bottom:1px solid var(--rule2);text-align:left;vertical-align:top}
th{font-weight:500;color:var(--ink3);border-bottom:1px solid var(--rule)}
thead th{font-size:8.5pt}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tr{break-inside:avoid}
.meta{width:100%;margin:8pt 0 0;table-layout:fixed}.meta th{width:17%;white-space:nowrap}.meta td{width:33%}
.urgent{font-weight:700}
.dom{display:flex;gap:10pt;align-items:center;margin:10pt 0 4pt;padding:8pt 11pt;border-radius:4pt;border-left:5pt solid}
.dom.ok{background:var(--okbg);border-color:var(--ok)}.dom.bad{background:var(--badbg);border-color:var(--bad)}
.dom .stor{font-size:15pt;font-weight:750;letter-spacing:.02em;white-space:nowrap}.dom.ok .stor{color:var(--ok)}.dom.bad .stor{color:var(--bad)}
.dom .tekst{flex:1}.dom .tekst b{font-weight:650}
.note{margin:6pt 0;padding:5pt 9pt;background:var(--warnbg);font-size:9pt;border-radius:3pt}
.ok{color:var(--ok)}.warn{color:var(--warn)}.bad{color:var(--bad)}.na{color:var(--ink3)}
.mx td.n{font-weight:600}.mx td.ok,.mx td.warn,.mx td.bad{font-weight:650}
.mx tr.tot td{border-top:1.5px solid var(--ink);font-weight:700}
.mx th.gov{color:var(--ink);box-shadow:inset 0 -2px 0 var(--accent)}
.mx td.mxv{background:var(--rule2)}
.bar{display:inline-block;width:46pt;height:5pt;border-radius:3pt;background:var(--rule2);vertical-align:middle;margin-left:5pt;position:relative;overflow:hidden}
.bar i{position:absolute;left:0;top:0;bottom:0;border-radius:3pt}.bar.ok i{background:#3a9a5c}.bar.warn i{background:#d79a1d}.bar.bad i{background:#d0453a}
.bar:after{content:"";position:absolute;left:80%;top:0;bottom:0;width:.6pt;background:var(--ink3)}
tr.styrende td{font-weight:650}tr.styrende td:first-child{box-shadow:inset 3px 0 0 var(--accent)}
tr.ikke td{color:var(--ink3)}
.kref{color:var(--ink3);font-size:8pt;white-space:nowrap}
code,.id{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:8.5pt;color:var(--ink2)}
.inddata td:first-child{width:11%}.inddata td.t{font-weight:600;text-align:right;white-space:nowrap}.inddata td:nth-child(4){color:var(--ink3);width:8%}.inddata td.ref{color:var(--ink3);font-size:8pt;width:24%}
.fig{display:flex;gap:6mm;align-items:flex-start;margin:6pt 0;break-inside:avoid}
.fig figure{margin:0;flex:1;min-width:0}
.fig svg,.smaa svg{width:100%;height:auto;color:var(--ink);--card:#fff;--accent:#1b5fd0;--warn:#c98a00;--err:#c62d20;--ink:#14202a;--ink-2:#4a5863;--ink-3:#7b8791;--rule:#d5dbe0}
figcaption{color:var(--ink3);font-size:8.5pt;margin-top:2pt}
.smaa{display:grid;grid-template-columns:repeat(2,1fr);gap:5mm;margin-top:4pt}.smaa figure{margin:0;break-inside:avoid}
.st td:nth-child(1){width:34%;color:var(--ink2)}.st td:nth-child(3){text-align:right;font-weight:600}
.st .f{font-family:"Cambria Math","STIX Two Math",Cambria,Georgia,serif;font-size:9.5pt}
.ligning{margin:2pt 0 8pt;break-inside:auto}.ligning .noter{color:var(--ink3);font-size:8.5pt;margin:0 0 4pt}
.forb h4{margin:8pt 0 2pt;font-size:9.5pt}.forb ul,ul.dok{margin:0;padding-left:16pt}.forb li,ul.dok li{margin:1.5pt 0}
li.fejl{color:var(--bad)}li.advarsel{color:var(--warn)}li.info{color:var(--ink)}
.toc{margin:12pt 0 0;padding:6pt 10pt;border:1px solid var(--rule);border-radius:4pt;font-size:9pt;break-inside:avoid}
.toc h2.tochead{font-size:10.5pt;margin:0 0 3pt;border:0}.toc ol{margin:0;padding-left:16pt}.toc ul{margin:1pt 0 3pt;padding-left:14pt;list-style:none}.toc li{margin:1pt 0}
.toc .bf{display:block;color:var(--ink3);font-size:8pt;padding-left:8pt}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
a.lnk{color:inherit}a.lnk:hover{color:var(--accent);text-decoration:underline}
h2 .op,.vaerktoej+.side .op{float:right;font-size:8pt;font-weight:400}
h2,h3,tr,.ligning{scroll-margin-top:12px}
html{scroll-behavior:smooth}
.under{margin-top:18pt;padding-top:5pt;border-top:1px solid var(--rule);color:var(--ink3);font-size:8pt;display:flex;justify-content:space-between}
@page{size:A4;margin:15mm 14mm 16mm;@bottom-left{content:"${'${FODTEKST}'}";font:8pt system-ui,sans-serif;color:#7b8791}@bottom-right{content:"Side " counter(page) " af " counter(pages);font:8pt system-ui,sans-serif;color:#7b8791}}
@media print{html{background:#fff}h2 .op{display:none}a{color:inherit}.side{box-shadow:none;margin:0;padding:0;max-width:none}.vaerktoej{display:none}h2{break-after:avoid}}
@media (max-width:700px){.side{padding:12px}header.top{flex-direction:column;align-items:flex-start}.fig{flex-direction:column}.smaa{grid-template-columns:1fr}}
`;

export function rapportHtml(m: Model, r: ProjektResultat | null, build: string, dato = new Date().toISOString().slice(0, 10), valg: RapportValg = {}): string {
  const p = m.projekt ?? {};
  const k = r ? r.kombinationer : [];
  const gk = r?.styrendeKombination ?? 0;
  const g = k[gk];
  const indlimet = (m.anker as any)?.type === 'indlimet';
  const titel = `Eftervisning af ${indlimet ? 'indlimede bolte' : 'indstøbte bolte med hoved'}`;
  const medLigninger = !!(valg.ligninger && valg.detalje);
  const navn = (id: string) => BRUDFORM[id] ?? id;
  let nr = 0;
  /* Indholdsfortegnelse: overskrifter og brudformer er klikbare (også som links i PDF-udskrift). */
  const toc: { id: string; t: string; sub?: { id: string; t: string; sub?: { id: string; t: string }[] }[] }[] = [];
  const h2 = (t: string, id: string, plain = t) => { toc.push({ id, t: `${nr + 1}. ${plain}` }); return `<h2 id="${id}">${++nr}. ${t}<a class="op" href="#indhold" title="Til indholdsfortegnelsen">↑ indhold</a></h2>`; };
  const bfId = (ci: number, id: string) => `bf-${ci}-${id.replace(/[^\w-]/g, '_')}`;

  /* 1. Resultat */
  const rel = (c: NonNullable<typeof g>) => c.resultat.brudformer.filter((b) => b.relevant);
  const alleId = r ? [...new Set(k.flatMap((c) => rel(c).map((b) => b.id)))] : [];
  const matrix = r && k.length
    ? `<table class="mx"><thead><tr><th>Brudform</th><th>Norm</th>${k.map((c, i) => `<th class="n${i === gk ? ' gov' : ''}">${esc(c.navn)}</th>`).join('')}<th class="n">maks.</th></tr></thead><tbody>${alleId.map((id) => {
      const us = k.map((c) => { const b = c.resultat.brudformer.find((x) => x.id === id); return b && b.relevant ? b.udnyttelse : null; });
      const mx = Math.max(-1, ...us.filter((u): u is number => u != null));
      return `<tr><td><a class="lnk" href="#${bfId(Math.max(0, us.findIndex((u) => u === mx)), id)}"><span class="id">${esc(id)}</span> ${esc(navn(id))}</a></td><td class="kref">${esc(norm(id).replace('EN 1992-4, ', ''))}</td>${us.map((u) => `<td class="n ${KLASSE(u)}${u != null && u === mx ? ' mxv' : ''}">${u == null ? '–' : proc(u)}</td>`).join('')}<td class="n ${mx < 0 ? 'na' : KLASSE(mx)}"><b>${mx < 0 ? '–' : proc(mx)}</b>${mx < 0 ? '' : bar(mx)}</td></tr>`;
    }).join('')}<tr class="tot"><td colspan="2">η<sub>maks</sub> pr. lastkombination</td>${k.map((c) => `<td class="n ${KLASSE(c.maksUdnyttelse)}">${proc(c.maksUdnyttelse)}</td>`).join('')}<td class="n ${KLASSE(r.maksUdnyttelse)}">${proc(r.maksUdnyttelse)}</td></tr></tbody></table>`
    : '';
  const dom = r
    ? `<div class="dom ${r.ok ? 'ok' : 'bad'}"><div class="stor">${r.ok ? 'OK' : r.tilstand === 'fejl' ? 'IKKE EFTERVIST' : 'IKKE OK'}</div><div class="tekst">${r.tilstand === 'fejl' ? 'Beregningen har fejl, se bemærkninger. ' : ''}Største udnyttelse <b>η = ${proc(r.maksUdnyttelse)}</b> for ${k.length === 1 ? 'den ene lastkombination' : `alle ${k.length} lastkombinationer`}.${r.styrendeBrudform && g ? ` Styrende: ${esc(g.navn)}, ${esc(navn(r.styrendeBrudform))} <span class="kref">(${esc(norm(r.styrendeBrudform).replace('EN 1992-4, ', ''))})</span>.` : ''}</div></div>`
    : '<div class="dom bad"><div class="stor">IKKE BEREGNET</div><div class="tekst">Modellen kunne ikke beregnes.</div></div>';
  const resultat = h2('Resultat', 'resultat') + dom + (matrix ? '<h3>Udnyttelse pr. lastkombination</h3>' + matrix : '');

  /* 2. Inddata */
  const pk = r
    ? `<h3>Partialkoefficienter og materialer</h3><table><tbody><tr><th>γ<sub>c</sub></th><td class="n">${dk(r.partialkoefficienter.gammaC, 2)}</td><th>γ<sub>3</sub></th><td class="n">${dk(r.partialkoefficienter.gamma3, 2)}</td><th>γ<sub>Mc</sub></th><td class="n">${dk(r.partialkoefficienter.gammaMc, 2)}</td></tr><tr><th>γ<sub>Ms</sub></th><td class="n">${dk(r.partialkoefficienter.gammaMs, 2)}</td><th>γ<sub>Ms,V</sub></th><td class="n">${dk(r.partialkoefficienter.gammaMsV, 2)}</td><th>γ<sub>inst</sub></th><td class="n">${dk(r.partialkoefficienter.gammaInst, 2)}</td></tr><tr><th>f<sub>ck</sub> [MPa]</th><td class="n">${dk(r.fck, 0)}</td><th>E<sub>c</sub> [MPa]</th><td class="n">${dk(r.Ec, 0)}</td><th>E<sub>s</sub> [MPa]</th><td class="n">${dk(r.indstillinger.Es, 0)}</td></tr></tbody></table>`
    : '';
  const inddata = h2('Inddata', 'inddata') + inddataTabeller(m) + pk;

  /* 3. Plan og snit */
  let plan = '';
  if (r && g) {
    plan = h2('Plan og snit', 'plan') +
      `<div class="fig"><figure>${plantegningSvg(m, g.resultat)}<figcaption>Plan, styrende kombination ${esc(g.navn)}. ${esc(PLAN_FORKLARING)} Mål i mm.</figcaption></figure><figure>${snitSvg(m, 'x')}<figcaption>Snit i x-retningen. Mål i mm.</figcaption></figure></div>` +
      (k.length > 1 ? `<div class="smaa">${k.map((c, i) => (i === gk ? '' : `<figure>${plantegningSvg(m, c.resultat)}<figcaption>${esc(c.navn)} – ${proc(c.maksUdnyttelse)}</figcaption></figure>`)).join('')}</div>` : '');
  }

  /* 4. Ankerkræfter */
  const ids = m.opstilling.anker.map((a: any) => a.id);
  const kraefter = r && k.length
    ? h2('Ankerkræfter', 'ankerkraefter') + `<div class="meta2" style="color:var(--ink3);font-size:8.5pt">Regningsmæssige værdier [kN]. N<sub>Ed</sub> er træk i ankeret, V<sub>Ed</sub> er resulterende forskydning.</div><table><thead><tr><th rowspan="2">Bolt</th>${k.map((c, i) => `<th class="n${i === gk ? ' gov' : ''}" colspan="2" style="text-align:center">${esc(c.navn)}</th>`).join('')}</tr><tr>${k.map(() => '<th class="n">N<sub>Ed</sub></th><th class="n">V<sub>Ed</sub></th>').join('')}</tr></thead><tbody>${ids.map((id: unknown, i: number) => `<tr><td>${esc(id)}</td>${k.map((c) => `<td class="n">${dk(Math.max(0, c.resultat.fordeling.F[i] ?? 0) / 1e3)}</td><td class="n">${dk((c.resultat.forskydning.V[i] ?? 0) / 1e3)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    : '';

  /* 5. Eftervisninger (+ ligninger) */
  const eftSub: NonNullable<(typeof toc)[number]['sub']> = [];
  const eftervis = r
    ? h2('Eftervisninger', 'eftervisninger') + (medLigninger ? '<div class="meta2" style="color:var(--ink3);font-size:8.5pt">For hver lastkombination vises brudformerne med bæreevner og udnyttelse, og under tabellen ligningerne med indsatte værdier.</div>' : '') +
      k.map((c, ci) => {
        const rows = c.resultat.brudformer.map((b) => b.relevant
          ? `<tr id="${bfId(ci, b.id)}" class="${b.id === c.styrendeBrudform ? 'styrende' : ''}"><td><a class="lnk" href="#${medLigninger ? 'lign-' : ''}${bfId(ci, b.id)}" title="${medLigninger ? 'Gå til ligningerne' : 'Gå til brudformen'}"><span class="id">${esc(b.id)}</span> ${esc(navn(b.id))}</a></td><td class="kref">${esc(norm(b.id).replace('EN 1992-4, ', ''))}</td><td class="n">${kn(b.Ed)}</td><td class="n">${kn(b.Rk)}</td><td class="n">${kn(b.Rd)}</td><td class="n ${KLASSE(b.udnyttelse)}"><b>${proc(b.udnyttelse)}</b>${bar(b.udnyttelse)}</td><td>${esc(ankerListe(b.styrendeAnker, m))}</td></tr>`
          : `<tr class="ikke"><td><span class="id">${esc(b.id)}</span> ${esc(navn(b.id))}</td><td class="kref">${esc(norm(b.id).replace('EN 1992-4, ', ''))}</td><td colspan="5">ikke aktuel</td></tr>`).join('');
        const lign = medLigninger
          ? c.resultat.brudformer.filter((b) => b.relevant).map((b) => {
            const d = valg.detalje!(b.id, m, c.resultat);
            if (!d || !d.trin.length) return '';
            return `<div class="ligning" id="lign-${bfId(ci, b.id)}"><h3 class="fl"><span>${esc(d.titel)} <small>${esc(d.ref)}</small></span><span class="u ${KLASSE(b.udnyttelse)}"><a class="lnk" href="#${bfId(ci, b.id)}" title="Tilbage til tabellen">η = ${proc(b.udnyttelse)} ↑</a></span></h3>${d.noter.length ? `<p class="noter">${d.noter.join(' ')}</p>` : ''}<table class="st"><tbody>${d.trin.map((t) => `<tr><td>${t.s}</td><td class="f">${t.f ?? ''}</td><td>${t.v}</td></tr>`).join('')}</tbody></table></div>`;
          }).join('')
          : '';
        eftSub.push({ id: `komb-${ci}`, t: c.navn, sub: c.resultat.brudformer.filter((b) => b.relevant).map((b) => ({ id: medLigninger ? 'lign-' + bfId(ci, b.id) : bfId(ci, b.id), t: navn(b.id) })) });
        return `<h3 class="fl" id="komb-${ci}"><span>${esc(c.navn)}${ci === gk ? ' <small>styrende kombination</small>' : ''}</span><span class="u ${KLASSE(c.maksUdnyttelse)}">η<sub>maks</sub> = ${proc(c.maksUdnyttelse)}</span></h3><table><thead><tr><th>Brudform</th><th>Norm</th><th class="n">E<sub>d</sub> [kN]</th><th class="n">R<sub>k</sub> [kN]</th><th class="n">R<sub>d</sub> [kN]</th><th class="n">Udnyttelse</th><th>Styrende anker</th></tr></thead><tbody>${rows}</tbody></table>${lign}`;
      }).join('') + (medLigninger ? '<div class="meta2" style="color:var(--ink3);font-size:8.5pt">Afsnitsnumre er hentet fra programmets henvisninger og er ikke i alle tilfælde kontrolleret mod normteksten (se dokumentationen om sporbarhed).</div>' : '')
    : '';

  /* 6. Forudsætninger */
  const forb = h2('Forudsætninger og omfang', 'forudsaetninger') +
    `<div class="forb"><p>Befæstning i beton efter DS/EN 1992-4:2018 og DS/EN 1992-4 DK NA:2024. Statisk/kvasistatisk brudgrænsetilstand.</p><h4>Forudsætninger</h4><ul><li>Laster indtastes som regningsmæssige værdier, inkl. K<sub>FI</sub> ved konsekvensklasse CC3.</li><li>Fodpladen forudsættes stiv (EN 1992-4, 6.2.1(2)); pladen, svejsninger og søjle eftervises separat.</li></ul><h4>Uden for omfang</h4><ul><li>Udmattelse, seismik, brand, ulykkeslast, ankerskinner, ekspansions-/skrue-/underskæringsankre, eftervisning af fodplade og svejsninger samt videreførelse af kræfter i betonelementet.</li></ul></div>`;

  /* 7. Bemærkninger */
  const bem = r ? [...r.diagnostik, ...r.kombinationer.flatMap((c) => c.diagnostik.map((d) => ({ ...d })))] : [];
  const unik = [...new Map(bem.map((d) => [`${d.niveau}|${tekst(d)}`, d])).values()].sort((a, b) => ['fejl', 'advarsel', 'info'].indexOf(a.niveau) - ['fejl', 'advarsel', 'info'].indexOf(b.niveau));
  const bemSek = h2(`Bemærkninger (${unik.length})`, 'bemaerkninger') + `<ul class="dok">${unik.map((d) => `<li class="${esc(d.niveau)}"><b>${d.niveau === 'fejl' ? 'Fejl' : d.niveau === 'advarsel' ? 'Advarsel' : 'Info'}:</b> ${esc(tekst(d))}${d.paragraf ? ` <span class="kref">(${esc(d.paragraf)})</span>` : ''}</li>`).join('')}</ul>`;

  const eft = toc.find((x) => x.id === 'eftervisninger');
  if (eft) eft.sub = eftSub;
  const indhold = `<nav class="toc" id="indhold" aria-label="Indhold"><h2 class="tochead">Indhold</h2><ol>${toc.map((x) => `<li><a href="#${x.id}">${x.t}</a>${x.sub?.length ? `<ul>${x.sub.map((c) => `<li><a href="#${c.id}">${esc(c.t)}</a>${c.sub?.length ? `<span class="bf">${c.sub.map((b) => `<a href="#${b.id}">${esc(b.t)}</a>`).join(' · ')}</span>` : ''}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ol></nav>`;

  const projNavn = p.navn || 'Ankerberegning';
  const fod = `${projNavn}${p.nr ? ' · nr. ' + p.nr : ''} · build ${build}`.replace(/[<>&"'\\\n\r]/g, ' ');
  const meta = `<table class="meta"><tbody><tr><th>Projekt</th><td>${esc(p.navn)}</td><th>Projektnr.</th><td>${esc(p.nr)}</td></tr><tr><th>Bygningsdel</th><td>${esc(p.element)}</td><th>Dato</th><td>${esc(p.dato || dato)}</td></tr><tr><th>Udført af</th><td>${esc(p.udfoertAf || '–')}</td><th>Kontrolleret af</th><td>${esc(p.kontrolleretAf || '–')}</td></tr><tr><th>Program</th><td colspan="3">Ankerberegning EN 1992-4 (DK NA), build ${esc(build)}</td></tr></tbody></table>`;
  return `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(projNavn)} – rapport</title><style>${CSS.replace('${FODTEKST}', fod)}</style></head><body>
<div class="vaerktoej"><button type="button" onclick="window.print()">Udskriv / gem som PDF</button></div>
<div class="side"><header class="top"><div><h1>${titel}</h1><div class="norm">DS/EN 1992-4:2018 + DS/EN 1992-4 DK NA:2024</div></div><div class="build">${esc(dato)}<br>build ${esc(build)}</div></header>
${meta}${indhold}${resultat}${inddata}${plan}${kraefter}${eftervis}${forb}${bemSek}
<div class="under"><span>${esc(projNavn)}</span><span>Genereret af Ankerberegning EN 1992-4 · build ${esc(build)}</span></div></div>
</body></html>`;
}

/** Kort tekstrapport til udklipsholderen (e-mail, noter): konklusion, brudformer pr. lastkombination og bemærkninger. */
export function rapportTekst(m: Model, r: ProjektResultat | null, build: string, dato = new Date().toISOString().slice(0, 10)): string {
  const p = m.projekt ?? {};
  const ud: string[] = [`${p.navn || 'Ankerberegning'}${p.element ? ' – ' + p.element : ''}${p.nr ? ' (nr. ' + p.nr + ')' : ''}`, `Befæstning i beton, DS/EN 1992-4:2018 + DK NA:2024 · build ${build} · ${dato}`, ''];
  if (!r) return [...ud, 'Modellen kunne ikke beregnes.'].join('\n');
  ud.push(`${r.ok ? 'OPFYLDT' : r.tilstand === 'fejl' ? 'IKKE EFTERVIST (fejl)' : 'IKKE OPFYLDT'} – største udnyttelse ${proc(r.maksUdnyttelse)}`, '');
  for (const c of r.kombinationer) {
    ud.push(`${c.navn}: ${proc(c.maksUdnyttelse)}`);
    for (const b of c.resultat.brudformer.filter((x) => x.relevant)) {
      ud.push(`  ${(BRUDFORM[b.id] ?? b.id).padEnd(34)} Ed ${dk(b.Ed / 1e3)} kN  Rd ${dk(b.Rd / 1e3)} kN  ${proc(b.udnyttelse)}${b.id === c.styrendeBrudform ? '  ← styrende' : ''}`);
    }
    ud.push('');
  }
  const bem = [...r.diagnostik, ...r.kombinationer.flatMap((c) => c.diagnostik)];
  const unik = [...new Set(bem.filter((d) => d.niveau !== 'info').map((d) => `${d.niveau === 'fejl' ? 'Fejl' : 'Advarsel'}: ${tekst(d)}`))];
  if (unik.length) ud.push('Bemærkninger:', ...unik.map((u) => '  - ' + u));
  return ud.join('\n');
}
