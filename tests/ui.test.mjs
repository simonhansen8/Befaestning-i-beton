// Røgtest af brugerfladen: indlæsning, faner, 2D/3D, rapport, JSON-rundtur, fejlvisning.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openEngine } from './lib/engine.mjs';

let E, p;
before(async () => { E = await openEngine(); p = E.page; });
after(async () => { await E.close(); });

test('ingen JavaScript-fejl ved indlæsning, resultatchip og resultater vises', async () => {
  assert.deepEqual(E.pageErrors, []);
  assert.ok((await p.textContent('#results')).trim().length > 200, 'resultatpanel er tomt');
  assert.ok((await p.textContent('#verdict-chip')).trim().length > 0, 'samlet resultat mangler');
  assert.ok((await p.locator('#panels details, #panels section').count()) > 3, 'inputpaneler mangler');
});

test('2D-snit (SVG) tegnes med et element pr. anker', async () => {
  await p.click('#views [data-view="plan"]');
  const n = await p.locator('#pane-2d svg.plan').count();
  assert.equal(n, 1);
  assert.ok((await p.locator('#pane-2d svg.plan *').count()) > 20);
});

test('3D-visning: canvas oprettes og tegner pixels i alle kameravinkler', async () => {
  await p.click('#views [data-view="3d"]');
  await p.waitForSelector('#pane-3d canvas');
  for (const cam of ['iso', 'top', 'front', 'side', 'arm']) {
    await p.click(`#cams [data-cam="${cam}"]`);
    await p.waitForTimeout(250);
    const shot = await p.locator('#pane-3d canvas').screenshot();
    // et tomt (ensfarvet) billede ville give én unik farve; forvent mange
    const distinct = await p.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = Math.min(img.width, 200); c.height = Math.min(img.height, 200);
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height).data; const s = new Set();
      for (let i = 0; i < d.length; i += 4) s.add((d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3));
      return s.size;
    }, shot.toString('base64'));
    assert.ok(distinct > 8, `3D-visning "${cam}" ser tom ud (${distinct} farver)`);
  }
  assert.deepEqual(E.pageErrors, []);
});

test('delt visning og temaskift virker', async () => {
  await p.click('#views [data-view="delt"]');
  for (const t of ['lys', 'moerk', 'auto']) { await p.click(`#theme [data-theme="${t}"]`); }
  assert.deepEqual(E.pageErrors, []);
});

test('rapportside: dannes med beregningstrin og kan åbnes/lukkes', async () => {
  await p.click('#page [data-page="rapport"]');
  await p.waitForTimeout(200);
  const txt = await p.textContent('#report');
  assert.ok(txt.length > 1500, 'rapporten er for kort');
  assert.match(txt, /EN 1992-4/);
  assert.match(txt, /Betonkeglebrud/);
  await p.click('#back-calc');
  assert.equal(await p.getAttribute('#app', 'data-page'), 'beregning');
});

test('JSON-rundtur: model → JSON → indlæs giver identisk resultat', async () => {
  const a = await E.load(E.baseModel);
  const b = await E.load(JSON.parse(JSON.stringify(a.model)));
  assert.equal(b.tilstand, 'ok');
  assert.equal(b.result.maksUdnyttelse, a.result.maksUdnyttelse);
  assert.equal(b.result.styrendeBrudform, a.result.styrendeBrudform);
});

test('ugyldig model giver fejlliste og ingen rapport – ikke et stille resultat', async () => {
  const m = JSON.parse(JSON.stringify(E.baseModel)); m.plade.bx = 50; m.plade.by = 50;
  const o = await E.load(m);
  assert.equal(o.tilstand, 'ugyldig');
  assert.ok(o.fejl.length > 0);
  await p.click('#page [data-page="rapport"]');
  assert.match(await p.textContent('#report'), /Rapporten kan ikke dannes/);
  await p.click('#back-calc');
});

test('indtastning i hef-feltet ændrer resultatet (felt → kerne → visning)', async () => {
  await E.load(E.baseModel);
  const set = (v) => p.evaluate((v) => { const f = document.querySelector('#f-anker_hef'); f.value = v; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); return window.__anker.model.anker.hef; }, v);
  const before = await p.evaluate(() => window.__anker.result.eftervisninger.find((e) => e.id === 'N_c').NRk);
  assert.equal(await set('220'), 220);
  await p.waitForFunction(() => window.__anker.result.eftervisninger.find((e) => e.id === 'N_c').NRk !== undefined && window.__anker.model.anker.hef === 220);
  await p.waitForTimeout(400);
  const after = await p.evaluate(() => window.__anker.result.eftervisninger.find((e) => e.id === 'N_c').NRk);
  assert.notEqual(after, before, 'NRk,c skal ændres når hef ændres');
  assert.ok((await p.textContent('#results')).length > 200);
});

test('skæve værdier i felter giver ikke JavaScript-fejl', async () => {
  await E.load(E.baseModel);
  for (const v of ['', '-5', '1e999', 'abc', '0', '99999999']) {
    await p.evaluate((v) => { const f = document.querySelector('#f-anker_hef'); f.value = v; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  }
  assert.deepEqual(E.pageErrors, []);
});
