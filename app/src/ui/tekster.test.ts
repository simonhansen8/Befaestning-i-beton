// Hver diagnosekode i kernen skal have en tekst i præsentationslaget.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { TEKSTER, tekst } from './tekster';

const mappe = new URL('../core/', import.meta.url);
const kilder = readdirSync(mappe).filter((f) => /^(validering|diagnostik-kombination|inddata|indlaes|beregn)\.ts$/.test(f));
const koder = new Set<string>();
for (const f of kilder) {
  const s = readFileSync(new URL(f, mappe), 'utf8');
  for (const m of s.matchAll(/(?:diag\(|info\(|fejl\()\s*(?:'(?:fejl|advarsel|info)',\s*)?'([a-zA-Z0-9-]+)'/g)) koder.add(m[1]!);
}

describe('diagnosetekster', () => {
  it('finder koder i kernen', () => expect(koder.size).toBeGreaterThan(80));
  it.each([...koder].sort())('kode %s har tekst', (k) => {
    expect(TEKSTER[k], `mangler tekst for ${k}`).toBeTypeOf('function');
    expect(tekst({ niveau: 'info', kode: k, felt: null, paragraf: '', data: {} }).length).toBeGreaterThan(3);
  });
  it('ukendt kode giver kode som tekst', () => expect(tekst({ niveau: 'info', kode: 'xx', felt: null, paragraf: '', data: {} })).toBe('xx'));
});
