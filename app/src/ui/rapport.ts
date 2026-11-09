// Rapport: selvstændigt HTML-dokument til udskrift/PDF. Inddata afledes af felt-skemaet (altid i takt med formularen),
// resultater og bemærkninger kommer fra beregningen. Ren funktion; al brugertekst escapes.
import type { ProjektResultat } from '../core/beregn';
import { plantegningSvg } from './plantegning';
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
      ud.push(`<h3>${esc(s.no)}. ${esc(s.title)}</h3><table><tr><th>Bolt</th><th>x [mm]</th><th>y [mm]</th><th>Slids</th></tr>${m.opstilling.anker.map((a: any) => `<tr><td>${esc(a.id)}</td><td>${dk(a.x, 0)}</td><td>${dk(a.y, 0)}</td><td>${esc(a.slids ?? '–')}</td></tr>`).join('')}</table>`);
      continue;
    }
    if (s.custom === 'loads') {
      ud.push(`<h3>${esc(s.no)}. ${esc(s.title)} (designværdier inkl. K<sub>FI</sub>)</h3><table><tr><th>Navn</th><th>N [kN]</th><th>V<sub>x</sub> [kN]</th><th>V<sub>y</sub> [kN]</th><th>M<sub>x</sub> [kNm]</th><th>M<sub>y</sub> [kNm]</th><th>T [kNm]</th><th>α<sub>sus</sub></th></tr>${m.laster.map((l: any) => `<tr><td>${esc(l.navn)}</td><td>${dk(l.N / 1e3)}</td><td>${dk(l.Vx / 1e3)}</td><td>${dk(l.Vy / 1e3)}</td><td>${dk(l.Mx / 1e6, 2)}</td><td>${dk(l.My / 1e6, 2)}</td><td>${dk(l.T / 1e6, 2)}</td><td>${l.alphaSus == null ? 'std.' : dk(l.alphaSus, 2)}</td></tr>`).join('')}</table>`);
      continue;
    }
    const felter = [...((s.fields ?? []).filter((f): f is FeltDef => 'k' in f)), ...(s.id === 'beton' ? KANTFELTER : [])]
      .filter((f) => (!f.show || f.show(m)) && !f.adv);
    const rk = felter.map((f) => {
      const v = laesSti(m, f.k);
      const vis = f.type === 'switch' ? (v ? 'ja' : 'nej') : f.options ? (f.options.find(([ov]) => ov === v || (v == null && ov === ''))?.[1] ?? String(v ?? '')) : v == null ? (f.std ? f.std(m) : '–') : visFelt(f, v);
      return `<tr><td>${sub(f.sym)}</td><td>${sub(f.lbl)}</td><td class="t">${esc(vis)}</td><td>${sub(f.unit ?? '')}</td><td class="ref">${esc(f.ref)}</td></tr>`;
    });
    if (rk.length) ud.push(`<h3>${esc(s.no)}. ${esc(s.title)}</h3><table class="inddata">${rk.join('')}</table>`);
  }
  return ud.join('\n');
}

export function rapportHtml(m: Model, r: ProjektResultat | null, build: string, dato = new Date().toISOString().slice(0, 10)): string {
  const p = m.projekt ?? {};
  const k = r ? r.kombinationer : [];
  const resultat = r
    ? `<div class="konklusion ${r.ok ? 'ok' : 'ikke'}"><b>${r.ok ? 'Opfyldt' : r.tilstand === 'fejl' ? 'Ikke eftervist – se fejl i bemærkninger' : 'Ikke opfyldt'}</b> – største udnyttelse ${proc(r.maksUdnyttelse)}${r.styrendeBrudform ? `, styrende brudform: ${esc(BRUDFORM[r.styrendeBrudform] ?? r.styrendeBrudform)} (${esc(k[r.styrendeKombination!]?.navn)})` : ''}.</div>` +
      k.map((c) => `<h3>${esc(c.navn)} – ${proc(c.maksUdnyttelse)}</h3><div class="plan">${plantegningSvg(m, c.resultat)}</div><table><tr><th>Brudform</th><th>E<sub>d</sub> [kN]</th><th>R<sub>k</sub> [kN]</th><th>R<sub>d</sub> [kN]</th><th>Udnyttelse</th><th>Styrende anker</th></tr>${c.resultat.brudformer.filter((b) => b.relevant).map((b) => `<tr class="${b.id === c.styrendeBrudform ? 'styrende' : ''}"><td>${esc(b.id)} ${esc(BRUDFORM[b.id] ?? '')}</td><td>${b.Ed ? dk(b.Ed / 1e3) : ''}</td><td>${b.Rk ? dk(b.Rk / 1e3) : ''}</td><td>${b.Rd ? dk(b.Rd / 1e3) : ''}</td><td>${proc(b.udnyttelse)}</td><td>${esc(Array.isArray(b.styrendeAnker) ? b.styrendeAnker.join(', ') : (b.styrendeAnker ?? ''))}</td></tr>`).join('')}</table>`).join('')
    : '<p>Modellen kunne ikke beregnes.</p>';
  const pk = r
    ? `<table><tr><th>γ<sub>c</sub></th><td>${dk(r.partialkoefficienter.gammaC, 2)}</td><th>γ<sub>3</sub></th><td>${dk(r.partialkoefficienter.gamma3, 2)}</td><th>γ<sub>Mc</sub></th><td>${dk(r.partialkoefficienter.gammaMc, 2)}</td></tr><tr><th>γ<sub>Ms</sub></th><td>${dk(r.partialkoefficienter.gammaMs, 2)}</td><th>γ<sub>Ms,V</sub></th><td>${dk(r.partialkoefficienter.gammaMsV, 2)}</td><th>γ<sub>inst</sub></th><td>${dk(r.partialkoefficienter.gammaInst, 2)}</td></tr><tr><th>f<sub>ck</sub> [MPa]</th><td>${dk(r.fck, 0)}</td><th>E<sub>c</sub> [MPa]</th><td>${dk(r.Ec, 0)}</td><th>E<sub>s</sub> [MPa]</th><td>${dk(r.indstillinger.Es, 0)}</td></tr></table>`
    : '';
  const bem = r ? [...r.diagnostik, ...r.kombinationer.flatMap((c) => c.diagnostik.map((d) => ({ ...d })))] : [];
  const unik = [...new Map(bem.map((d) => [`${d.niveau}|${tekst(d)}`, d])).values()].sort((a, b) => ['fejl', 'advarsel', 'info'].indexOf(a.niveau) - ['fejl', 'advarsel', 'info'].indexOf(b.niveau));
  return `<!doctype html><html lang="da"><head><meta charset="utf-8"><title>${esc(p.navn || 'Ankerberegning')} – rapport</title><style>
body{font:11pt/1.4 system-ui,sans-serif;color:#111;margin:20mm 15mm;max-width:190mm}h1{font-size:18pt;margin:0 0 4pt}h2{font-size:14pt;border-bottom:1px solid #999;margin-top:18pt}h3{font-size:11.5pt;margin:12pt 0 4pt}
table{border-collapse:collapse;width:100%;margin:4pt 0;font-size:10pt}th,td{border-bottom:1px solid #ddd;padding:2pt 5pt;text-align:left}td.t{font-weight:600}td.ref{color:#666;font-size:9pt}.inddata td:first-child{width:12%}
.konklusion{padding:6pt 10pt;border-radius:4pt;margin:6pt 0}.konklusion.ok{background:#e4f5ea}.konklusion.ikke{background:#fbe6e4}tr.styrende td{font-weight:700}.plan{max-width:62mm;float:right;margin:0 0 6pt 10pt}.plan svg{width:100%;height:auto;color:#111;--card:#fff;--accent:#1b5fd0;--warn:#c98a00;--err:#c62d20}
.meta{color:#555;font-size:9.5pt}.fejl{color:#b42318}.advarsel{color:#a15c00}.dok li{margin:2pt 0}@media print{h2{break-after:avoid}table{break-inside:avoid}}</style></head><body>
<h1>${esc(p.navn || 'Ankerberegning')}</h1><div class="meta">${esc(p.element)} ${p.nr ? '· nr. ' + esc(p.nr) : ''}<br>Udført af ${esc(p.udfoertAf || '–')} · kontrolleret af ${esc(p.kontrolleretAf || '–')} · ${esc(p.dato || dato)} · program build ${esc(build)}</div>
<p class="meta">Befæstning i beton efter DS/EN 1992-4:2018 og DS/EN 1992-4 DK NA:2024. Statisk/kvasistatisk brudgrænsetilstand. Ikke omfattet: udmattelse, seismik, brand, ulykkeslast, ankerskinner, ekspansions-/skrue-/underskæringsankre, eftervisning af fodplade og svejsninger samt videreførelse af kræfter i betonelementet.</p>
<h2>Resultat</h2>${resultat}
<h2>Partialkoefficienter og materialer</h2>${pk}
<h2>Inddata</h2>${inddataTabeller(m)}
<h2>Bemærkninger (${unik.length})</h2><ul class="dok">${unik.map((d) => `<li class="${esc(d.niveau)}"><b>${d.niveau === 'fejl' ? 'Fejl' : d.niveau === 'advarsel' ? 'Advarsel' : 'Info'}:</b> ${esc(tekst(d))}${d.paragraf ? ` <span class="meta">(${esc(d.paragraf)})</span>` : ''}</li>`).join('')}</ul>
</body></html>`;
}
