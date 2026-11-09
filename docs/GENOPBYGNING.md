# Genopbygning (vej B) – status

Beslutning (Simon): bevar normlogikken, genopbyg strukturen som TypeScript + Vite bygget til én `index.html`. Se `arkitekturvurdering.md`.

| # | Punkt | Status |
|---|---|---|
| 1 | Facit-sæt (`golden/`): 800 deterministiske modeller (666 beregnet) inkl. nære kanter og aktiv armering; gammel kernes tal gemt; test i CI | **Færdig** |
| 2 | Ny kodebase (`app/`): TypeScript + Vite → én fil i `dist/index.html`, APP_BUILD automatisk, typecheck/vitest/build i CI | **Færdig** (skelet) |
| 3 | Ren kerne med typet datamodel | **I gang**: indstillinger, stål, partialkoefficienter, lastfordeling, stålbrud (træk), udtrækning, betonkegle, spaltning, sidebrud, forskydningsbrud (stål inkl. løftestang, pry-out, kantbrud) og interaktion (NV_s, NV_c) matcher facit uden ankerarmering, nu også for indlimede anker (kombineret udtræk/betonbrud, pry-out). Næste: armeringsmodulet (N_re, N_a, N_cre, V_re, V_a, NV_re), samlet orkestrering. |
| 4 | Struktureret resultat; tekst/HTML kun i præsentationslag | |
| 5 | UI/state: ét state, én vej felt → model → beregning | |
| 6 | Sporbarhedstabel felt → formel → norm → test, kontrolleret i CI | |
| 7 | Uafhængig verifikation (Python-reference, håndregnede eksempler, evt. PROFIS) | |
| 8 | Migrér 2D/3D/rapport | |
| 9 | Udfas gammel fil når facit er grønt | |

Ny kodebase: `npm run typecheck`, `npm run unit`, `npm run build` (output `dist/index.html`; den gamle rod-`index.html` urørt indtil trin 9).

Værktøjer: `npm run golden:generate` (generér facit af den *aktuelle* index.html – kun ved bevidst facit-ændring), `npm run golden:full`, `tools/probe-settings.mjs` (hvilke felter påvirker resultatet).
