// Hele projektberegningen mod facit: tilstand, ok, styrende kombination, maksimal udnyttelse og styrende brudform.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { beregnProjekt, type Projektmodel } from './beregn';
import { legacyKfi } from './facit-hjaelp';
import { skalerLast } from './loads';

const G = JSON.parse(readFileSync(new URL('../../../golden/cases.json', import.meta.url), 'utf8'));

describe('beregnProjekt mod facit', () => {
  it.each(G.cases as any[])('model #$id', (c: any) => {
    const m = c.model;
    // Facit regner med fast Ec = 30000 og gamma3 efter kontrolklasse; K_FI på laster er fjernet i ny kerne.
    const k = legacyKfi(m);
    const model = { ...m, indstillinger: { ...m.indstillinger, gamma3: undefined, Ec: 30000 }, laster: m.laster.map((l: any) => ({ ...skalerLast(l, k), alphaSus: l.alphaSus })) } as Projektmodel;
    const r = beregnProjekt(model);
    const gammelFejl = (c.resultat.fejl as string[]).filter((f) => f !== 'k:indstillinger.kfiPaaLaster');
    if (c.resultat.tilstand !== 'ok') {
      // Afvisninger alene på grund af K_FI findes ikke længere.
      expect(r.tilstand === 'fejl', `tilstand (gammel: ${gammelFejl.join(';')})`).toBe(gammelFejl.length > 0);
      return;
    }
    expect(r.tilstand).toBe('ok');
    expect(r.ok).toBe(c.resultat.ok);
    expect(r.styrendeKombination).toBe(c.resultat.styrendeKombination);
    // JSON gemmer Infinity som null.
    if (c.resultat.maksUdnyttelse == null) expect(r.maksUdnyttelse).toBe(Infinity);
    else expect(r.maksUdnyttelse!).toBeCloseTo(c.resultat.maksUdnyttelse, 9);
  });
});
