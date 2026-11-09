# Genopbygning (vej B) – status

Beslutning (Simon): bevar normlogikken, genopbyg strukturen som TypeScript + Vite bygget til én `index.html`. Se `arkitekturvurdering.md`.

| # | Punkt | Status |
|---|---|---|
| 1 | Facit-sæt (`golden/`): 400 deterministiske modeller, 345 beregnet, gammel kernes tal gemt; test i CI | **Færdig** |
| 2 | Ny kodebase (`app/`): TypeScript + Vite → én fil i `dist/index.html`, APP_BUILD automatisk, typecheck/vitest/build i CI | **Færdig** (skelet) |
| 3 | Ren kerne med typet datamodel | **I gang**: indstillinger, stål, partialkoefficienter, lastfordeling, stålbrud (træk), udtrækning og betonkegle matcher facit. Næste: udsplitning, sidebrud, forskydningsbrud (stål, pry-out, kantbrud), interaktion, indlimede anker, armering. |
| 4 | Struktureret resultat; tekst/HTML kun i præsentationslag | |
| 5 | UI/state: ét state, én vej felt → model → beregning | |
| 6 | Sporbarhedstabel felt → formel → norm → test, kontrolleret i CI | |
| 7 | Uafhængig verifikation (Python-reference, håndregnede eksempler, evt. PROFIS) | |
| 8 | Migrér 2D/3D/rapport | |
| 9 | Udfas gammel fil når facit er grønt | |

Ny kodebase: `npm run typecheck`, `npm run unit`, `npm run build` (output `dist/index.html`; den gamle rod-`index.html` urørt indtil trin 9).

Værktøjer: `npm run golden:generate` (generér facit af den *aktuelle* index.html – kun ved bevidst facit-ændring), `npm run golden:full`, `tools/probe-settings.mjs` (hvilke felter påvirker resultatet).
