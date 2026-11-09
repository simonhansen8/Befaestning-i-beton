// Sporbarhedstabellen er konsistent med kernen, facit og den uafhængige reference, og docs/sporbarhed.md er ajour.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { SPORBARHED, sporbarhedMarkdown } from './sporbarhed';

const kerne = new URL('./', import.meta.url);
const golden = JSON.parse(readFileSync(new URL('../../../golden/cases.json', import.meta.url), 'utf8'));
const expected = JSON.parse(readFileSync(new URL('../../../verifikation/expected.json', import.meta.url), 'utf8')) as { forventet: Record<string, number> }[];
const kildekode = readdirSync(kerne).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => readFileSync(new URL(f, kerne), 'utf8')).join('\n');
const uafhaengige = [...new Set(expected.flatMap((c) => Object.keys(c.forventet)))].sort();
const dok = new URL('../../../docs/sporbarhed.md', import.meta.url);

describe('sporbarhed', () => {
  const ider = SPORBARHED.map((s) => s.id);
  it('ingen dubletter', () => expect(new Set(ider).size).toBe(ider.length));
  it('alle brudform-id i facit-sættet er med i tabellen', () => {
    const set = new Set<string>();
    for (const c of golden.cases) for (const e of c.resultat.eftervisninger ?? []) set.add(e.id);
    for (const id of set) expect(ider, `mangler ${id}`).toContain(id);
  });
  it.each(SPORBARHED.map((s) => [s.id, s] as const))('%s findes i kernen og har implementering og facit-test', (id, s) => {
    expect(kildekode.includes(`'${id}'`), `${id} findes ikke i kernen`).toBe(true);
    for (const f of s.fil.split(' / ')) expect(existsSync(new URL(f, kerne)), f).toBe(true);
    expect(existsSync(new URL(s.facit, kerne)), s.facit).toBe(true);
  });
  it('uafhængigt verificerede id er med i tabellen', () => {
    for (const id of uafhaengige) expect(ider).toContain(id);
  });
  it('docs/sporbarhed.md er ajour (genskab med: npm run sporbarhed)', () => {
    const ny = sporbarhedMarkdown(uafhaengige, golden.cases.length);
    if (process.env.SKRIV_SPORBARHED) { writeFileSync(dok, ny); return; }
    expect(existsSync(dok) ? readFileSync(dok, 'utf8') : '').toBe(ny);
  });
});
