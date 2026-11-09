// Præsentationslag: tegner formular, resultater og diagnoser ud fra Store. Ingen beregning her.
import type { Brudform } from '../core/kombination';
import type { Diagnostik } from '../core/diagnostik';
import { standardModel } from '../core/indlaes';
import { KANTFELTER, SEKTIONER } from './felter';
import type { FeltDef, Felt, Model, Sektion } from './skema-typer';
import type { Store } from './state';
import { plantegningSvg, PLAN_FORKLARING } from './plantegning';
import { byg3d } from './model3d';
import { armUdvid, saetArmUdvid } from './skema-hjaelp';
import { beregningsdetalje } from './brud-detaljer';
import { IDEALISERET } from './brudlegemer';
import { oversigtForskydning, oversigtTraek } from './arm-oversigt';
import { anvendHilti as anvendHiltiModel, STOERRELSER, type Borehul, type Stoerrelse, type Temperaturomraade } from '../core/produkter';
import { produktFraAnker, produktOpdateringer } from '../core/produkter';
import { gemEgetProdukt, laesEgneProdukter, sletEgetProdukt } from './egne-produkter';
import { snitSvg, type SnitAkse } from './snit';
import { anvendMaal, maalRedigerbarhed } from './maal-redigering';
import { opret3D, type Kamera, type Scene3D } from './scene3d';
import { rapportHtml, rapportTekst } from './rapport';
import { hulfrigangsDiameter } from '../core/validering';
import { drejOpstilling90, genererAnkre, tilpasPlade, MOENSTRE, type MoensterParam } from '../core/opstilling';
import { BRUDFORM, MOENSTER_NAVN, PARAM_NAVN } from './render-tekster';
import { beregnForslag, type ForslagResultat, type SpecResultat } from '../core/forslag';
import { saetSti } from '../core/sti';
import { REPO, hentSeneste, vurderVersion, type AjourStatus } from './ajour';
import { laesTema, naesteTema, saetTema, type Tema } from './autogem';
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
  let medLigninger = (() => { try { return localStorage.getItem('rapport.ligninger') !== '0'; } catch { return true; } })();
  let avanceret = false;
  // Justeringsforslag beregnes først, når brugeren beder om det, og gælder kun for den model, de blev beregnet for.
  let forslag: { sig: string; res: ForslagResultat } | null = null;
  let forslagBeregner = false;
  let ajour: AjourStatus = { tilstand: 'check', etiket: 'Tjekker version …', seneste: null, prs: [], commit: null, prsUkendt: false };
  let tema: Tema = laesTema();
  const tjekVersion = async () => {
    ajour = { ...ajour, tilstand: 'check', etiket: 'Tjekker version …' }; draw();
    ajour = vurderVersion(build, await hentSeneste()); draw();
  };
  const TEMA_NAVN: Record<Tema, string> = { system: 'Tema: system', moerk: 'Tema: mørk', lys: 'Tema: lys' };
  const dialog = (titel: string, indhold: (Node | false | null)[], knapper: Node[] = []) => {
    const d = h('dialog', {}, h('h3', {}, titel), ...indhold, h('menu', {}, ...knapper, h('button', { onclick: () => { d.close(); d.remove(); } }, 'Luk')));
    d.addEventListener('close', () => d.remove());
    document.body.append(d); d.showModal();
  };
  const omDialog = () => dialog('Om programmet', [
    h('p', {}, `Ankerberegning efter DS/EN 1992-4. Version ${build}.`),
    h('p', {}, 'Programmet er et beregningsværktøj og ikke certificeret. Resultater skal kontrolleres af en ingeniør, og de nationale parametre (DK NA) skal verificeres mod gældende dokumenter før brug til projekter.'),
    h('p', {}, 'Kontrol: kernen er testet mod den gamle version, mod en uafhængig Python-reference og mod håndskrevne normformler. Se docs/sporbarhed.md og docs/verifikation.md i kodelageret.'),
    h('p', {}, h('a', { href: `https://github.com/${REPO}`, target: '_blank', rel: 'noopener' }, 'Kodelager på GitHub'))]);
  const indsaetDialog = () => {
    const felt = h('textarea', { placeholder: 'Indsæt projekt-JSON her …' });
    const fejl = h('p', { class: 'note', role: 'alert' });
    dialog('Indsæt JSON', [felt, fejl], [h('button', { class: 'primaer', onclick: () => {
      try { JSON.parse(felt.value); } catch (e) { fejl.textContent = `Ugyldig JSON: ${(e as Error).message}`; return; }
      store.indlaesTekst(felt.value); (felt.closest('dialog') as HTMLDialogElement).close();
    } }, 'Indlæs')]);
  };
  const ajourDialog = () => dialog('Versionstjek', [
    h('p', {}, h('b', {}, 'Din version: '), build),
    h('p', {}, h('b', {}, 'Seneste på main: '), ajour.seneste ?? 'ukendt'),
    ajour.commit && h('p', { class: 'note' }, `Seneste commit: ${ajour.commit.tekst} (${ajour.commit.dato})`),
    ajour.tilstand === 'old' && h('p', {}, h('b', {}, 'Der findes en nyere version. '), 'Genindlæs siden (Ctrl/Cmd+Shift+R) eller hent den nyeste index.html.'),
    ajour.tilstand === 'off' && h('p', { class: 'note' }, 'Kunne ikke kontakte GitHub (offline eller blokeret), så det kan ikke ses, om der er en nyere version.'),
    ajour.prsUkendt && ajour.tilstand !== 'off' && h('p', { class: 'note' }, "Listen over åbne PR'er kunne ikke hentes."),
    ajour.prs.length > 0 && h('div', {}, h('b', {}, `Under udvikling (${ajour.prs.length} åbne PR):`),
      h('ul', {}, ...ajour.prs.map((p) => h('li', {}, h('a', { href: p.html_url, target: '_blank', rel: 'noopener' }, `#${p.number} ${p.title}`), p.draft ? ' (kladde)' : ''))))],
  [h('button', { onclick: () => { void tjekVersion(); } }, 'Tjek igen')]);
  const kopierRapport = async () => {
    const t = rapportTekst(store.tilstand.model, store.tilstand.resultat, build);
    try { await navigator.clipboard.writeText(t); dialog('Rapport kopieret', [h('p', {}, 'Tekstrapporten er kopieret til udklipsholderen.')], []); }
    catch { dialog('Kopiér rapport', [h('p', {}, 'Kopiering blev afvist af browseren. Markér og kopiér teksten her:'), h('textarea', { readonly: true, rows: 14, style: 'width:100%' }, t)], []); }
  };
  const draw = () => {
    const aktivt = document.activeElement as HTMLElement | null;
    const fokus = aktivt?.dataset?.felt;
    const faelles = 'input, select, textarea, button, summary';
    const fokusIdx = !fokus && aktivt && rod.contains(aktivt) ? Array.from(rod.querySelectorAll(faelles)).indexOf(aktivt) : -1;
    const sel = aktivt instanceof HTMLInputElement ? [aktivt.selectionStart, aktivt.selectionEnd] : null;
    // Bevar rulleposition (side og resultatpanel), så en rettelse ikke hopper til toppen
    const sideX = window.scrollX, sideY = window.scrollY;
    const outputTop = rod.querySelector('.output')?.scrollTop ?? 0;
    rod.replaceChildren(topbar(), h('main', { class: 'layout' }, h('div', { class: 'input' }, ...sektioner()), h('div', { class: 'output' }, resultat(), ...(store.tilstand.resultat && !store.tilstand.resultat.ok && store.tilstand.resultat.kombinationer.length ? [forslagSektion()] : []), tegning(), diagnostik())));
    const nyOutput = rod.querySelector('.output');
    if (nyOutput) nyOutput.scrollTop = outputTop;
    window.scrollTo(sideX, sideY);
    if (fokusIdx >= 0) Array.from(rod.querySelectorAll<HTMLElement>(faelles))[fokusIdx]?.focus({ preventScroll: true });
    if (fokus) {
      const n = rod.querySelector<HTMLElement>(`[data-felt="${CSS.escape(fokus)}"]`);
      n?.focus({ preventScroll: true });
      if (n instanceof HTMLInputElement && sel && sel[0] != null) n.setSelectionRange(sel[0], sel[1] ?? sel[0]);
    }
  };

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t?.tagName === 'TEXTAREA' || t?.classList?.contains('maalinput')) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { if (store.fortryd()) e.preventDefault(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { if (store.gentag()) e.preventDefault(); }
  });

  setTimeout(() => { void tjekVersion(); }, 0);
  setInterval(() => { void tjekVersion(); }, 600000);

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
        h('button', { title: 'Fortryd (Ctrl+Z)', 'data-fortryd': '1', disabled: !store.kanFortryde, onclick: () => { store.fortryd(); } }, '↶ Fortryd'),
        h('button', { title: 'Gentag (Ctrl+Y)', 'data-gentag': '1', disabled: !store.kanGentage, onclick: () => { store.gentag(); } }, '↷ Gentag'),
        h('button', { onclick: () => {
          const a = h('a', { href: URL.createObjectURL(new Blob([store.tilJson()], { type: 'application/json' })), download: 'anker-projekt.json' });
          a.click(); URL.revokeObjectURL(a.href);
        } }, 'Gem'),
        h('button', { class: 'primaer', onclick: () => {
          const html = rapportHtml(store.tilstand.model, store.tilstand.resultat, build, undefined, { ligninger: medLigninger, detalje: beregningsdetalje });
          const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
          const w = window.open(url, '_blank');
          if (!w) { const a = h('a', { href: url, download: 'anker-rapport.html' }); a.click(); }
        } }, 'Rapport'),
        h('label', { class: 'adv', title: 'Tag ligninger med i rapporten: formler, normhenvisninger og indsatte værdier pr. brudform' }, h('input', { type: 'checkbox', 'data-rapport-ligninger': '1', checked: medLigninger, onchange: (e: Event) => { medLigninger = (e.target as HTMLInputElement).checked; try { localStorage.setItem('rapport.ligninger', medLigninger ? '1' : '0'); } catch { /* ingen lagring */ } } }), ' Med ligninger'),
        h('button', { title: 'Kopiér en kort tekstrapport til udklipsholderen', onclick: () => { void kopierRapport(); } }, 'Kopiér rapport'),
        h('button', { onclick: indsaetDialog }, 'Indsæt JSON'),
        h('button', { title: 'Skift mellem system, mørkt og lyst tema', onclick: () => { tema = naesteTema(tema); saetTema(tema); draw(); } }, TEMA_NAVN[tema]),
        h('button', { onclick: omDialog }, 'Om'),
        h('button', { class: 'ajour', 'data-state': ajour.tilstand, onclick: ajourDialog }, ajour.etiket),
        h('label', { class: 'adv' }, h('input', { type: 'checkbox', checked: avanceret, onchange: (e: Event) => { avanceret = (e.target as HTMLInputElement).checked; draw(); } }), ' Avanceret'),
        h('span', { class: 'build' }, `build ${build}`)),
      store.tilstand.fejl && h('div', { class: 'fejlbanner', role: 'alert' }, store.tilstand.fejl),
      store.tilstand.afvist.length > 0 && h('div', { class: 'advarselbanner' }, `${store.tilstand.afvist.length} værdier blev afvist ved indlæsning (standardværdi brugt): ${store.tilstand.afvist.map((a) => a.felt).join(', ')}`));
  }

  const ETA_FELTER = new Set(['anker.cmin', 'anker.smin', 'anker.hmin', 'anker.dnom', 'anker.ccrN', 'anker.ccrSp', 'anker.k7', 'anker.k8']);
  const erEtaProdukt = (m: Model) => typeof m.anker.produkt === 'string' && m.anker.produkt.includes('ETA');
  function felt(f: FeltDef, m: Model): HTMLElement | null {
    if (f.show && !f.show(m)) return null;
    if (f.adv && !avanceret) return null;
    const v = laesSti(m, f.k);
    const fejl = store.tilstand.feltfejl[f.k];
    const dis = f.disabled?.(m) ?? null;
    let std = f.std && (v == null || v === '') ? f.std(m) : '';
    if (std && erEtaProdukt(m) && ETA_FELTER.has(f.k)) std = std.replace(/^std\./, 'ETA');
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
    // ankerarmeringens indstillinger ligger i en gruppe, der kan foldes ud/ind uden at armeringen slås til eller fra
    let grp: 'T' | 'V' | null = null, grpNoder: Node[] = [];
    const luk = () => {
      if (grp && grpNoder.length) ud.push(h('div', { class: `armgruppe ${m.beton.armering[grp === 'T' ? 'ankerarmeringTraek' : 'ankerarmeringForskydning'].aktiv ? '' : 'dimmet'}` }, ...grpNoder));
      grp = null; grpNoder = [];
    };
    for (const f of s.fields ?? ([] as Felt[])) {
      if ('sub' in f && (f.sub === 'Ankerarmering for forskydning' || f.sub === 'Ankerarmering for træk')) { luk(); }
      if ('k' in f && (f.k === 'beton.armering.ankerarmeringTraek.aktiv' || f.k === 'beton.armering.ankerarmeringForskydning.aktiv')) {
        const g = f.k.includes('Traek') ? 'T' : 'V';
        const n = felt(f, m); if (n) ud.push(n);
        ud.push(h('button', { type: 'button', class: 'armvis', 'data-armvis': g, 'aria-expanded': String(armUdvid[g]), onclick: () => { saetArmUdvid(g, !armUdvid[g]); draw(); } }, armUdvid[g] ? '▾ Skjul indstillinger' : '▸ Vis indstillinger'));
        grp = g; continue;
      }
      if (grp && !('k' in f) && 'sub' in f && f.sub && !f.sub.startsWith('Forudsætninger')) luk();
      const mal: Node[] = grp ? grpNoder : ud;
      if ('k' in f && grp) { const n = felt(f, m); if (n) mal.push(n); continue; }
      if ('k' in f) { const n = felt(f, m); if (n) ud.push(n); }
      else if ('custom' in f) {
        if (f.show && !f.show(m)) continue;
        if (f.custom === 'edges') ud.push(h('div', { class: 'gruppe' }, ...KANTFELTER.map((k) => felt(k, m))), betonBlok(m));
        else if (f.custom === 'layout') ud.push(opstilling(m));
        else if (f.custom === 'armsum') {
          const kr = store.tilstand.resultat?.kombinationer[store.tilstand.valgtKombination ?? 0]?.resultat;
          const lin = f.which === 'T' ? oversigtTraek(m, kr?.armT ?? null) : oversigtForskydning(m, kr?.armV ?? null);
          if (lin.length) mal.push(h('div', { class: 'note armsum' }, ...lin.map((x) => h('div', {}, x))));
        }
        else if (f.custom === 'pladeTilpas') {
          const t = tilpasPlade(m.opstilling.anker, hulfrigangsDiameter(m.anker.d), m.plade.bx, m.plade.by);
          ud.push(h('div', { class: 'note' }, 'Boltene har for lidt kant til fodpladen. ', h('button', { type: 'button', title: 'Forstørrer pladen, så alle bolte har mindst 1,2·d0 fra hulkant til pladekant', onclick: () => store.aendr((mm) => { const n = tilpasPlade(mm.opstilling.anker, hulfrigangsDiameter(mm.anker.d), mm.plade.bx, mm.plade.by); mm.plade.bx = n.bx; mm.plade.by = n.by; }) }, `Tilpas plade til boltene (${t.bx} × ${t.by} mm)`)));
        }
        else if (f.custom === 'naReset') ud.push(h('button', { onclick: () => store.aendr((mm) => { mm.indstillinger = standardModel().indstillinger; }) }, 'Nulstil til DK NA-standard'));
      } else if ('sub' in f || 'note' in f) {
        if (f.show && !f.show(m)) continue;
        if (f.adv && !avanceret) continue;
        mal.push(f.sub ? h('h4', {}, f.sub) : h('p', { class: 'note' }, f.note));
      }
    }
    luk();
    return ud;
  }

  /** Samme kantafstande set som ren geometri: blokkens mål og referencepunktets forskydning fra midten. Begge visninger læser og skriver de samme fire kantafstande, så de kan ikke modsige hinanden. */
  function betonBlok(m: Model): HTMLElement {
    const kt = m.beton.kanter as Record<string, number | null>;
    const tal = (t: string) => { const x = Number(t.replace(',', '.')); return t.trim() !== '' && Number.isFinite(x) ? x : null; };
    const vis = (v: number | null) => (v == null ? '' : String(Math.round(v * 10) / 10).replace('.', ','));
    const akse = (a: 'x' | 'y') => {
      const n = kt[a + 'Neg'] ?? null, p = kt[a + 'Pos'] ?? null, begge = n != null && p != null;
      const B = begge ? n! + p! : null, sh = begge ? (n! - p!) / 2 : 0;
      const saet = (nyB: number | null, nyS: number) => store.aendr((mm) => {
        const k = mm.beton.kanter as Record<string, number | null>;
        if (nyB == null || nyB <= 0) { k[a + 'Neg'] = null; k[a + 'Pos'] = null; return; }
        k[a + 'Neg'] = Math.round((nyB / 2 + nyS) * 10) / 10; k[a + 'Pos'] = Math.round((nyB / 2 - nyS) * 10) / 10;
      });
      return [
        h('label', { class: 'felt' }, h('span', {}, `Betonens udstrækning i ${a}`), h('input', { type: 'text', inputmode: 'decimal', placeholder: begge ? '' : 'ubegrænset', value: vis(B), onchange: (e: Event) => saet(tal((e.target as HTMLInputElement).value), sh) }), h('span', { class: 'enhed' }, 'mm')),
        h('label', { class: 'felt' }, h('span', {}, `Referencepunkt fra midten, ${a}`), h('input', { type: 'text', inputmode: 'decimal', disabled: !begge, value: vis(sh), onchange: (e: Event) => { const v = tal((e.target as HTMLInputElement).value); if (v != null && B != null) saet(B, v); } }), h('span', { class: 'enhed' }, 'mm')),
      ];
    };
    return h('div', { class: 'gruppe' }, h('h4', {}, 'Eller angiv betonens geometri'),
      h('p', { class: 'note' }, 'Samme oplysninger som kantafstandene ovenfor, blot som blokkens mål. Ændres det ene, opdateres det andet. Positiv forskydning: referencepunktet ligger tættere på +kanten. Tom udstrækning = ingen kant (fri).'),
      ...akse('x'), ...akse('y'));
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
      h('button', { type: 'button', title: 'Drejer bolte og fodplade 90° mod uret om referencepunktet (lasterne er globale og drejes ikke)', onclick: () => store.aendr((mm) => { mm.opstilling = drejOpstilling90(mm.opstilling); const bx = mm.plade.bx; mm.plade.bx = mm.plade.by; mm.plade.by = bx; }) }, '⟲ Drej opstilling 90°'),
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
      s.custom === 'layout' ? [opstilling(m)] : s.custom === 'loads' ? [laster(m)] : [...(s.id === 'anker' ? [produktPraeset()] : []), ...fraSkema(s, m)], s.id === 'anker' || s.id === 'laster'));
  }

  type Valg = 'ingen' | 'hilti' | 'eget';
  let produktValg: Valg = 'ingen';
  let egneProdukter = laesEgneProdukter();
  let valgtEget = '';
  let praeset: { d: Stoerrelse; t: Temperaturomraade; hul: Borehul } = { d: 12, t: 'I', hul: 'toert-vaadt' };
  let nytNavn = '';
  function produktPraeset(): HTMLElement {
    const vaelg = <T extends string | number>(label: string, vaerdier: [T, string][], aktuel: T, saet: (v: string) => void) =>
      h('label', {}, label, ' ', h('select', { onchange: (e: Event) => saet((e.target as HTMLSelectElement).value) },
        ...vaerdier.map(([v, tekst]) => h('option', { value: String(v), selected: v === aktuel }, tekst))));
    const anvendHilti = () => store.aendr((mm) => {
      anvendHiltiModel(mm, praeset.d, praeset.t, praeset.hul);
    });
    const valgListe: [Valg, string][] = [['ingen', 'Vælg produkt …'], ['hilti', 'Hilti HIT-HY 200 V3 (indlimet, ETA-19/0601)'], ['eget', 'Mine produkter / anden leverandør']];
    const felter: Node[] = [];
    if (produktValg === 'hilti') {
      felter.push(
        vaelg('Gevind', STOERRELSER.map((d) => [d, `M${d}`] as [Stoerrelse, string]), praeset.d, (v) => { praeset.d = Number(v) as Stoerrelse; }),
        vaelg('Temperaturområde', [['I', 'I (24/40 °C)'], ['II', 'II (50/80 °C)'], ['III', 'III (72/120 °C)']] as [Temperaturomraade, string][], praeset.t, (v) => { praeset.t = v as Temperaturomraade; }),
        vaelg('Borehul', [['toert-vaadt', 'Tørt/vådt'], ['vandfyldt', 'Vandfyldt']] as [Borehul, string][], praeset.hul, (v) => { praeset.hul = v as Borehul; }),
        h('button', { onclick: anvendHilti }, 'Anvend'));
    } else if (produktValg === 'eget') {
      if (egneProdukter.length) {
        if (!egneProdukter.some((p) => p.navn === valgtEget)) valgtEget = egneProdukter[0]!.navn;
        felter.push(
          vaelg('Mit produkt', egneProdukter.map((p) => [p.navn, p.navn] as [string, string]), valgtEget, (v) => { valgtEget = v; }),
          h('button', { onclick: () => { const p = egneProdukter.find((x) => x.navn === valgtEget); if (p) store.aendr((mm) => { for (const [sti, v] of produktOpdateringer(p.vaerdier)) saetSti(mm, sti, v); }); } }, 'Anvend'),
          h('button', { onclick: () => { egneProdukter = sletEgetProdukt(valgtEget, egneProdukter); draw(); } }, 'Slet'));
      }
      felter.push(h('label', {}, 'Gem aktuelle produktdata som ', h('input', { type: 'text', value: nytNavn, placeholder: 'fx Leverandør – produkt', oninput: (e: Event) => { nytNavn = (e.target as HTMLInputElement).value; } })),
        h('button', { onclick: () => {
          const navn = nytNavn.trim();
          if (!navn) return;
          egneProdukter = gemEgetProdukt({ navn, vaerdier: produktFraAnker(store.tilstand.model.anker) }, egneProdukter);
          valgtEget = navn; nytNavn = ''; draw();
        } }, 'Gem'));
    }
    return h('div', { class: 'praeset' },
      h('b', {}, 'Produkt og leverandør'),
      h('div', { class: 'praesetvalg' },
        vaelg('Produkt', valgListe, produktValg, (v) => { produktValg = v as Valg; draw(); }), ...felter),
      h('p', { class: 'note' }, produktValg === 'hilti'
        ? 'Sætter d, d0, hef-interval, smin, cmin, τRk,cr/ucr (C20/25), ψ⁰sus, kcr/kucr og γinst fra ETA\'en. ψc beregnes som (fck/20)^0,1 (rundet ned) for den aktuelle betonklasse; tryk Anvend igen, hvis betonklassen ændres. Stålklasse og hef vælges selv.'
        : produktValg === 'eget'
          ? 'Anden leverandør: indtast værdierne fra produktets ETA i felterne nedenfor, og gem dem her som dit eget produkt, så de kan genbruges. Dine produkter gemmes kun i denne browser.'
          : 'Vælg et produkt for at udfylde produktdata fra ETA\'en, eller indtast værdierne selv i felterne nedenfor.'));
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
        h('tbody', {}, ...rk.map((b) => h('tr', { class: `${b.id === k.styrendeBrudform ? 'styrende' : ''} valgbar ${b.id === valgtBrud ? 'valgt' : ''}`, tabindex: '0', title: 'Klik for at se brudformen i 3D og beregningen', 'data-brud': b.id,
          onclick: () => { valgtBrud = valgtBrud === b.id ? null : b.id; if (valgtBrud) visning = '3d'; draw(); },
          onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); valgtBrud = valgtBrud === b.id ? null : b.id; if (valgtBrud) visning = '3d'; draw(); } } },
          h('td', {}, h('code', {}, b.id), ' ', BRUDFORM[b.id] ?? ''),
          h('td', {}, b.Ed ? kN(b.Ed) : ''), h('td', {}, b.Rd ? kN(b.Rd) : ''),
          h('td', {}, h('div', { class: 'bar' }, h('div', { class: `fyld ${b.udnyttelse! > 1 ? 'over' : ''}`, style: `width:${Math.min(100, b.udnyttelse! * 100)}%` }), h('span', {}, proc(b.udnyttelse)))))))), detaljePanel(k.resultat, rk));
  }

  function detaljePanel(kr: NonNullable<typeof store.tilstand.resultat>['kombinationer'][number]['resultat'], rk: Brudform[]): Node | null {
    if (!valgtBrud || !rk.some((b) => b.id === valgtBrud)) return null;
    const dt = beregningsdetalje(valgtBrud, store.tilstand.model, kr);
    if (!dt) return null;
    return h('div', { class: 'brudpanel' },
      h('h3', {}, dt.titel), h('div', { class: 'ref' }, dt.ref),
      h('table', { class: 'trin' }, ...dt.trin.map((x) => h('tr', {}, h('td', { html: x.s }), h('td', { class: 'formel', html: x.f ?? '' }), h('td', { class: 'vaerdi', html: x.v })))),
      ...dt.noter.map((n) => h('p', { class: 'note', html: n })),
      h('p', { class: 'note' }, IDEALISERET),
      h('button', { onclick: () => { valgtBrud = null; draw(); } }, 'Fjern valg'));
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

  let visning: 'plan' | 'snit' | '3d' = 'plan';
  let snitAkse: SnitAkse = 'x';
  let scene3d: Scene3D | null = null;
  let visBrud = false;
  let valgtBrud: string | null = null;
  let visMaal = true;
  let visLast = true;
  const KAMERAER: [Kamera, string][] = [['iso', 'Iso'], ['top', 'Oppefra'], ['front', 'Forfra'], ['side', 'Fra siden']];

  function tegning(): HTMLElement {
    const t = store.tilstand;
    const kom = t.resultat ? t.resultat.kombinationer[t.valgtKombination ?? 0] ?? null : null;
    const k = kom?.resultat ?? null;
    const knap = (v: 'plan' | 'snit' | '3d', txt: string) => h('button', { class: visning === v ? 'aktiv' : '', 'data-view': v, onclick: () => { visning = v; draw(); } }, txt);
    const sek = h('section', { class: 'res' }, h('h2', {}, visning === 'plan' ? 'Plantegning' : visning === 'snit' ? 'Snit' : '3D-model'), h('div', { class: 'visningsvalg' }, knap('plan', 'Plan'), knap('snit', 'Snit'), knap('3d', '3D')));
    if (visning === 'plan') {
      sek.append(h('div', { class: 'planbox', html: plantegningSvg(t.model, k) }), h('p', { class: 'note' }, PLAN_FORKLARING));
      return sek;
    }
    if (visning === 'snit') {
      const ak = (a: SnitAkse) => h('button', { class: snitAkse === a ? 'aktiv' : '', 'data-snit': a, onclick: () => { snitAkse = a; draw(); } }, `Langs ${a}`);
      sek.append(h('div', { class: 'visningsvalg' }, ak('x'), ak('y')), h('div', { class: 'planbox snitbox', html: snitSvg(t.model, snitAkse) }),
        h('p', { class: 'note' }, 'Lodret snit gennem boltene. Bolte uden for snitlinjen er vist svagt. hef, kantafstand c og pladetykkelse h er målsat.'));
      return sek;
    }
    try {
      scene3d ??= opret3D({
        kanRettes: (felt) => { const r = maalRedigerbarhed(store.tilstand.model, felt); return r.ok ? null : r.hvorfor; },
        ret: (felt, v) => {
          const ki = store.tilstand.valgtKombination ?? 0;
          if (!anvendMaal(structuredClone(store.tilstand.model), felt, v, ki)) return false;
          store.aendr((mm) => { anvendMaal(mm, felt, v, ki); });
          return true;
        },
      });
      const b = byg3d(t.model, k, kom ? { ...kom.last } as unknown as Record<string, number> : null, visBrud, visMaal, visLast, valgtBrud);
      scene3d.opdater(b);
      sek.append(
        h('div', { class: 'visningsvalg' }, ...KAMERAER.map(([id, navn]) => h('button', { 'data-kamera': id, onclick: () => scene3d!.saetKamera(id) }, navn)), h('button', { class: visLast ? 'aktiv' : '', 'data-kraefter': '1', onclick: () => { visLast = !visLast; draw(); } }, 'Kræfter'), h('button', { class: visMaal ? 'aktiv' : '', 'data-maal': '1', onclick: () => { visMaal = !visMaal; draw(); } }, 'Mål'), h('button', { class: visBrud ? 'aktiv' : '', 'data-brud': '1', onclick: () => { visBrud = !visBrud; draw(); } }, 'Brudlegeme')),
        scene3d.element,
        h('div', { class: 'forklaring3d' }, ...b.forklaring.map((f) => h('span', {}, h('i', { style: `background:${({ beton: '#aab0ba', staal: '#2c323b', last: '#7c3aed', plade: '#6e7684', armering: '#b45309', inaktiv: '#9ca3af', forankring: '#f59e0b', tilbehoer: '#0f766e', zone: '#b45309', brud: '#dc2626' } as Record<string, string>)[f.farve] ?? '#888'}` }), f.tekst))),
        h('p', { class: 'note' }, 'Træk for at dreje, scroll for at zoome. Klik på et mål eller en last for at rette den (Enter anvender, Esc fortryder). Betonen er gennemsigtig; lasterne er vist med deres fortegn.'));
    } catch {
      sek.append(h('p', { class: 'note' }, '3D-visning kræver WebGL, som ikke er tilgængelig i denne browser.'));
    }
    return sek;
  }

  function diagnostik(): HTMLElement {
    const ds: Diagnostik[] = store.tilstand.diagnostik;
    return h('section', { class: 'diag' }, h('h2', {}, `Bemærkninger (${ds.length})`),
      h('ul', {}, ...ds.map((d) => h('li', { class: d.niveau, onclick: () => d.felt && rod.querySelector<HTMLElement>(`[data-felt="${CSS.escape(d.felt)}"]`)?.focus() },
        h('b', {}, d.niveau === 'fejl' ? 'Fejl' : d.niveau === 'advarsel' ? 'Advarsel' : 'Info'), ' ', tekst(d), d.paragraf && h('span', { class: 'ref' }, ` ${d.paragraf}`)))));
  }

  // Tegn efter at fokus er flyttet (Tab): en synkron gentegning midt i blur/change ville smide fokus tilbage på det forrige felt
  let tegnTimer = 0;
  store.subscribe(() => { if (tegnTimer) return; tegnTimer = window.setTimeout(() => { tegnTimer = 0; draw(); }, 0); });
  draw();
}

function sessionStorageGet(id: string): boolean { try { return sessionStorage.getItem('sek-' + id) === '1'; } catch { return false; } }
function sessionStorageSet(id: string, v: boolean): void { try { sessionStorage.setItem('sek-' + id, v ? '1' : '0'); } catch { /* ingen lagring */ } }
