# Faglig og teknisk gennemgang, 2026-11-16

Grundlag: build 2026-11-10.9 (commit a799c39). Hele beregningskernen (`app/src/core`) er læst og holdt op mod EN 1992-4:2018. Udvalgte formler er regnet efter i hånden. Brugerfladen er afprøvet i en browser. Testsuiten (8877 enhedstests og 10 browsertests) er grøn.

Målestok: kan et anerkendt rådgivende ingeniørfirma bruge programmet i sit daglige arbejde?

## 1. Konklusion

**Formlerne for de enkelte brudformer er generelt rigtige.** Lastfordelingen er robust (stiv plade med trykzone og vridning), og ankerkræfter og kapaciteter stemmer med PROFIS på grupper med moment.

**Programmet kan endnu ikke bruges i projekter uden forbehold.** Der er tre grunde:

1. Der var en kritisk fejl, der overvurderede stålbæreevnen (afsnit 2). Den er rettet i build 2026-11-16.1.
2. Interaktionen med ankerarmering bør kontrolleres mod Tabel 7.3 i normen (afsnit 3.1). Den kan være på den usikre side.
3. Kantbrud, spaltning, sideudsprængning og ankerarmering er kun sammenlignet med den gamle kerne og med en reference skrevet af samme forfatter. Ingen af dem er kontrolleret mod en uafhængig kilde.

Indtil disse tre ting er lukket, kan programmet bruges til **overslag og kontrolregning**, men ikke som eneste dokumentation.

## 2. Kritisk fejl (rettet)

**Spændingsarealet As fulgte ikke boltdiameteren.** Standardmodellen gemmer As = 245 mm² (M20), og feltet er skrivebeskyttet. Når brugeren skiftede til fx M12, stod As stadig på 245 mm², og kernen regnede videre med den værdi. Det er eftervist i den byggede `index.html`.

Konsekvenser:

- N_Rk,s, V_Rk,s og M⁰Rk,s blev overvurderet med en faktor 2,9 for M12 og 1,6 for M16. Fejlen er på den usikre side.
- Fordelingen af ankerkræfter blev også forkert, fordi ankerstivheden er Es·As.
- "Mine produkter" havde samme fejl, fordi funktionen sætter d, men ikke As.

Rettelse: kernen afleder nu altid As af d og gevind. En gemt As, der ikke passer, bruges ikke, og brugeren får en advarsel (`as-afledt-af-d`).

**Projekter, der er regnet med en ældre build, og hvor d er ændret fra M20, skal regnes igen.**

## 3. Normtekniske punkter, der skal afklares mod normteksten

Punkterne er sorteret efter betydning. Normteksten var ikke tilgængelig under gennemgangen. Punkterne er derfor formuleret som spørgsmål, ikke som fastslåede fejl.

| # | Punkt | Program | Risiko |
|---|---|---|---|
| 3.1 | Interaktion med ankerarmering (7.2.3, Tabel 7.3, (7.57)) | Med armering for **både** træk og forskydning bruger programmet (7.55)/(7.56) med eksponent 1,5. Med armering for kun én af dem bruger det (7.57) med k11 = 2/3 (indtastet). Min læsning af normen er, at (7.57) gælder, når der er ankerarmering, og at k11 = 2/3 netop hører til armering for begge. | Kan være på den usikre side. Ved βN = βV = 0,6 giver (7.55) 0,93 (ok), mens (7.57) med k11 = 2/3 giver 1,42. |
| 3.2 | k7 for ét enkelt ikke-duktilt anker (7.2.2.3.1) | k7 = 1 for et enkelt anker, 0,8 kun for grupper. | Op til 25 % på den usikre side for 4.8/5.8/6.8, hvis k7 også gælder enkeltankre. |
| 3.3 | ccr,sp og hmin for indlimede anker uden ETA-værdier | Hilti HY 200-udtrykket bruges som standard for alle produkter, og brugeren får kun en info-besked. | Gælder kun det ene produkt. Bør være en advarsel eller fejl. |
| 3.4 | ψre,V-kravet hef ≥ 2,5·cnom | Er indbygget som betingelse. | Hjemlen i normen er ikke fundet. Betingelsen er konservativ. |
| 3.5 | Pry-out pr. enkeltanker ved modsatrettede forskydninger | Strengere end PROFIS (B12: 111 % mod 100 %). | Konservativ. Er allerede åben som QS-03. |
| 3.6 | Ligningsnumre i rapporten | Er markeret som ikke kontrolleret. | Uacceptabelt i en afleveret rapport. Numrene skal kontrolleres én gang mod normen. |

Følgende er kontrolleret og fundet i orden:

- Formler og faktorer: N_Rk,s; N_Rk,p (k2, Ah ≤ (6th+d)); N⁰Rk,c (k1); ψs,N, ψre,N, ψec,N og ψM,N med betingelser; h'ef for smalle elementer; vedhæftning (τRk,c, scr,Np, ψ⁰g,Np, ψg,Np, ψsus); spaltning (N⁰Rk = min(p; c), ψh,sp, kontrolfrihed 1,0/1,2·ccr,sp og h ≥ hmin); sideudsprængning (k5, Ac,Nb, ψs/g/ec,Nb); V_Rk,s (k6, løftestang med αM og MRk,s·(1 − NEd/NRd,s)); kantbrud (k9, α, β, lf, Ac,V, ψs/h/ec/α/re,V, smalle elementer c'1, grænsen max(10hef; 60d)); NRd,a og NRd,re for ankerarmering (fbd, α = 0,7, ds ≤ 16, fyk ≤ 600, 0,75hef/0,75c1, NEd,re = VEd(es/z+1)).
- Partialkoefficienter efter DK NA, Ecm efter tabel 3.1, fctk,0.05 og η2.
- Tabelværdier: gevindarealer og huldiametre i Tabel 6.1.
- Fortegn for forskydning mod og væk fra kanten. V⁰Rk,c er regnet i hånden (17,54 kN for c1 = hef = 100, M20, C30/37) og stemmer.

## 4. Praktisk brugbarhed: hvad mangler i forhold til et kommercielt værktøj

**Kan ikke undværes i daglig projektering:**

- **EN 1992-4, Anneks A**: eftervisning af betonelementets forskydningsbæreevne ved last fra befæstelsen (fx træk over 60 kN i plader og bjælker) er hverken regnet eller nævnt. Det skal som minimum stå som en forudsætning i rapporten.
- **Fodpladen**: stivheden (forudsætningen i 6.2.1(2)) eftervises ikke, og betontrykket under pladen er kun en advarsel ved 3fcd. Firmaet skal dokumentere pladen separat.
- **Produktdata**: der er kun ét indbygget produkt (Hilti HY 200 V3). For indstøbte hovedbolte og svejste studs mangler ETA-/produktværdier (ccr,sp, hmin, cmin, smin, k8). I dag er de skøn, som kun giver en advarsel.
- **Excentrisk lastangrebspunkt** kan ikke indtastes. Momenter fra excentricitet skal regnes om i hånden, hvilket er en kendt fejlkilde.

**Uden for omfanget, og bør stå tydeligt i rapporten:** seismik (Anneks C), brand (Anneks D), udmattelse, mekaniske ekspansions- og skrueankre samt ankerskinner.

**Følsomme afledte værdier af samme type som As-fejlen:**

- ψc fra Hilti-forvalget bliver stående, hvis betonklassen ændres bagefter. Sænkes klassen fra C50 til C20, regnes τRk ca. 10 % for højt.
- dh og th for indstøbte bolte bliver stående ved skift af d. Står M20-hovedet (dh = 40) til et M12-anker, bliver Ah og N_Rk,p ca. 3 gange for store.

Begge dele bør enten afledes automatisk eller give en advarsel ved uoverensstemmelse.

## 5. Kode og test

- **Struktur:** kernen er ren TypeScript med strukturerede resultater, sporbarhed og diagnoser. Det er en god og professionel opbygning.
- **Navngivning:** i `edgebreakout.ts`, `shear.ts` og `reinforcement.ts` er navnene stadig ét bogstav (`O`, `Z`, `J`, `U`, `G`, `y`), som en rest fra den minificerede kilde. Det gør det svært for en ingeniør at gennemgå koden. Navnene bør omdøbes, før koden bruges i et kvalitetssikringsforløb.
- **Testenes uafhængighed:** de fleste af de 8877 tests sammenligner med den gamle kerne. De beviser derfor overensstemmelse med den gamle kerne, ikke med normen. Den uafhængige dækning er Python-referencen for 10 rene tilfælde og fem PROFIS-rapporter uden kanter og armering.
- **Hvad der mangler for kvalitetssikring:** sammenligning med publicerede regneeksempler for kantbrud, spaltning, sideudsprængning og ankerarmering. Det kan fx være fib Bulletin 58, eksemplerne i Eligehausen/Mallée/Silva eller PROFIS-rapporter med kanter og armering.
- **Ydelse:** en beregning tager millisekunder, og den samlede fil er 756 kB. Der er intet at optimere her.

## 6. Anbefalet rækkefølge

1. Afklar 3.1 og 3.2 mod normteksten og ret dem om nødvendigt. Det er små ændringer i `interaction.ts` og `shear.ts`.
2. Lad ψc, dh/th og d0 følge deres grundlag, eller giv en advarsel ved uoverensstemmelse, ligesom for As.
3. Indsaml 6–10 uafhængige regneeksempler med kanter, spaltning og armering, og lås dem som tests.
4. Kontroller ligningsnumrene mod normen og fjern forbeholdet i rapporten.
5. Tilføj Anneks A og fodpladen som forudsætninger i rapporten. Som udvidelser kan der senere komme indtastning af lastangrebspunkt og produktdata for indstøbte bolte.
6. Lad en uafhængig ingeniør gennemgå programmet og dokumentere det, før det tages i brug i projekter.
