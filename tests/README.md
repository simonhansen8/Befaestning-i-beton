# Test af beregningskernen

Kør: `npm install && npx playwright install chromium && npm test`

Programmet er én HTML-fil. Testene åbner den i headless Chromium, indlæser modeller som en bruger
(Projekt → Indsæt JSON) og læser resultatet fra `window.__anker`. `index.html` ændres ikke.

## Hvad testes
* `engine.test.mjs` – kernen mod en **uafhængig** referenceimplementation (`lib/ref.mjs`, skrevet fra
  normens ligninger): stålbrud, betonkegle (enkelt, gruppe, kanter, hjørne, excentricitet), udtrækning,
  pry-out, betonkantbrud (vinkelret/væk/parallelt, tynd plade, urevnet), interaktion (7.54–7.56),
  indlimet basisværdi, samt egenskabstests: statisk ligevægt, lineær skalering, spejlingssymmetri,
  ingen NaN/∞, afvisning af ugyldigt input.
* `ui.test.mjs` – røgtest: ingen JS-fejl, 2D/3D tegner, kameravinkler, rapport, JSON-rundtur, fejlvisning.

## Hvad testene IKKE kan bevise
* At referenceformlerne selv er rigtige: de er skrevet fra den samme norm af den samme (AI-)forfatter.
  Fælles misforståelser af normteksten opdages ikke.
* DK NA-værdier (γ-faktorer m.m.) er kun låst som "forventet værdi" – de skal kontrolleres mod NA'en.
* Ikke dækket: de fleste indlimede-anker-formler (gruppe, ψg,Np, τRk,c), armeret forankring/kantarmering,
  løftestang/slidser, store hulfrigange, pladeeftervisning og andet uden for programmets omfang.
* Test = regression + intern konsistens, ikke certificering.

## Anbefalet supplement
Uafhængig ingeniørgennemgang og sammenligning med et kommercielt værktøj (fx Hilti PROFIS Engineering)
på 5–10 repræsentative opstillinger, før programmet bruges til projekter.
