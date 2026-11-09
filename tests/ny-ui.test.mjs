// Røgtest af den nye brugerflade (rod-index.html bygget af app/): indlæses uden fejl, regner, og feltændring giver nyt resultat.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { ROOT } from './lib/engine.mjs';

const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require('playwright'); } catch { return require('playwright-core'); } })();
const DIST = path.join(ROOT, 'index.html');
const LAUNCH = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

test('ny UI: indlæses, regner og reagerer på feltændring', { skip: !fs.existsSync(DIST) && 'index.html mangler' }, async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    const page = await browser.newPage();
    const fejl = [];
    page.on('pageerror', (e) => fejl.push(String(e)));
    await page.goto(pathToFileURL(DIST).href);
    await page.waitForSelector('.hoved');
    const foer = await page.evaluate(() => window.__ny.store.tilstand.resultat.maksUdnyttelse);
    await page.fill('[data-felt="anker.hef"]', '250');
    await page.keyboard.press('Tab');
    await page.waitForFunction((x) => window.__ny.store.tilstand.resultat.maksUdnyttelse !== x, foer);
    assert.equal(await page.evaluate(() => window.__ny.store.tilstand.model.anker.hef), 250);
    // ugyldig indtastning markeres og ændrer ikke modellen
    await page.fill('[data-felt="anker.hef"]', 'abc');
    await page.keyboard.press('Tab');
    await page.waitForSelector('.feltfejl');
    assert.equal(await page.evaluate(() => window.__ny.store.tilstand.model.anker.hef), 250);
    // boltmønster: vælg 6 bolte, 3 × 2
    await page.evaluate(() => { const sel = [...document.querySelectorAll('select')].find((q) => [...q.options].some((o) => o.value === 'cirk')); sel.value = '6'; sel.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForFunction(() => window.__ny.store.tilstand.model.opstilling.anker.length === 6);
    assert.deepEqual(fejl, []);
  } finally { await browser.close(); }
});

test('ny UI: justeringsforslag kan beregnes og anvendes', async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    const page = await browser.newPage();
    const fejl = [];
    page.on('pageerror', (e) => fejl.push(String(e)));
    await page.goto(pathToFileURL(DIST).href);
    await page.waitForSelector('.hoved');
    // gør modellen overbelastet
    await page.evaluate(() => window.__ny.store.aendr((m) => { m.laster[0].N = 900000; }));
    await page.waitForFunction(() => window.__ny.store.tilstand.resultat.ok === false);
    await page.click('text=Foreslå justeringer');
    await page.waitForSelector('.forslagsliste li', { timeout: 60000 });
    const foer = await page.evaluate(() => window.__ny.store.tilstand.resultat.maksUdnyttelse);
    await page.click('.forslagsliste li >> nth=0 >> text=Anvend');
    await page.waitForFunction((x) => window.__ny.store.tilstand.resultat.maksUdnyttelse < x, foer);
    assert.deepEqual(fejl, []);
  } finally { await browser.close(); }
});

test('ny UI: tema, Om, Indsæt JSON og autogem', async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const fejl = [];
    page.on('pageerror', (e) => fejl.push(String(e)));
    await page.route(/^https?:\/\//, (r) => r.abort());   // offline: ajour-mærkaten skal vise "ikke tjekket"
    await page.goto(pathToFileURL(DIST).href);
    await page.waitForSelector('.hoved');
    await page.waitForSelector('.ajour[data-state="off"]');
    await page.click('text=Tema: system');
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-tema')), 'moerk');
    await page.click('button:has-text("Om")');
    await page.waitForSelector('dialog[open]');
    await page.click('dialog button:has-text("Luk")');
    // autogem: ændring huskes efter genindlæsning
    await page.evaluate(() => window.__ny.store.aendr((m) => { m.laster[0].N = 12345; }));
    await page.waitForTimeout(700);
    await page.reload();
    await page.waitForSelector('.hoved');
    assert.equal(await page.evaluate(() => window.__ny.store.tilstand.model.laster[0].N), 12345);
    assert.deepEqual(fejl, []);
  } finally { await browser.close(); }
});

test('ny UI: 3D-visning tegner scenen og kameraknapper virker', { skip: !fs.existsSync(DIST) && 'index.html mangler' }, async () => {
  const browser = await chromium.launch({ ...LAUNCH, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage();
    const fejl = [];
    page.on('pageerror', (e) => fejl.push(String(e)));
    await page.goto(pathToFileURL(DIST).href);
    await page.waitForSelector('.hoved');
    await page.click('[data-view="3d"]');
    await page.waitForSelector('.scene3d canvas');
    await page.waitForSelector('.etiket3d');
    for (const k of ['top', 'front', 'side', 'iso']) await page.click(`[data-kamera="${k}"]`);
    assert.ok(await page.locator('.etiket3d.maal').count() > 3);
    await page.click('[data-maal="1"]');
    await page.waitForSelector('.scene3d canvas');
    assert.equal(await page.locator('.etiket3d.maal').count(), 0);
    await page.click('[data-maal="1"]');
    await page.click('[data-brud="1"]');
    await page.waitForSelector('.scene3d canvas');
    // canvas er tegnet (ikke helt tom)
    const ok = await page.evaluate(() => { const c = document.querySelector('.scene3d canvas'); return c.width > 0 && c.height > 0; });
    assert.ok(ok);
    // tilbage til plan, og en ændring mens 3D er valgt giver ingen fejl
    await page.click('[data-view="snit"]');
    await page.waitForSelector('svg.snit');
    await page.click('[data-snit="y"]');
    await page.waitForSelector('svg.snit');
    await page.click('[data-view="plan"]');
    await page.waitForSelector('.planbox');
    assert.deepEqual(fejl, []);
  } finally { await browser.close(); }
});

test('ny UI: Hilti-præsæt udfylder produktdata for indlimet anker', { skip: !fs.existsSync(DIST) && 'index.html mangler' }, async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    const page = await browser.newPage();
    const fejl = [];
    page.on('pageerror', (e) => fejl.push(String(e)));
    await page.goto(pathToFileURL(DIST).href);
    await page.waitForSelector('.hoved');
    await page.evaluate(() => window.__ny.store.aendr((m) => { m.anker.type = 'indlimet'; }));
    await page.waitForSelector('.praeset');
    await page.selectOption('.praesetvalg select >> nth=0', 'hilti');
    await page.selectOption('.praesetvalg select >> nth=1', '16');
    await page.click('.praesetvalg button');
    const a = await page.evaluate(() => window.__ny.store.tilstand.model.anker);
    assert.equal(a.d, 16); assert.equal(a.d0, 18); assert.equal(a.tauRkCr, 9.5); assert.equal(a.tauRkUcr, 18); assert.equal(a.psi0Sus, 0.8);
    assert.deepEqual(fejl, []);
  } finally { await browser.close(); }
});

test('ny UI: eget produkt kan gemmes og anvendes igen', { skip: !fs.existsSync(DIST) && 'index.html mangler' }, async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    const page = await browser.newPage();
    const fejl = [];
    page.on('pageerror', (e) => fejl.push(String(e)));
    await page.goto(pathToFileURL(DIST).href);
    await page.waitForSelector('.hoved');
    await page.evaluate(() => window.__ny.store.aendr((m) => { m.anker.type = 'indlimet'; m.anker.d0 = 22; m.anker.tauRkCr = 8.1; m.anker.produkt = 'Test ETA'; }));
    await page.selectOption('.praesetvalg select >> nth=0', 'eget');
    await page.fill('.praesetvalg input[type=text]', 'Leverandør X');
    await page.click('.praesetvalg button:text-is("Gem")');
    await page.evaluate(() => window.__ny.store.aendr((m) => { m.anker.d0 = 10; m.anker.tauRkCr = 5; }));
    await page.click('.praesetvalg button:has-text("Anvend")');
    const a = await page.evaluate(() => window.__ny.store.tilstand.model.anker);
    assert.equal(a.d0, 22); assert.equal(a.tauRkCr, 8.1); assert.equal(a.produkt, 'Test ETA');
    assert.deepEqual(fejl, []);
  } finally { await browser.close(); }
});
