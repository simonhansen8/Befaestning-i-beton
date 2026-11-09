// Røgtest af den nye brugerflade (dist/index.html bygget af app/): indlæses uden fejl, regner, og feltændring giver nyt resultat.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { ROOT } from './lib/engine.mjs';

const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require('playwright'); } catch { return require('playwright-core'); } })();
const DIST = path.join(ROOT, 'dist', 'index.html');

test('ny UI: indlæses, regner og reagerer på feltændring', { skip: !fs.existsSync(DIST) && 'kør npm run build først' }, async () => {
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
    assert.deepEqual(fejl, []);
  } finally { await browser.close(); }
});
