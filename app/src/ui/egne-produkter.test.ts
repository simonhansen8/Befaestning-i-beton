import { beforeEach, describe, expect, it } from 'vitest';
import { gemEgetProdukt, laesEgneProdukter, sletEgetProdukt } from './egne-produkter';

const lager = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => lager.get(k) ?? null, setItem: (k: string, v: string) => void lager.set(k, v), removeItem: (k: string) => void lager.delete(k), clear: () => lager.clear() };

describe('egne produkter (localStorage)', () => {
  beforeEach(() => lager.clear());
  it('gemmer, erstatter, sorterer og sletter', () => {
    gemEgetProdukt({ navn: 'B', vaerdier: { d: 10 } });
    gemEgetProdukt({ navn: 'A', vaerdier: { d: 12 } });
    gemEgetProdukt({ navn: 'B', vaerdier: { d: 14 } });
    expect(laesEgneProdukter().map((p) => `${p.navn}:${p.vaerdier.d}`)).toEqual(['A:12', 'B:14']);
    sletEgetProdukt('A');
    expect(laesEgneProdukter()).toHaveLength(1);
  });
  it('ignorerer ugyldigt indhold', () => {
    localStorage.setItem('anker-egne-produkter-v1', '{"x":1}');
    expect(laesEgneProdukter()).toEqual([]);
    localStorage.setItem('anker-egne-produkter-v1', 'ikke json');
    expect(laesEgneProdukter()).toEqual([]);
  });
});
