# Genopbygning (vej B) – status

Beslutning (Simon): bevar normlogikken, genopbyg strukturen som TypeScript + Vite bygget til én `index.html`. Se `arkitekturvurdering.md`.

| # | Punkt | Status |
|---|---|---|
| 1 | Facit-sæt (`golden/`): 800 deterministiske modeller (666 beregnet) inkl. nære kanter og aktiv armering; gammel kernes tal gemt; test i CI | **Færdig** |
| 2 | Ny kodebase (`app/`): TypeScript + Vite → én fil i `dist/index.html`, APP_BUILD automatisk, typecheck/vitest/build i CI | **Færdig** (skelet) |
| 3 | Ren kerne med typet datamodel | **I gang**: indstillinger, stål, partialkoefficienter, lastfordeling, stålbrud (træk), udtrækning, betonkegle, spaltning, sidebrud, forskydningsbrud (stål inkl. løftestang, pry-out, kantbrud) og interaktion (NV_s, NV_c) matcher facit uden ankerarmering, nu også for indlimede anker (kombineret udtræk/betonbrud, pry-out). Armeringsmodulet (N_re, N_a, N_cre, V_re, V_a, NV_re) og samlet orkestrering (`kombination.ts`) matcher alle 617 beregnede facit-modeller. Indlæsning af projektfiler er portet i to trin (`indlaes.ts`: fletning over standardmodel, afvisning af ugyldige værdier, migrering af gamle feltnavne; `inddata.ts`: normalisering med standarder og kodede diagnoser) og testet mod 200 rodede filer (`golden/input-cases.json`). Bevidst afvigelse: en angivet γ3 overskrives ikke af kontrolklassen. Trin 4 (struktureret resultat): kodede diagnoser (`diagnostik*.ts`, `validering.ts`) og samlet `beregnProjekt` (`beregn.ts`) matcher facit på tilstand, ok, styrende kombination og maksimal udnyttelse for alle 800 modeller. |
| 4 | Struktureret resultat; tekst/HTML kun i præsentationslag | |
| 5 | UI/state: ét state, én vej felt → model → beregning | **I gang**: felt-skema (`app/src/ui/felter.ts`, 110 felter), ét `Store` (felt → tolkning → model → indlæsning → beregning), diagnosetekster (kode → tekst, testet), første to-kolonne brugerflade (formular, laster, bolte, resultat pr. kombination, bemærkninger) og røgtest i CI. Tegning/2D/3D og rapport mangler (trin 8). Fokus: brugervenlighed og overblik, ikke identisk udseende. |
| 6 | Sporbarhedstabel felt → formel → norm → test, kontrolleret i CI | |
| 7 | Uafhængig verifikation (Python-reference, håndregnede eksempler, evt. PROFIS) | **I gang**: Python-reference + håndregnet eksempel for 10 rene tilfælde matcher kernen (se `verifikation.md`). Mangler: momenter, armering, indlimede anker, PROFIS |
| 8 | Migrér 2D/3D/rapport | **I gang**: plantegning (SVG) og rapport (selvstændigt HTML-dokument til udskrift/PDF, inddata afledt af felt-skemaet, escapet brugertekst, test) er færdige i ny kodebase. Mangler: 3D-visning og eventuelle ekstra rapportafsnit (beregningsgrundlag med formler pr. brudform – afhænger af traceability-tabellen, trin 6). |
| 9 | Udfas gammel fil når facit er grønt | |

Ny kodebase: `npm run typecheck`, `npm run unit`, `npm run build` (output `dist/index.html`; den gamle rod-`index.html` urørt indtil trin 9).

Værktøjer: `npm run golden:generate` (generér facit af den *aktuelle* index.html – kun ved bevidst facit-ændring), `npm run golden:full`, `tools/probe-settings.mjs` (hvilke felter påvirker resultatet).
