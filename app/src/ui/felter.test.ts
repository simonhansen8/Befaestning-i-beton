// Felt-skemaet er konsistent med modellen: hver sti findes i standardmodellen, og værdier kan tolkes tilbage.
import { describe, expect, it } from 'vitest';
import { KANTFELTER, SEKTIONER } from './felter';
import { standardModel } from '../core/indlaes';
import { laesSti, tolkFelt, visFelt } from './vaerdi';
import type { FeltDef } from './skema-typer';

const model = standardModel('2026-01-01');
const felter: FeltDef[] = [...SEKTIONER.flatMap((s) => (s.fields ?? []).filter((f): f is FeltDef => 'k' in f)), ...KANTFELTER];

describe('felt-skema', () => {
  it('har felter', () => expect(felter.length).toBeGreaterThan(90));
  it.each(felter.map((f) => [f.k, f] as const))('%s findes i modellen og kan tolkes tilbage', (_k, f) => {
    // Stien findes (også hvis værdien er null)
    const dele = f.k.split('.');
    let o: any = model;
    for (const d of dele.slice(0, -1)) { o = o?.[d]; expect(o, `mangler ${f.k}`).toBeTypeOf('object'); }
    expect(dele[dele.length - 1]! in o, `mangler ${f.k}`).toBe(true);
    const v = laesSti(model, f.k);
    if (f.type === 'num' || f.type === 'text') {
      const t = tolkFelt(f, visFelt(f, v));
      // Standardværdien skal være gyldig i feltet (eller tom for nullable)
      if (v != null) expect(t.ok, `${f.k}=${v}`).toBe(true);
    }
    if (f.type === 'select' || f.type === 'seg') expect(f.options!.some(([ov]) => ov === v || (v == null && ov === '')), `${f.k}=${String(v)} ikke blandt valgmuligheder`).toBe(true);
  });
});
