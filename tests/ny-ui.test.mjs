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

test('ny UI: indlæses, regner og reagerer på feltændring', { skip: !fs.existsSync(DIST) && 'index.html mangler' }, async () => {
  const browser = await chromium.launch();
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
  const browser = await chromium.launch();
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
