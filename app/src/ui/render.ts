// Præsentationslag: tegner formular, resultater og diagnoser ud fra Store. Ingen beregning her.
import type { Brudform } from '../core/kombination';
import type { Diagnostik } from '../core/diagnostik';
import { standardModel } from '../core/indlaes';
import { KANTFELTER, SEKTIONER } from './felter';
import type { FeltDef, Felt, Model, Sektion } from './skema-typer';
import type { Store } from './state';
import { plantegningSvg, PLAN_FORKLARING } from './plantegning';
import { rapportHtml } from './rapport';
import { genererAnkre, MOENSTRE, type MoensterParam } from '../core/opstilling';
import { BRUDFORM, MOENSTER_NAVN, PARAM_NAVN } from './render-tekster';
import { beregnForslag, type ForslagResultat, type SpecResultat } from '../core/forslag';
import { saetSti } from '../core/sti';
import { aendringTekst, etiket, forudsaetning, hvorforTekst } from './forslag-tekster';
import { tekst } from './tekster';
import { FEJLTEKST, laesSti, visFelt } from './vaerdi';


type Barn = (Node | string | null | false | undefined)[];
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attr: Record<string, unknown> = {}, ...barn: Barn): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attr)) {
    if (v == null || v === false) continue;
    if (k === 'html') e.innerHTML = String(v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v as EventListener);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, String(v));
  }
  for (const b of barn) if (b) e.append(b);
  return e;
}

const proc = (u: number | null | undefined) => (u == null ? '–' : Number.isFinite(u) ? `${(u * 100).toFixed(u < 0.995 ? 0 : 1).replace('.', ',')} %` : '∞');
const kN = (n: number) => (Number.isFinite(n) ? (n / 1000).toFixed(1).replace('.', ',').replace('-', '−') : '∞');

export function opsaet(rod: HTMLElement, store: Store, build: string): void {
  let avanceret = false;
  // Justeringsforslag beregnes først, når brugeren beder om det, og gælder kun for den model, de blev beregnet for.
  let forslag: { sig: string; res: ForslagResultat } | null = null;
  let forslagBeregner = false;
  const draw = () => {
    const aktivt = document.activeElement as HTMLElement | null;
    const fokus = aktivt?.dataset?.felt;
    const sel = aktivt instanceof HTMLInputElement ? [aktivt.selectionStart, aktivt.selectionEnd] : null;
    rod.replaceChildren(topbar(), h('main', { class: 'layout' }, h('div', { class: 'input' }, ...sektioner()), h('div', { class: 'output' }, resultat(), ...(store.tilstand.resultat && !store.tilstand.resultat.ok && store.tilstand.resultat.kombinationer.length ? [forslagSektion()] : []), tegning(), diagnostik())));
    if (fokus) {
      const n = rod.querySelector<HTMLElement>(`[data-felt="${CSS.escape(fokus)}"]`);
      n?.focus();
      if (n instanceof HTMLInputElement && sel && sel[0] != null) n.setSelectionRange(sel[0], sel[1] ?? sel[0]);
    }
  };

  function topbar(): HTMLElement {
    const fil = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async (e: Event) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) store.indlaesTekst(await f.text());
    } });
    return h('header', { class: 'top' },
      h('h1', {}, 'Ankerberegning ', h('small', {}, 'EN 1992-4 · ny kodebase')),
      h('div', { class: 'knapper' },
        h('button', { onclick: () => store.indlaesTekst(JSON.stringify(standardModel(new Date().toISOString().slice(0, 10)))) }, 'Eksempel'),
        h('button', { onclick: () => fil.click() }, 'Åbn …'), fil,
        h('button', { onclick: () => {
          const a = h('a', { href: URL.createObjectURL(new Blob([store.tilJson()], { type: 'application/json' })), download: 'anker-projekt.json' });
          a.click(); URL.revokeObjectURL(a.href);
        } }, 'Gem'),
        h('button', { class: 'primaer', onclick: () => {
          const html = rapportHtml(store.tilstand.model, store.tilstand.resultat, build);
          const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
          const w = window.open(url, '_blank');
          if (w) w.addEventListener('load', () => w.print());
          else { const a = h('a', { href: url, download: 'anker-rapport.html' }); a.click(); }
        } }, 'Rapport'),
        h('label', { class: 'adv' }, h('input', { type: 'checkbox', checked: avanceret, onchange: (e: Event) => { avanceret = (e.target as HTMLInputElement).checked; draw(); } }), ' Avanceret'),
        h('span', { class: 'build' }, `build ${build}`)),
      store.tilstand.fejl && h('div', { class: 'fejlbanner', role: 'alert' }, store.tilstand.fejl),
      store.tilstand.afvist.length > 0 && h('div', { class: 'advarselbanner' }, `${store.tilstand.afvist.length} værdier blev afvist ved indlæsning (standardværdi brugt): ${store.tilstand.afvist.map((a) => a.felt).join(', ')}`));
  }

  function felt(f: FeltDef, m: Model): HTMLElement | null {
    if (f.show && !f.show(m)) return null;
    if (f.adv && !avanceret) return null;
    const v = laesSti(m, f.k);
    const fejl = store.tilstand.feltfejl[f.k];
    const dis = f.disabled?.(m) ?? null;
    const std = f.std && (v == null || v === '') ? f.std(m) : '';
    let ind: HTMLElement;
    if (f.type === 'switch') {
      ind = h('input', { type: 'checkbox', 'data-felt': f.k, checked: v === true, disabled: !!dis, onchange: (e: Event) => store.saetFelt(f, (e.target as HTMLInputElement).checked) });
    } else if (f.type === 'seg') {
      ind = h('div', { class: 'seg' }, ...f.options!.map(([ov, tx]) => h('button', { type: 'button', class: String(ov) === String(v) ? 'valgt' : '', onclick: () => store.saetFelt(f, String(ov)) }, tx)));
    } else if (f.type === 'select') {
      ind = h('select', { 'data-felt': f.k, disabled: !!dis, onchange: (e: Event) => store.saetFelt(f, (e.target as HTMLSelectElement).value) },
        ...f.options!.map(([ov, tx]) => h('option', { value: String(ov), selected: String(ov) === String(v ?? '') }, tx)));
    } else {
      ind = h('input', { type: 'text', inputmode: f.type === 'num' ? 'decimal' : 'text', 'data-felt': f.k, value: fejl ? '' : visFelt(f, v), placeholder: std,
        disabled: !!dis || f.readonly, class: fejl ? 'ugyldig' : '', onchange: (e: Event) => store.saetFelt(f, (e.target as HTMLInputElement).value) });
    }
    return h('div', { class: 'felt', title: f.tip.replace(/<[^>]+>/g, '') },
      h('label', {}, h('span', { class: 'sym', html: f.sym }), ' ', h('span', { html: f.lbl })),
      h('div', { class: 'ind' }, ind, f.unit && h('span', { class: 'enhed', html: f.unit })),
      fejl && h('div', { class: 'feltfejl' }, FEJLTEKST[fejl.kode]!(fejl.grænse)),
      dis && h('div', { class: 'note', html: dis }),
      h('div', { class: 'ref' }, f.ref));
  }

  function fraSkema(s: Sektion, m: Model): Node[] {
    const ud: Node[] = [];
    for (const f of s.fields ?? ([] as Felt[])) {
      if ('k' in f) { const n = felt(f, m); if (n) ud.push(n); }
      else if ('custom' in f) {
        if (f.show && !f.show(m)) continue;
        if (f.custom === 'edges') ud.push(h('div', { class: 'gruppe' }, ...KANTFELTER.map((k) => felt(k, m))));
        else if (f.custom === 'layout') ud.push(opstilling(m));
        else if (f.custom === 'naReset') ud.push(h('button', { onclick: () => store.aendr((mm) => { mm.indstillinger = standardModel().indstillinger; }) }, 'Nulstil til DK NA-standard'));
      } else if ('sub' in f || 'note' in f) {
        if (f.show && !f.show(m)) continue;
        if (f.adv && !avanceret) continue;
        ud.push(f.sub ? h('h4', {}, f.sub) : h('p', { class: 'note' }, f.note));
      }
    }
    return ud;
  }

  function opstilling(m: Model): HTMLElement {
    const num = (v: number, set: (x: number) => void) => h('input', { type: 'text', inputmode: 'decimal', value: String(v).replace('.', ','), onchange: (e: Event) => {
      const x = Number(String((e.target as HTMLInputElement).value).replace(',', '.'));
      if (Number.isFinite(x)) store.aendr(() => set(x));
    } });
    const regen = (mm: Model) => { if (mm.opstilling.type !== 'fri') mm.opstilling.anker = genererAnkre(mm.opstilling); };
    const param = (k: MoensterParam) => h('label', { class: 'felt' }, h('span', {}, PARAM_NAVN[k]),
      h('input', { type: 'text', inputmode: 'decimal', value: String(m.opstilling[k] ?? '').replace('.', ','), onchange: (e: Event) => {
        const x = Number(String((e.target as HTMLInputElement).value).replace(',', '.'));
        if (Number.isFinite(x) && x >= 0) store.aendr((mm) => { mm.opstilling[k] = x; regen(mm); });
      } }));
    const moenster = MOENSTRE.find((q) => q.id === m.opstilling.type);
    return h('div', { class: 'tabel' },
      h('div', { class: 'gruppe' },
        h('label', { class: 'felt' }, h('span', {}, 'Opstilling'),
          h('select', { onchange: (e: Event) => store.aendr((mm) => { mm.opstilling.type = (e.target as HTMLSelectElement).value; regen(mm); }) },
            ...MOENSTRE.map((q) => h('option', { value: q.id, selected: q.id === m.opstilling.type }, MOENSTER_NAVN[q.id])))),
        ...(moenster?.params ?? []).map(param)),
      h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Bolt'), h('th', {}, 'x [mm]'), h('th', {}, 'y [mm]'), h('th', {}, 'Slids'), h('th', {}, ''))),
        h('tbody', {}, ...m.opstilling.anker.map((a: any, i: number) => h('tr', {},
          h('td', {}, String(a.id)),
          h('td', {}, num(a.x, (x) => { store.tilstand.model.opstilling.anker[i].x = x; store.tilstand.model.opstilling.type = 'fri'; })),
          h('td', {}, num(a.y, (y) => { store.tilstand.model.opstilling.anker[i].y = y; store.tilstand.model.opstilling.type = 'fri'; })),
          h('td', {}, h('select', { onchange: (e: Event) => store.aendr((mm) => { mm.opstilling.anker[i].slids = (e.target as HTMLSelectElement).value || null; }) },
            ...[['', 'ingen'], ['x', 'i x'], ['y', 'i y']].map(([v, t]) => h('option', { value: v, selected: (a.slids ?? '') === v }, t)))),
          h('td', {}, m.opstilling.anker.length > 1 && h('button', { title: 'Fjern bolt', onclick: () => store.aendr((mm) => { mm.opstilling.anker.splice(i, 1); mm.opstilling.anker.forEach((q: any, j: number) => { q.id = j + 1; }); mm.opstilling.type = 'fri'; }) }, '×')))))),
      h('button', { onclick: () => store.aendr((mm) => { const n = mm.opstilling.anker.length; mm.opstilling.anker.push({ id: n + 1, x: 0, y: 0, slids: null }); mm.opstilling.type = 'fri'; }) }, '+ Tilføj bolt'));
  }

  function laster(m: Model): HTMLElement {
    const kol = [['N', 'N [kN]', 1e3], ['Vx', 'Vx [kN]', 1e3], ['Vy', 'Vy [kN]', 1e3], ['Mx', 'Mx [kNm]', 1e6], ['My', 'My [kNm]', 1e6], ['T', 'T [kNm]', 1e6]] as const;
    return h('div', { class: 'tabel' },
      h('p', { class: 'note' }, 'Lasterne er designværdier inklusive KFI (der ganges ikke med KFI i beregningen). N > 0 er træk.'),
      h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Navn'), ...kol.map((k) => h('th', {}, k[1])), h('th', {}, 'αsus'), h('th', {}, ''))),
        h('tbody', {}, ...m.laster.map((l: any, i: number) => h('tr', {},
          h('td', {}, h('input', { type: 'text', value: l.navn, onchange: (e: Event) => store.aendr((mm) => { mm.laster[i].navn = (e.target as HTMLInputElement).value; }) })),
          ...kol.map(([k, , f]) => h('td', {}, h('input', { type: 'text', inputmode: 'decimal', value: String(Math.round((l[k] / f) * 1e6) / 1e6).replace('.', ','), onchange: (e: Event) => {
            const x = Number(String((e.target as HTMLInputElement).value).replace(',', '.'));
            if (Number.isFinite(x)) store.aendr((mm) => { mm.laster[i][k] = x * f; });
          } }))),
          h('td', {}, h('input', { type: 'text', inputmode: 'decimal', placeholder: 'std.', value: l.alphaSus == null ? '' : String(l.alphaSus).replace('.', ','), onchange: (e: Event) => {
            const t = (e.target as HTMLInputElement).value.trim(); const x = Number(t.replace(',', '.'));
            store.aendr((mm) => { mm.laster[i].alphaSus = t === '' || !Number.isFinite(x) || x < 0 || x > 1 ? null : x; });
          } })),
          h('td', {}, m.laster.length > 1 && h('button', { title: 'Fjern', onclick: () => store.aendr((mm) => { mm.laster.splice(i, 1); }) }, '×')))))),
      h('button', { onclick: () => store.aendr((mm) => { mm.laster.push({ navn: `LK${mm.laster.length + 1}`, N: 0, Vx: 0, Vy: 0, Mx: 0, My: 0, T: 0, alphaSus: null }); }) }, '+ Tilføj lastkombination'));
  }

  function sektioner(): HTMLElement[] {
    const m = store.tilstand.model;
    const mk = (id: string, titel: string, resume: string, indhold: Node[], aaben = false) =>
      h('details', { class: 'sektion', open: aaben || sessionStorageGet(id), ontoggle: (e: Event) => sessionStorageSet(id, (e.target as HTMLDetailsElement).open) },
        h('summary', {}, h('b', {}, titel), ' ', h('span', { class: 'resume', html: resume })), h('div', { class: 'indhold' }, ...indhold));
    return SEKTIONER.map((s) => mk(s.id, `${s.no}. ${s.title}`, s.summary(m),
      s.custom === 'layout' ? [opstilling(m)] : s.custom === 'loads' ? [laster(m)] : fraSkema(s, m), s.id === 'anker' || s.id === 'laster'));
  }

  function resultat(): HTMLElement {
    const t = store.tilstand, r = t.resultat;
    const k = r?.kombinationer[t.valgtKombination ?? 0];
    if (!r || !k) return h('section', { class: 'res' }, h('h2', {}, 'Resultat'), h('p', { class: 'note' }, 'Modellen kan ikke beregnes – ret fejlene nedenfor.'));
    const rk: Brudform[] = k.resultat.brudformer.filter((b) => b.relevant && b.udnyttelse != null);
    return h('section', { class: 'res' },
      h('h2', {}, 'Resultat'),
      h('div', { class: `hoved ${r.ok ? 'ok' : 'ikke-ok'}` },
        h('span', { class: 'stor' }, proc(r.maksUdnyttelse)),
        h('span', {}, r.ok ? 'Opfyldt' : r.tilstand === 'fejl' ? 'Ikke eftervist – se fejl' : 'Ikke opfyldt'),
        r.styrendeBrudform && h('span', { class: 'sub' }, `styrende: ${BRUDFORM[r.styrendeBrudform] ?? r.styrendeBrudform} (${r.kombinationer[r.styrendeKombination!]!.navn})`)),
      h('div', { class: 'kombi' }, ...r.kombinationer.map((c, i) => h('button', { class: i === t.valgtKombination ? 'valgt' : '', onclick: () => store.vaelgKombination(i) }, `${c.navn} · ${proc(c.maksUdnyttelse)}`))),
      h('table', { class: 'brud' }, h('thead', {}, h('tr', {}, h('th', {}, 'Brudform'), h('th', {}, 'Ed [kN]'), h('th', {}, 'Rd [kN]'), h('th', {}, 'Udnyttelse'))),
        h('tbody', {}, ...rk.map((b) => h('tr', { class: b.id === k.styrendeBrudform ? 'styrende' : '' },
          h('td', {}, h('code', {}, b.id), ' ', BRUDFORM[b.id] ?? ''),
          h('td', {}, b.Ed ? kN(b.Ed) : ''), h('td', {}, b.Rd ? kN(b.Rd) : ''),
          h('td', {}, h('div', { class: 'bar' }, h('div', { class: `fyld ${b.udnyttelse! > 1 ? 'over' : ''}`, style: `width:${Math.min(100, b.udnyttelse! * 100)}%` }), h('span', {}, proc(b.udnyttelse)))))))));
  }

  const pct = (u: number) => proc(u);
  function forslagSektion(): HTMLElement {
    const sig = JSON.stringify(store.tilstand.model);
    const sek = h('section', { class: 'res forslag' }, h('h2', {}, 'Justeringer for tilstrækkelig bæreevne'));
    if (!forslag || forslag.sig !== sig) {
      sek.append(h('p', { class: 'note' }, 'Programmet kan prøve hver parameter alene og vise den mindste ændring, der giver udnyttelse ≤ 100 %.'),
        h('button', { disabled: forslagBeregner, onclick: () => {
          forslagBeregner = true; draw();
          setTimeout(() => { forslag = { sig, res: beregnForslag(store.tilstand.model) }; forslagBeregner = false; draw(); }, 30);
        } }, forslagBeregner ? 'Beregner …' : 'Foreslå justeringer'));
      return sek;
    }
    const f = forslag.res;
    if (f.fejl) { sek.append(h('p', { class: 'note' }, 'Forslag kan ikke beregnes, før fejl i input er rettet.')); return sek; }
    const hits = f.forslag.filter((r) => r.hit), dele = f.forslag.filter((r) => !r.hit);
    const g = f.styrende;
    sek.append(h('small', {}, 'hver parameter ændret alene, øvrige uændrede'),
      h('p', {}, 'Styrende brudform', g ? [': ', BRUDFORM[g.id] ?? g.id, ` (${pct(g.u)})`].join('') : '', '. Laveste ændring, der giver maksimal udnyttelse ≤ 100 % for alle lastkombinationer:'));
    if (!hits.length) sek.append(h('p', { class: 'note' }, 'Ingen enkeltparameter kan alene bringe udnyttelsen ned på 100 % inden for rimelige grænser. Kombinér ændringer – de mest virkningsfulde er vist nedenfor.'));
    const raekke = (r: SpecResultat) => {
      const x = (r.hit ?? r.best)!;
      const g2 = x.r.kombinationer[x.r.styrendeKombination ?? 0];
      const nb = g2?.resultat.styrendeBrudform ? ` · styrende derefter: ${BRUDFORM[g2.resultat.styrendeBrudform] ?? g2.resultat.styrendeBrudform}` : '';
      const note = r.hit ? `udnyttelse ${pct(x.u)}${nb}` : `kan højst sænke udnyttelsen til ${pct(x.u)} – ikke nok alene${nb}`;
      const erstat = r.spec.art === 'valg' && !r.spec.premis && /ankerarmering/.test(r.spec.noegle) && r.spec.fra != null ? `Erstatter den indtastede ankerarmering.` : '';
      const prem = r.spec.art === 'valg' && r.spec.premis ? `Forudsætning: ${forudsaetning(r.spec.liste[0]!.beskrivelse)} – programmet kan ikke kontrollere den.` : erstat;
      return h('li', { class: r.hit ? '' : 'delvis' },
        h('div', {}, aendringTekst(r.spec, x), h('small', {}, note), prem && h('small', {}, prem)),
        h('button', { onclick: () => store.aendr((mm) => { for (const [p, v] of x.ops) saetSti(mm, p, v); }) }, 'Anvend'));
    };
    if (hits.length) sek.append(h('ul', { class: 'forslagsliste' }, ...hits.map(raekke)));
    if (dele.length) sek.append(h('h4', {}, 'Hjælper, men er ikke nok alene'), h('ul', { class: 'forslagsliste' }, ...dele.map(raekke)));
    if (f.hvorfor.length) sek.append(h('p', { class: 'note' }, 'Bemærk om indtastet armering: ' + f.hvorfor.map(hvorforTekst).join(' ')));
    if (f.uden.length) sek.append(h('p', { class: 'note' }, 'Uden nævneværdig effekt: ' + f.uden.map((u) => etiket(u.noegle)).join(', ') + '.'));
    return sek;
  }

  function tegning(): HTMLElement {
    const t = store.tilstand;
    const k = t.resultat ? t.resultat.kombinationer[t.valgtKombination ?? 0]?.resultat ?? null : null;
    return h('section', { class: 'res' }, h('h2', {}, 'Plantegning'), h('div', { class: 'planbox', html: plantegningSvg(t.model, k) }), h('p', { class: 'note' }, PLAN_FORKLARING));
  }

  function diagnostik(): HTMLElement {
    const ds: Diagnostik[] = store.tilstand.diagnostik;
    return h('section', { class: 'diag' }, h('h2', {}, `Bemærkninger (${ds.length})`),
      h('ul', {}, ...ds.map((d) => h('li', { class: d.niveau, onclick: () => d.felt && rod.querySelector<HTMLElement>(`[data-felt="${CSS.escape(d.felt)}"]`)?.focus() },
        h('b', {}, d.niveau === 'fejl' ? 'Fejl' : d.niveau === 'advarsel' ? 'Advarsel' : 'Info'), ' ', tekst(d), d.paragraf && h('span', { class: 'ref' }, ` ${d.paragraf}`)))));
  }

  store.subscribe(draw);
  draw();
}

function sessionStorageGet(id: string): boolean { try { return sessionStorage.getItem('sek-' + id) === '1'; } catch { return false; } }
function sessionStorageSet(id: string, v: boolean): void { try { sessionStorage.setItem('sek-' + id, v ? '1' : '0'); } catch { /* ingen lagring */ } }
