# Faglig og teknisk gennemgang, 2026-11-16

Grundlag: build 2026-11-10.9 (commit a799c39). Hele beregningskernen (`app/src/core`) er læst og holdt op mod EN 1992-4:2018. Udvalgte formler er regnet efter i hånden, og brugerfladen er afprøvet i en browser.

Anden runde er kontrolleret mod de dokumenter, brugeren har leveret: ETA-19/0601 (Hilti HIT-HY 200 V3), DS/EN 1990 DK NA:2024 og DS/EN 1992-1-1 DK NA:2024. Selve teksten til DS/EN 1992-4 var ikke blandt dokumenterne.

Status efter rettelserne (build 2026-11-16.2): 8903 enhedstests og 10 browsertests er grønne.

## 1. Konklusion

**Formlerne for brudformerne er rigtige**, og lastfordelingen er robust. Det er nu eftervist mod en uafhængig reference for træk, spaltning, sideudsprængning, kantbrud (inkl. hjørne og smalt element), indlimede anker og ankerarmering i træk. Desuden er programmet sammenlignet med fem PROFIS-rapporter og ETA-19/0601.

**Der var to fejl på den usikre side. Begge er rettet:**

- **As fulgte ikke boltdiameteren.** Stålbæreevnen blev overvurderet op til 2,9 gange. Rettet i build 2026-11-16.1.
- **γ3 manglede på armeringens partialkoefficient.** Det gav 10 % for lav sikkerhed ved lempet kontrolklasse. Rettet i build 2026-11-16.2.

**Tilbage er to punkter**, der kræver selve EN 1992-4-teksten: k7 for enkeltankre og ligningsnumrene i rapporten (afsnit 3).

Derudover forudsætter programmet, at betonelementet (Anneks A) og fodpladen eftervises separat. Det står nu udtrykkeligt i rapporten.

Med de forbehold kan programmet bruges i projekter, når en ingeniør har gennemgået det og dokumenteret gennemgangen (afsnit 6).

## 2. Fejl fundet og rettet

| # | Fejl | Konsekvens | Rettelse |
|---|---|---|---|
| 2.1 | As fulgte ikke boltdiameter eller gevind; "Mine produkter" havde samme fejl | N_Rk,s, V_Rk,s og M⁰Rk,s blev overvurderet: M12 2,9 gange, M16 1,6 gange | As afledes altid i kernen. En gemt As, der ikke passer, ignoreres med en advarsel. |
| 2.2 | γMs,re = 1,20 uden γ3, selvom DS/EN 1992-1-1 DK NA, Tabel 2.1Na giver γs = 1,20·γ0·γ3 | Ved lempet kontrolklasse var ankerarmering, forskydningsarmering, forankring og splitarmering 10 % på den usikre side | γMs,re = 1,20·γ3. γc = 1,45·γ3 og γc,træk = 1,70·γ3 var allerede korrekte. |
| 2.3 | ψc fra Hilti-forvalget fulgte ikke betonklassen | Sænkes klassen fra C50 til C20 efter forvalget, blev τRk ca. 10 % for høj | ψc følger klassen automatisk. Kernen advarer, hvis en fil har en forkert ψc. |
| 2.4 | dh, th og d0 fulgte ikke boltdiameteren; Hilti-data fulgte ikke størrelsen | Et M20-hoved på et M12-anker gav ca. 3 gange for stor N_Rk,p | Uden produkt skaleres hovedmålene. Hilti-data hentes igen for den nye størrelse, og kernen advarer, hvis data ikke passer. |
| 2.5 | Rustfri gevindstænger over M24 er klasse 50 (fyk 210), men programmet havde kun A4-70/A4-80 | Bæreevnen ville blive overvurderet, hvis brugeren valgte A4-70 til M27/M30 | Stålklasse A4-50 er tilføjet, med advarsel. 6.8 kan nu også vælges. |
| 2.6 | Spaltning: skøn for ccr,sp og hmin gav kun en info-besked; for indlimede anker uden ETA-værdier blev Hilti-udtrykket brugt uden besked | Spaltning blev eftervist på et skøn uden tydelig advarsel | Begge giver nu en advarsel med forklaring. |

## 3. Normpunkter

| # | Punkt | Afklaring |
|---|---|---|
| 3.1 | Interaktion med ankerarmering (7.2.3, Tabel 7.3) | **Afklaret (bruger):** med armering for både træk og forskydning gælder eksponent 1,5 (7.55/7.56). (7.57) med k11 gælder kun armering i én retning. Programmet gør det rigtige; første rundes formodning var forkert. |
| 3.2 | k7 for ét ikke-duktilt anker (7.2.2.3.1) | **Åben**, kræver teksten til EN 1992-4. Programmet bruger k7 = 1,0 for enkeltankre. ETA-19/0601 giver k7 = 1,0 for Hilti-produktet, og forvalget sætter den værdi, så punktet har kun betydning for 4.8/5.8/6.8 uden produktdata. |
| 3.3 | Ligningsnumre i rapporten | **Åben**, kræver teksten til EN 1992-4. Forbeholdet står fortsat i rapporten. |
| 3.4 | ψre,V kun når hef ≥ 2,5·cnom | Konservativ betingelse. Bevares. |
| 3.5 | Pry-out pr. enkeltanker ved modsatrettede forskydninger | Konservativ (QS-03). Kan slås fra i indstillingerne. |

**Kontrolleret mod DS/EN 1990 DK NA og DS/EN 1992-1-1 DK NA:**

- K_FI = 0,9 / 1,0 / 1,1 (CC1/CC2/CC3, STR).
- γc = 1,45·γ3 og γc,træk = 1,70·γ3 (forankring regnes som trækbrud).
- γs = 1,20·γ3.
- γ3 efter Tabel 2.1Nc: 0,95 / 1,0 / 1,10. Udførelsesklasser giver 1,0.
- γM = 1,0 ved ulykke.
- fbd for ribbestål efter EN 1992-1-1, 8.4.2. DK NA's (8.100NA) gælder kun glat armering.

**Kontrolleret mod ETA-19/0601:** alle værdier i Hilti-forvalget stemmer med ETA'en (se `produktdata-hilti-hy200v3.md`). Dokumentationens linje om τRk,cr var forkert (M12–M24 er 9,5, ikke 9,4); koden var rigtig.

## 4. Nye funktioner

- **Lastangrebspunkt** (Plade → Lastpunkt x/y): programmet regner selv tillægsmomenterne Mx = N·y og My = −N·x og vridningen T = x·Vy − y·Vx. Fortegnene er bekræftet mod PROFIS MC-B12, og ankerkræfterne stemmer på 0,0015 kN. Lastpunktet vises på plantegningen og i rapporten.
- **Forudsætninger i rapporten:**
  - Anneks A (betonelementets bæreevne).
  - Fodpladens stivhed.
  - Lokalt tryk under pladen.
  - Partialkoefficienterne med γ3.
  - K_FI.
- **Ny bemærkning ved hver kombination med træk:** det samlede træk skal føres videre i elementet (Anneks A).

## 5. Kode og test

- Variabelnavne på ét bogstav fra den gamle kode er omdøbt i kantbrud (`edgebreakout.ts`), pry-out og stålbrud (`shear.ts`) og ankerarmering (`reinforcement.ts`). Tallene er uændrede på alle 800 facit-modeller.
- Den uafhængige Python-reference er udvidet fra 15 til 23 tilfælde. Testen fejler ved 1 ‰ afvigelse.
- Bevidste afvigelser fra den gamle kerne (γ3 på γs og de nye advarsler) er registreret i facit-testene, så facit stadig sammenlignes tal for tal.
- Stadig uden uafhængig kilde: forskydningsarmering (V_re, V_a, kantstang), N_cre, interaktion samt grupper ved kant i forskydning.

## 6. Hvad der mangler, før programmet kan bruges i projekter

1. Teksten til DS/EN 1992-4 (og helst DS/EN 1992-4 DK NA) til at afslutte 3.2 og 3.3.
2. Et eller flere uafhængige regneeksempler med forskydningsarmering, fx en PROFIS-rapport med kant og armering.
3. Gennemgang af en uafhængig ingeniør, dokumenteret.

**Uden for omfanget, og står i rapporten:**

- seismik, brand og udmattelse
- mekaniske ankre og ankerskinner
- fodplade og svejsninger
- betonelementets bæreevne (Anneks A)
- produktdata for indstøbte hovedbolte, der skal indtastes fra produktdokumentationen
