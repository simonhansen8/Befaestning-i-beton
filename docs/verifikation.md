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

## Hvad dette endnu ikke dækker

- Momentbelastede grupper, trykzone, slidshuller, løftestang, armering, indlimede anker og interaktion er kun verificeret mod den gamle kerne (facit-sættet), ikke mod en uafhængig kilde.
- Nationale γ-værdier (fund #6) og estimater for c_cr,sp og h_min (fund #11) kræver kontrol mod DK NA og produktdata.
- En kommerciel beregning (fx PROFIS Engineering) som tredje kilde mangler; det kræver, at du leverer sammenligningsmodeller.
