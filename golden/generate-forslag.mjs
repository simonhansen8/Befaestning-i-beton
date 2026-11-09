// Genererer facit for justeringsforslag fra den gamle app (arkiv/gammel-index.html): klikker "Foreslå justeringer"
// for et udvalg af overbelastede modeller og gemmer rækkerne. Kør: NODE_PATH=... node golden/generate-forslag.mjs
import fs from 'node:fs';
import { openEngine } from '../tests/lib/engine.mjs';

const G = JSON.parse(fs.readFileSync(new URL('./cases.json', import.meta.url)));
const udvalg = G.cases.filter((c) => c.resultat.tilstand === 'ok' && c.resultat.maksUdnyttelse > 1.02 && c.resultat.maksUdnyttelse < 20).slice(0, 25);
const e = await openEngine();
const ud = [];
for (const c of udvalg) {
  // K_FI indgår ikke længere i kernen (lasterne er designværdier): sammenlign uden K_FI.
  const mod = structuredClone(c.model); mod.indstillinger.kfiPaaLaster = false;
  const o = await e.load(mod);
  if (o.tilstand !== 'ok') continue;
  const rows = await e.page.evaluate(async () => {
    const b = document.querySelector('[data-zq="run"]');
    if (!b) return null;
    b.click();
    for (let i = 0; i < 400 && !document.querySelector('.zq-i'); i++) await new Promise((r) => setTimeout(r, 50));
    return [...document.querySelectorAll('.zq-r')].map((li) => ({ del: li.classList.contains('part'), tekst: li.innerText }));
  });
  ud.push({ id: c.id, model: o.model, rows });
}
await e.close();
fs.writeFileSync(new URL('./forslag-cases.json', import.meta.url), JSON.stringify({ app: 'arkiv/gammel-index.html', cases: ud }));
console.log(ud.length, 'modeller;', ud.filter((x) => x.rows).length, 'med forslag');
