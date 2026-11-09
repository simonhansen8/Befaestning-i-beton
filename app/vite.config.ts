import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execSync } from 'node:child_process';

// APP_BUILD = ÅÅÅÅ-MM-DD.N, hvor N = antal commits på main-historikken denne dag (+ 1 for ikke-committet bygning).
// Kan overstyres med miljøvariablen APP_BUILD (fx i CI).
function appBuild(): string {
  if (process.env.APP_BUILD) return process.env.APP_BUILD;
  const day = new Date().toISOString().slice(0, 10);
  let n = 1;
  try {
    const out = execSync(`git log --since="${day}T00:00:00Z" --format=%h`, { encoding: 'utf8' }).trim();
    n = out ? out.split('\n').length : 0;
    n += 1;
  } catch { /* ingen git */ }
  return `${day}.${n}`;
}

export default defineConfig({
  root: import.meta.dirname,
  plugins: [viteSingleFile()],
  define: { __APP_BUILD__: JSON.stringify(appBuild()) },
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
  test: { include: ['src/**/*.test.ts'] },
});
