// Genererer facit for INDLÆSNING: ru, ufuldstændige/rodede projektfiler → den gamle normaliserede model.
// Kør: NODE_PATH=/opt/node22/lib/node_modules node golden/generate-input.mjs
import { openEngine, clone } from '../tests/lib/engine.mjs';
import fs from 'node:fs';

const G = JSON.parse(fs.readFileSync(new URL('./cases.json', import.meta.url), 'utf8'));
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry32(777);
const chance = (p) => rnd() < p;
const pick = (a) => a[Math.floor(rnd() * a.length)];

function rodet(m) {
  const o = clone(m);
  delete o.meta;
  const walk = (x, sti) => {
    if (Array.isArray(x)) { x.forEach((v, i) => walk(v, sti)); return; }
    if (x == null || typeof x !== 'object') return;
    for (const k of Object.keys(x)) {
      const v = x[k];
      if (v !== null && typeof v === 'object') { walk(v, sti + '.' + k); continue; }
      if (k === 'id' || k === 'version') continue;
      const r = rnd();
      if (r < 0.08) delete x[k];
      else if (r < 0.12) x[k] = null;
      else if (r < 0.16) x[k] = '';
      else if (typeof v === 'number' && r < 0.30) x[k] = String(v).replace('.', ',');
      else if (typeof v === 'number' && r < 0.32) x[k] = pick(['abc', -5, 0, 1e9]);
      else if (typeof v === 'string' && r < 0.20) x[k] = pick(['ukendt', 'C99', 7]);
      else if (typeof v === 'boolean' && r < 0.25) x[k] = pick(['true', 'false', 1, 0, 'ja']);
    }
  };
  walk(o, '');
  if (chance(0.1)) delete o.laster;
  if (chance(0.05)) o.opstilling.anker = [];
  if (chance(0.1)) { o.beton.armering = o.beton.armering || {}; o.beton.armering.taetArmering = pick([true, false]); delete o.beton.armering.afskalning; }
  return o;
}

let E = await openEngine();
E.page.setDefaultTimeout(2500);
const ud = [];
const kilder = G.cases.filter((_, i) => i % 4 === 0);
for (const [i, c] of kilder.entries()) {
  const raa = rodet(c.model);
  let out;
  try { out = await E.load(raa); } catch (e) {
    // Appen afviste filen (dialog blokerer) – genstart og noter, at der ikke er nogen normaliseret model.
    await E.close(); E = await openEngine(); E.page.setDefaultTimeout(2500);
    ud.push({ id: i, raa, afvist: true }); continue;
  }
  ud.push({ id: i, raa, tilstand: out.tilstand, fejl: out.fejl, model: out.model });
}
await E.close();
fs.writeFileSync(new URL('./input-cases.json', import.meta.url), JSON.stringify({ antal: ud.length, cases: ud }));
console.log('skrevet', ud.length);
