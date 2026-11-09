// Bygger programmet og lægger den ene HTML-fil i roden som index.html (det er den, brugerne åbner).
// Brug:  npm run publicer -- 2026-11-09.6      (versionsnummer ÅÅÅÅ-MM-DD.N)
// Versionen gemmes i app/VERSION; uden argument bruges den. CI kontrollerer med --tjek at roden er ajour.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rod = path.join(ROOT, 'index.html'), dist = path.join(ROOT, 'dist', 'index.html');
const tjek = process.argv.includes('--tjek');
const vfil = path.join(ROOT, 'app', 'VERSION');
let version = process.argv.slice(2).find((a) => /^\d{4}-\d{2}-\d{2}\.\d+$/.test(a));
if (version && !tjek) fs.writeFileSync(vfil, version + '\n');
if (!version && fs.existsSync(vfil)) version = fs.readFileSync(vfil, 'utf8').trim();
if (!version) throw new Error('Angiv version: npm run publicer -- ÅÅÅÅ-MM-DD.N');
execSync('npx vite build --config app/vite.config.ts', { cwd: ROOT, stdio: 'inherit', env: { ...process.env, APP_BUILD: version } });
if (tjek) {
  if (!fs.existsSync(rod) || fs.readFileSync(rod, 'utf8') !== fs.readFileSync(dist, 'utf8')) {
    console.error(`index.html i roden er ikke ajour med app/ (version ${version}). Kør: npm run publicer`);
    process.exit(1);
  }
  console.log('index.html er ajour, version ' + version);
} else {
  fs.copyFileSync(dist, rod);
  console.log('index.html opdateret, version ' + version);
}
