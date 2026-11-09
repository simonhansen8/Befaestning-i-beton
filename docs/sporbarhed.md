# Sporbarhed: brudform → norm → kode → kontrol

Genereres af `app/src/core/sporbarhed.test.ts` (`npm run sporbarhed`); CI fejler, hvis filen er ude af trit med `sporbarhed.ts`, kernen, facit-sættet eller den uafhængige reference.

- **Facit**: sammenligning med den gamle kerne på 800 modeller (`golden/cases.json`).
- **Uafhængig**: karakteristisk kapacitet (Rk) er sammenlignet med `verifikation/reference.py`, som er skrevet direkte efter normens formler.
- Ligningsnumre er kun angivet for formler, der er kontrolleret mod referencen eller kendt entydigt; øvrige formler er angivet med afsnit.
- Afsnitsnumre er hentet fra de henvisninger programmet i forvejen bruger (felt-skema og diagnoser) og er ikke kontrolleret mod normteksten.

| Id | Brudform | Norm | Formler | Implementering | Uafhængig | Facit-test | Åbne forbehold |
|---|---|---|---|---|---|---|---|
| N_s | Stålbrud, træk | EN 1992-4, 7.2.1.3 | (7.1) | `tension.ts` | ja | `tension.golden.test.ts` | #6 γMs (DK NA) |
| N_p | Udtrækning | EN 1992-4, 7.2.1.5 (indstøbt), 7.2.1.6 (indlimet) | (7.12) | `tension.ts / bond.ts` | ja | `tension.golden.test.ts` | – |
| N_c | Betonkegle | EN 1992-4, 7.2.1.4 | – | `cone.ts` | ja | `cone.golden.test.ts` | – |
| N_sp | Spaltning | EN 1992-4, 7.2.1.7 | – | `splitting.ts` | nej | `splitting.golden.test.ts` | #11 ccr,sp og hmin skønnet |
| N_cb | Sidebrud | EN 1992-4, 7.2.1.8 | – | `sideblowout.ts` | nej | `sideblowout.golden.test.ts` | – |
| N_re | Ankerarmering i træk (stål) | EN 1992-4, 7.2.1.2(2) | – | `reinforcement.ts` | nej | `kombination.golden.test.ts` | #14 dnom/ben pr. anker |
| N_a | Ankerarmering i træk (forankring) | EN 1992-4, 7.2.1.2(2) | – | `reinforcement.ts` | nej | `kombination.golden.test.ts` | #14 dnom/ben pr. anker |
| N_cre | Betonkegle med ankerarmering | EN 1992-4, 7.2.1.2(2) | – | `reinforcement.ts` | nej | `kombination.golden.test.ts` | – |
| V_s | Stålbrud, forskydning | EN 1992-4, 7.2.2.3 | (7.37) | `shear.ts` | ja | `shear.golden.test.ts` | #6 γMs,V (DK NA) |
| V_cp | Pry-out | EN 1992-4, 7.2.2.4 | (7.39) | `shear.ts` | ja | `shear.golden.test.ts` | – |
| V_c | Betonkantbrud | EN 1992-4, 7.2.2.5 | – | `edgebreakout.ts` | ja | `shear.golden.test.ts` | – |
| V_re | Ankerarmering i forskydning (stål) | EN 1992-4, 7.2.2.6 | – | `reinforcement.ts` | nej | `kombination.golden.test.ts` | #12 kant vælges på tværs af kombinationer; #13 V_re-formel/k10 |
| V_a | Ankerarmering i forskydning (forankring) | EN 1992-4, 7.2.2.6 | – | `reinforcement.ts` | nej | `kombination.golden.test.ts` | #13 V_re-formel/k10 |
| NV_s | Interaktion, stål | EN 1992-4, 7.2.3 | (7.54) | `interaction.ts` | nej | `kombination.golden.test.ts` | – |
| NV_c | Interaktion, beton | EN 1992-4, 7.2.3 | (7.55) (7.56) (7.57) | `interaction.ts` | nej | `kombination.golden.test.ts` | – |
| NV_re | Interaktion, ankerarmering | EN 1992-4, 7.2.3 | (7.55) (7.56) (7.57) | `interaction.ts` | nej | `kombination.golden.test.ts` | – |

Forbehold henviser til `docs/kritiske-fund.md`.
