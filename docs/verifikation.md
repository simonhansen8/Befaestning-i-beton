# Uafhængig verifikation (trin 7, første del)

Formålet er at vise, at kernen regner efter normen – ikke bare, at den ligner den gamle kerne.

- `verifikation/reference.py` er en separat implementering i Python, skrevet efter formlerne i DS/EN 1992-4:2018 og uden kode fra hverken den gamle eller den nye kerne.
- Den dækker ti rene situationer uden moment, armering og løftestang: enkeltbolt og grupper, revnet/urevnet, kantafstand i træk og forskydning, lav `hef`, ikke-duktilt stål og tynd plade.
- Resultatet (`verifikation/expected.json`) sammenlignes af `app/src/core/verifikation.test.ts` med den nye kerne. Der sammenlignes karakteristiske kapaciteter (Rk); de afhænger ikke af nationale γ-værdier. Tolerancen er 1·10⁻⁹ relativt.
- CI genskaber `expected.json` fra Python og fejler, hvis filen ændres uden at være committet.

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

## Hvad dette endnu ikke dækker

- Momentbelastede grupper, trykzone, slidshuller, løftestang, armering, indlimede anker og interaktion er kun verificeret mod den gamle kerne (facit-sættet), ikke mod en uafhængig kilde.
- Nationale γ-værdier (fund #6) og estimater for c_cr,sp og h_min (fund #11) kræver kontrol mod DK NA og produktdata.
- Den kommercielle tredje kilde dækker kun N⁰Rk,c og V⁰Rk,c for en enkelt bolt (se ovenfor). Grupper, momenter, spaltning og armering mangler stadig en uafhængig kilde.
