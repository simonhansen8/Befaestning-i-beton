# Uafhængig verifikation (trin 7, første del)

Formålet er at vise, at kernen regner efter normen – ikke bare, at den ligner den gamle kerne.

- `verifikation/reference.py` er en separat implementering i Python, skrevet efter formlerne i DS/EN 1992-4:2018 og uden kode fra hverken den gamle eller den nye kerne.
- Den dækker ti rene situationer uden moment, armering og løftestang: enkeltbolt og grupper, revnet/urevnet, kantafstand i træk og forskydning, lav `hef`, ikke-duktilt stål og tynd plade.
- Resultatet (`verifikation/expected.json`) sammenlignes af `app/src/core/verifikation.test.ts` med den nye kerne. Der sammenlignes karakteristiske kapaciteter (Rk); de afhænger ikke af nationale γ-værdier. Tolerancen er 1·10⁻⁹ relativt.
- CI genskaber `expected.json` fra Python og fejler, hvis filen ændres uden at være committet.

## Udvidelse 2026-11-16

Referencen dækker nu også (tilfælde S1–S2, E1–E3, I1–I2, R1 i `reference.py`):

- **Spaltning** (7.2.1.7) med ccr,sp og hmin fra produktet, enkeltbolt og to bolte langs kant, inkl. ψh,sp.
- **Kantbrud for enkeltbolt** i hjørne (begge kanter eftervises, ψα = 2 for parallel last), i smalt og tyndt element (c'1) og med skrå last (α = 30°).
- **Indlimede anker** (7.2.1.6): enkeltanker nær kant og gruppe i urevnet beton med ψg,Np > 1, samt NRk,c med produktets k-faktor.
- **Ankerarmering i træk** (7.2.1.9): NRk,re og NRd,a med l1 i 35°-keglen og fbd efter EN 1992-1-1, 8.4.2 med γc,træk = 1,70 (DK NA).

Kernen rammer alle tilfælde inden for 10⁻⁹. Testen fejler, hvis en værdi afviger 1 ‰ (kontrolleret ved at forstyrre de forventede tal).

Stadig uden uafhængig kilde: forskydningsarmering (V_re, V_a, kantstang), N_cre, interaktion og grupper ved kant i forskydning.

## Håndberegnet eksempel (A1: M16 4.6, hef = 150 mm, C30/37, revnet, ingen kanter)

| Brudform | Formel | Regning | Rk |
|---|---|---|---|
| N_Rk,s | A_s · f_uk | 157 · 400 | 62 800 N |
| N_Rk,p | k₂ · A_h · f_ck, A_h = π/4 (d_h² − d²) | 7,5 · 459,4 · 30 | 103 378 N |
| N_Rk,c | k₁ · √f_ck · h_ef^1,5 (A_c/A_0 = ψ = 1) | 8,9 · 5,477 · 1837,1 | 89 554 N |
| V_Rk,s | k₇ · k₆ · A_s · f_uk | 1 · 0,6 · 157 · 400 | 37 680 N |
| V_Rk,cp | k₈ · N_Rk,c, k₈ = 2 | 2 · 89 554 | 179 109 N |

Kernen og referencen giver de samme tal. Se de øvrige ni tilfælde i `reference.py`.

## Offentligt publicerede kommercielle beregninger (tredje kilde)

Hilti stiller PROFIS Engineering-rapporter frit til rådighed på nettet. Rapporten [cfip8ziqve.pdf](https://files-ask.hilti.com/original/cf/cfip8ziqve.pdf) (PROFIS 3.0.87, 9. august 2023) er den eneste, jeg har fundet for en *indstøbt* hovedbolt (M16 5.8, hef 120 mm, C20/25 revnet, h = 175 mm, c1 = 150 mm). Værdierne N⁰Rk,c = 52,321 kN, V⁰Rk,c = 24,305 kN, A⁰c,V = 101 250 mm² og Ac,V = 96 250 mm² gengives af både `reference.py` og den nye kerne (tilfældene P1 og P2, tolerance 10⁻⁵). Kun disse mellemresultater bruges: Hiltis slutresultat for kantbrud (VRd,c = 15,244 kN) bygger på deres egen metode for indstøbte bolte med groutet afstand (stand-off), som ikke står i EN 1992-4, og kan derfor ikke sammenlignes.

Resten af de offentligt tilgængelige PROFIS-rapporter, jeg fandt, gælder efterbehandlede (post-installed) anker og er ikke relevante for denne kerne.

## Hilti PROFIS-rapporter for indlimede anker

Fire PROFIS-rapporter med grupper, moment og vridning er gennemregnet og sammenlignet i detaljer; se [verifikation-profis.md](verifikation-profis.md).

## Hvad dette endnu ikke dækker

- Slidshuller, løftestang og armering er kun verificeret mod den gamle kerne (facit-sættet). Momentbelastede grupper, trykzone, indlimede anker og interaktion er nu også kontrolleret mod PROFIS (se ovenfor).
- Nationale γ-værdier (fund #6) og estimater for c_cr,sp og h_min (fund #11) kræver kontrol mod DK NA og produktdata.
- Forskydningsarmering, N_cre og interaktionen mangler stadig en uafhængig kilde. Referencen er skrevet efter samme normlæsning; den fanger oversættelsesfejl, ikke en fælles fejllæsning.
