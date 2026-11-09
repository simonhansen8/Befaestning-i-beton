# Kritiske fund under genopbygningen

Løbende liste over ting i den gamle kerne, der ser forkerte, tvivlsomme eller uforklarlige ud. Intet er rettet stille: den nye kerne gengiver den gamle (så facit kan bruges), og afvigelser afgøres bevidst. Status: **Verificeret** = set i koden/målt; **Tjek mod norm** = kræver normtekst/NA; **Beslut** = kræver valg.

| # | Fund | Status |
|---|---|---|
| 1 | `indstillinger.gamma3` overskrives ved JSON-import, hvis `kontrolklasse` er angivet (lempet → 1,10, ellers 1,00). En eksplicit γ3 i filen ignoreres altså stille. Målt: `gamma3 = 1,1` alene gav ingen ændring. I den nye kerne er γ3 ikke længere input. | Verificeret; **Besluttet (Simon)**: γ3 kan overstyres manuelt. Indbygget i ny kerne (`gamma3Overstyring`); uden værdi udledes den af kontrolklassen. |
| 2 | Stålklasse alene ændrer ikke beregningen: fuk/fyk gemmes separat og holdes i sync af UI-hændelser. Import af klasse 5.8 med fuk/fyk fra 8.8 regner med 8.8. Samme for `As` mod gevind/diameter. | Verificeret; løst i ny kerne (afledes). |
| 3 | `Ec` er en fast indstilling (30 000 MPa) uafhængig af betonklassen, men bruges i lastfordelingen (stiv plade/trykzone). C20 og C50 giver samme Ec. | Verificeret; **Besluttet (Simon)**: Ec styres af betonklassen (Ecm, EN 1992-1-1 Tabel 3.1), med mulighed for manuel overstyring. Indbygget i ny kerne. Facit-sammenligning bruger fast Ec = 30 000, så små afvigelser i ankerkræfter fra den gamle kerne er tilsigtede. |
| 4 | `Es`·`As` bruges som ankerstivhed i lastfordelingen. As er spændingsarealet, ikke skaftets areal; for gevind-i-skaft kan det give for blød anker. Rimelig forenkling, men bør nævnes i rapporten. | Tjek mod norm/praksis |
| 5 | K_FI skalerer lasterne (alle komponenter, men gunstig normalkraft højst med 1). K_FI hører i DS/EN 1990 DK NA til partialkoefficienterne for last; at gange på samlede designværdier er en forenkling. Programmet afviser selv CC3 (K_FI > 1) af denne grund. | **Enighed (Simon)**: forenkling, skal rettes. **Besluttet (Simon)**: automatisk K_FI på laster fjernes; laster indtastes altid som designværdier inkl. K_FI. Gennemført i ny kerne (`kfiPaaLaster` findes ikke); konsekvensklassen bruges kun til dokumentation. Facit-tests anvender gammel K_FI-skalering via `facit-hjaelp.ts`. |
| 6 | γMs,V-betingelsen bruger `fuk ≤ 800` og `fyk/fuk ≤ 0,8`, ellers 1,65. Værdierne 1,35/1,65 og træk-minimum 1,5 er DK NA-værdier; EN-standard er hhv. 1,25/1,5 og 1,4. | **Tjek mod DK NA** |
| 7 | Kernen indeholder tegne-/3D-geometri (fx armeringsbøjler, ca. 350 linjer) blandet med beregning, og resultattekster som HTML (`<sub>`). Hører ikke hjemme i regnekernen. | Verificeret; adskilles i trin 4/8 |
| 8 | Ikke-relevante brudformer returneres uden tal (`NEd`/`NRd` mangler), mens relevante har. Inkonsistent resultatkontrakt. | Verificeret; rettes i trin 4 |
| 9 | Ankerarmeringsfelter er kun testet i en model, hvor armeringen er slået fra. Det er ikke vist, at fx `kantarmeringAfstand` eller `ankerarmeringTraek.*` påvirker resultatet, når armeringen er aktiv. | Åben: kræver facit-modeller med aktiv armering |
| 11 | `ccr,sp = 2,0·hef` og `hmin` for indstøbte anker uden produktdata er skøn, markeret "SKAL VERIFICERES" i den gamle kerne. Spaltning afhænger direkte af dem. | **Tjek mod produktdata/EAD 330924** |
| 10 | Facit-sættet har få modeller med indlimede anker, armering og slidshuller; brudformerne dér er derfor endnu svagt dækket. | Åben: udvid generatoren |

Normformlerne for N_s, N_p og N_c er sammenholdt med EN 1992-4 (7.1), (7.2), (7.4)–(7.7), (7.12)–(7.14) og stemmer i form; faktiske værdier i DK NA er ikke verificeret mod NA-teksten.
