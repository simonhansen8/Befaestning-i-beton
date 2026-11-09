// Regressionstest mod facit-sættet (cases.json). Alle modeller genberegnes og sammenlignes tal for tal.
// Under genopbygningen er facit = den gamle kernes output; ny kerne skal give samme tal (tolerance 1e-9 relativt).
// GOLDEN_FULL=1 kører alle modeller; ellers hver 6. (hurtig CI).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openEngine } from '../tests/lib/engine.mjs';

const G = JSON.parse(fs.readFileSync(new URL('./cases.json', import.meta.url)));
const full = !!process.env.GOLDEN_FULL;
let e; before(async () => { e = await openEngine(); }); after(async () => { await e?.close(); });
const close = (a, b) => (a == null && b == null) || (Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)) : a === b);

test(`facit: ${full ? 'alle' : 'hver 6.'} model(ler) giver uændrede resultater`, async () => {
  const bad = [];
  for (const c of G.cases) {
    if (!full && c.id % 6) continue;
    const o = await e.load(c.model), r = o.result, g = c.resultat;
    if (o.tilstand !== g.tilstand) { bad.push(`#${c.id} tilstand ${o.tilstand} != ${g.tilstand}`); continue; }
    if (!r) continue;
    if (!close(r.maksUdnyttelse, g.maksUdnyttelse) || r.styrendeBrudform !== g.styrendeBrudform) bad.push(`#${c.id} maks ${r.maksUdnyttelse} (${r.styrendeBrudform}) != ${g.maksUdnyttelse} (${g.styrendeBrudform})`);
    for (const x of g.eftervisninger) {
      const y = r.eftervisninger.find(z => z.id === x.id);
      for (const k of ['NEd', 'NRd', 'NRk', 'VEd', 'VRd', 'VRk', 'udnyttelse']) if (!y || !close(y[k], x[k])) { bad.push(`#${c.id} ${x.id}.${k} ${y?.[k]} != ${x[k]}`); break; }
    }
  }
  assert.deepEqual(bad, []);
});
