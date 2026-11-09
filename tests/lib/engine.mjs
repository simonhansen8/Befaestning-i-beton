// Headless adgang til beregningskernen i index.html via Playwright/Chromium.
// Programmet er én samlet HTML-fil; kernen eksponeres som window.__anker.
// Vi indlæser en model præcis som en bruger ville ("Projekt → Indsæt JSON …")
// og læser det beregnede resultat tilbage. Der er INGEN ændringer i index.html.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  try { return require('playwright'); } catch {}
  try { return require('playwright-core'); } catch {}
  const g = process.env.NODE_PATH;
  if (g) for (const p of g.split(path.delimiter)) { try { return require(path.join(p, 'playwright')); } catch {} }
  throw new Error('Playwright er ikke installeret – kør "npm install" (og "npx playwright install chromium").');
}

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const HTML_URL = pathToFileURL(path.join(ROOT, 'arkiv', 'gammel-index.html')).href;

export const clone = (o) => JSON.parse(JSON.stringify(o));
export function merge(base, patch) {            // dyb merge; arrays erstattes
  if (patch === undefined) return base;
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return clone(patch);
  const out = Array.isArray(base) || base == null || typeof base !== 'object' ? {} : { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = merge(out[k], v);
  return out;
}

export async function openEngine({ width = 1600, height = 1000 } = {}) {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width, height } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) pageErrors.push(m.text()); });
  // Google Fonts er kosmetik – blokér netværk så testen er hurtig og deterministisk.
  await page.route(/^https?:\/\//, (r) => r.abort());
  await page.goto(HTML_URL);
  await page.waitForFunction(() => window.__anker && window.__anker.model);
  const baseModel = await page.evaluate(() => JSON.parse(JSON.stringify(window.__anker.model)));

  async function load(model) {
    await page.click('#menu-btn');
    await page.click('[data-menu="paste"]');
    await page.fill('#json-in', JSON.stringify(model));
    await page.click('[data-menu="json-load"]');
    await page.waitForTimeout(30);
    return page.evaluate(() => {
      const a = window.__anker;
      return JSON.parse(JSON.stringify({ model: a.model, tilstand: a.tilstand, fejl: a.fejl, result: a.result }));
    });
  }
  /** Beregn model = eksempelmodel + patch. */
  const calc = (patch) => load(merge(baseModel, patch));
  return { page, browser, baseModel, load, calc, pageErrors, close: () => browser.close() };
}

/** Slå en eftervisning op på id. */
export const ev = (out, id) => out.result?.eftervisninger?.find((e) => e.id === id);
