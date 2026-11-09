# Arkitektur- og kvalitetsvurdering – Ankerberegning EN 1992-4

Dato: 2026-11-09 · Grundlag: index.html build 2026-11-09.5 (commit 642ef08), testsuiten (40/40 grønne), samt målinger kørt mod selve programmet.

## 1. Kort konklusion

**Beregningslogikken er værd at bevare som viden, men produktet er bygget på et forkert fundament. Jeg anbefaler en genopbygning i en rigtig kodebase (ikke en omskrivning af normforståelsen), udført trinvist og med uafhængig verifikation som mål.**

Det vigtigste fund er ikke en formelfejl, men dette: **repoet indeholder slet ikke programmets kildekode.** `index.html` (910 KB) er et færdigbygget, minificeret bundt (esbuild-agtigt) med three.js indlejret. Alle 12 PR'er har rettet direkte i minificerede linjer på op til 166.000 tegn. Der findes ingen kilde, ingen build og ingen læsbare variabelnavne (`gl`, `Ji`, `qs`, `Pa`, `bl` …). Det er den største risiko for både korrekthed og videreudvikling.

## 2. Hvad jeg har kigget på

* Strukturen af index.html (adskilt og formateret for at kunne læse den).
* Testsuiten og dens reference (tests/lib/ref.mjs).
* **Empirisk afprøvning:** jeg har ændret hver enkelt indstilling/inputfelt i modellen og målt, om resultatet ændrer sig (ca. 130 felter), samt målrettede tests af de indstillinger du spurgte til.
* Jeg har *ikke* regnet normformlerne efter. Det er opgaven i tråden "Gennemgå programmet fagligt mod normen".

## 3. Fund

### 3.1 Struktur (alvorligt)
| Fund | Konsekvens |
|---|---|
| Kun bygget output er i repoet; ingen kildekode | Kan ikke reviewes (en PR-diff er 2–4 linjer à 160.000 tegn), svært at fejlfinde, hver rettelse er en risiko |
| ca. 39.700 formaterede linjer; heraf ca. 25.000 er three.js. Egen kode ca. 14.000 linjer: kerne ca. 8.000, 2D-tegning ca. 1.400, 3D ca. 2.700, rapport/UI ca. 2.700 | Kerne, tegning, rapport og UI ligger i samme scope og kalder hinanden |
| Kernen returnerer HTML-strenge (`<sub>`, `<b>`) og tekster direkte | Kernen kan ikke genbruges eller testes uden browser; tal og præsentation er blandet |
| Rester som `mock`-flag og "Midlertidig beregningskerne"-advarsel i koden | Død kode fra tidligere forløb |
| Testene kan kun køre gennem browseren (indsæt JSON via UI), ca. 27 s for 40 tests | Langsomt, skrøbeligt; kernen kan ikke enhedstestes direkte |

### 3.2 Indstillinger og datamodel (alvorligt)
Der er **afledte værdier, der gemmes som input og holdes i sync af UI-hændelser** i stedet for at blive udledt i kernen. Resultatet afhænger dermed af *hvordan* man har indtastet, ikke kun af *hvad* der står i modellen. Verificeret:

* `anker.staalklasse` alene ændrer intet i beregningen. Først når fuk/fyk også sættes (det gør UI-handleren, ikke kernen), ændres resultatet (udnyttelse 0,24 → 0,38 i testen). En importeret JSON med klasse 5.8 men fuk/fyk fra 8.8 regner stille med 8.8.
* `anker.gevind` / `anker.d` / `anker.As`: As er et selvstændigt input. Skifter man gevind-flaget i JSON uden at rette As, sker der intet.
* `indstillinger.kontrolklasse` styrer γ3 via UI-handleren; kerneværdien `gamma3` og klassen kan være uenige. I min test gav `gamma3 = 1,1` alene ingen ændring, mens `kontrolklasse = lempet` gav stor ændring (maks. udnyttelse 1,17 → 1,36). Det er forvirrende dobbelthed og skal afklares.
* Dobbeltheder: kontrolklasse + γ3, konsekvensklasse + "gang på laster" (K_FI) og for CC3 en ren advarsel, `sigmaAdm`/`beton.urevnet.sigmaR` (kun brugt til en tekstadvarsel, påvirker ikke bæreevnen), `Ec`/`Es` (påvirker kun fordelingen på stiv plade, og i eksempelmodellen stort set intet).

**Det positive:** de indstillinger, der *skal* påvirke tal, gør det: γc (1,45 → 1,8: 1,17 → 1,65), kontrolklasse, K_FI (CC1), interaktionsform (potens 1,17 → 1,19), pryout "altid", fuk/fyk, urevnet beton, kantafstande m.fl. Armeringsfelter (kantarmering, ankerarmering) blev kun målt i den inaktive grundmodel og skal derfor testes i modeller, hvor de er aktive. Det er ikke vist, at de slår igennem, kun at jeg ikke har afkræftet det.

### 3.3 Test og verifikation (middel–alvorligt)
* Reference (`ref.mjs`, 53 linjer) er skrevet fra samme norm af samme (AI-)forfatter og dækker kun en del: kun stålbrud, betonkegle, udtrækning, pry-out, betonkantbrud, interaktion. Ikke dækket: indlimede anker (gruppe, τ_Rk,c), armeret forankring/kantarmering, løftestang/slidser, hulfrigange. Det står ærligt i tests/README.md.
* Ingen test af tal fra en *anden* kilde (håndregnede normeksempler, producentens tekniske dokumentation eller PROFIS Engineering).
* Ingen kontrol af, at hver indstilling faktisk påvirker det, den skal (dét fandt jeg ved at måle, ikke ved en test).
* Ingen sporbarhed i koden fra inputfelt → normformel; delvist i output (paragrafhenvisninger og `trin` findes og er en god start).

### 3.4 Det der er godt og bør bevares
* Normhenvisninger pr. formel og mellemresultater (`trin`) i resultatet.
* Valideringslag med klare fejl og advarsler (`bl()`).
* Resultatstrukturen (eftervisninger med id, NEd/NRd, udnyttelse, styrende anker) er et fornuftigt kontraktgrænseflade.
* Testsuite og CI findes, og den fanger regressioner.
* Alt det domænearbejde, der er lagt i korrektioner (#1–#12), kan genbruges som testcases.

## 4. Valg af sprog og platform

Du spurgte, om HTML overhovedet er rigtigt. Kort svar: **ja til browseren som leveringsform, nej til at kode direkte i én HTML-fil.**

| Mulighed | Vurdering |
|---|---|
| **TypeScript + Vite, bygget til én index.html** (anbefalet) | Kører offline i browseren, ingen installation, 3D/2D kan beholdes, typer fanger mange fejl, kernen kan køre i Node til test. Samme leveringsform som nu. |
| Python (fx FastAPI + web, eller desktop) | God til beregning og til en *uafhængig reference*, men kræver server/installation for at give værdi som værktøj. Passer bedre som verifikationslag end som produkt. |
| Rust/WASM | Overkill: beregningen er få ms. Stærk typesikkerhed, men tung at vedligeholde for domæneeksperter. |
| Excel/Mathcad | Mere gennemsigtigt for ingeniører, men dårlig til 3D, versionering og automatiske tests. |

Min anbefaling: **TypeScript til produktet, Python (eller Mathcad/håndregning) til uafhængig verifikation.** To sprog giver også uafhængighed i fejlkilderne.

## 5. Tre veje

| | A. Fortsæt som nu | B. Genopbyg struktur, bevar logik (anbefalet) | C. Skriv helt forfra |
|---|---|---|---|
| Idé | Fortsæt med rettelser i den minificerede fil | Udtræk/oversæt kernen til læsbar TypeScript, opdelt efter norm-afsnit, med nyt UI-/state-lag; brug nuværende program som orakel under hele forløbet | Ny kerne og nyt UI fra normteksten |
| Omfang | Ingen | Stort (anslået 4–6 arbejdsetaper) | Størst |
| Risiko | Skjulte fejl akkumuleres; ingen kan læse koden | Moderat: sammenligning med nuværende program fanger oversættelsesfejl | Højest: genindfører fejl, mister de rettelser, der allerede er fundet |
| Fordel | Billigt nu | Samme resultater bevises tal for tal, derefter ren, vedligeholdelig kode | Ren start |
| Egnet til "bedste produkt"? | Nej | **Ja** | Kun hvis kilden viser sig uanvendelig |

## 6. Anbefalet plan (vej B)

1. **Fastfrys facit.** Generér ca. 200–500 modeller (variation i geometri, kanter, laster, indstillinger) og gem nuværende programs resultater som golden-fil. Det bliver oraklet og regressionsnettet, før noget røres.
2. **Ny kodebase.** TypeScript + Vite + `vitest`; `index.html` bygges til én fil. `APP_BUILD` bevares og tælles op automatisk i bygget.
3. **Ren beregningskerne** (`core/`, ingen DOM, ingen HTML-strenge): ét typet datamodel/skema med validering; kun *rå* input gemmes, alt afledt (As, fuk/fyk fra klasse, γ3 fra kontrolklasse) udledes i kernen. En formel pr. funktion med normparagraf i navn/metadata, og et `trin`-spor ud til rapporten.
4. **Én kilde til tekst/præsentation:** UI og rapport formaterer tal og tekst ud fra kernens strukturerede resultat.
5. **UI/state:** ét state-objekt, én vej fra felt til model til beregning; auto-genereret indstillingsdokumentation, så hvert felt har bevist effekt.
6. **Sporbarhedstabel:** felt → formelsymbol → normformel → testcase. Genereres og kontrolleres i CI (ingen "døde" felter uden begrundelse).
7. **Uafhængig verifikation:** (a) Python-reference skrevet separat direkte fra normen; (b) håndregnede normeksempler; (c) 5–10 opstillinger sammenlignet med PROFIS Engineering eller tilsvarende; (d) ingeniørgennemgang før brug i projekter.
8. **Migrering af tegning/3D/rapport** oven på den nye kerne, med visuel sammenligning.
9. Først når golden-sammenligningen er grøn, udfases den gamle fil.

## 7. Det vil jeg gerne have dit valg på

1. **Vej B (min anbefaling), A eller C?**
2. **TypeScript + Vite som platform** (bevarer "én fil, ingen installation")?
3. **Må jeg starte med trin 1 (golden-sæt) og kortlægge døde/dobbelte indstillinger fuldt ud**, så vi har et tal at måle genopbygningen mod? Det ændrer intet i produktet.

*Forbehold:* Fundene om indstillinger er målt i én eksempelmodel plus målrettede tests; de er indikationer, ikke en udtømmende dækningsanalyse. Jeg har ikke vurderet formlernes faglige rigtighed her.
