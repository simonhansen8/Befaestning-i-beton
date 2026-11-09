# Tests

* `npm run typecheck` / `npm run unit` – typer og alle enhedstests i `app/src` (kerne mod frosset facit i `golden/`, uafhængige normtests i `uafhaengig.test.ts`, Python-reference i `verifikation/`).
* `npm test` – Playwright-røgtest af den byggede rod-`index.html` (`ny-ui.test.mjs`).
* `npm run publicer -- ÅÅÅÅ-MM-DD.N` – bygger og lægger programmet som rod-`index.html` (versionen gemmes i `app/VERSION`). Skal køres, når `app/` ændres; CI fejler ellers.

`lib/ref.mjs` er de håndskrevne normformler, som `uafhaengig.test.ts` bruger. `lib/engine.mjs` åbner den arkiverede gamle fil og bruges kun af facit-generatorerne.

## Hvad testene IKKE kan bevise
Referenceformlerne er skrevet ud fra samme normlæsning som kernen: oversættelsesfejl opdages, en fælles fejllæsning af normen gør ikke. DK NA-værdier er kun låst som forventet værdi (se `docs/kritiske-fund.md`). Anbefalet supplement: gennemgang af en ingeniør og sammenligning med publicerede regneeksempler.
