# Brugsvejledning: Ankerberegning efter DS/EN 1992-4

Programmet eftervise indstøbte bolte og indlimede gevindstænger i beton efter DS/EN 1992-4:2018 med DK NA:2024 (statisk/kvasistatisk last, brudgrænsetilstand). Det er ét HTML-dokument (`index.html` i roden) og kører offline i browseren. Resultaterne skal vurderes af den ansvarlige ingeniør.

## Kom i gang
1. Åbn `index.html`. Knappen **Eksempel** indlæser en komplet sag, så du kan se, hvordan den er bygget op.
2. Udfyld sektionerne fra top til bund: **Anker**, **Opstilling** (bolte og mønstre), **Beton**, **Plade**, **Laster** og **Nationale parametre**. Feltfejl vises ved feltet, og modellen ændres ikke, før værdien er gyldig.
3. Resultatet opdateres løbende til højre: samlet udnyttelse, styrende brudform og en tabel med alle brudformer. Vælg lastkombination med knapperne over tabellen.
4. Er resultatet ikke ok, vises **justeringsforslag** (fx større hef, betonklasse eller armering). **Anvend** ændrer modellen, og forslagene regnes om.

## Indlimede anker
Vælg ankertype *Indlimet*. Blokken **Udfyld fra Hilti HIT-HY 200 V3** sætter d, d0, hef-interval, smin, cmin, τRk, ψ⁰sus, kcr/kucr, γinst og ψc fra ETA-19/0601. Tryk **Anvend** igen, hvis betonklassen ændres (ψc afhænger af den). Stålklasse og hef vælges selv. Værdier for andre produkter indtastes fra deres ETA.

## Visninger
- **Plan**: fodplade, bolte med kraft, trykzone og kanter.
- **Snit**: lodret snit langs x eller y med hef, c og h.
- **3D**: drejes med musen. Knapper: kamera (Iso, Oppefra, Forfra, Fra siden), **Mål** (til/fra), **Brudlegeme** (idealiseret kegle/kantbrudskile for den styrende brudform). Armering vises, når den er slået til i modellen: trækbøjler som lukkede bøjler med dornbøjede hjørner (4⌀ for ⌀ ≤ 16 mm, ellers 7⌀) omsluttende overfladearmeringen, som tegnes som stænger med den angivne diameter og afstand (knappen **Overfladearm.** slår dem til/fra). Armeringens tegning følger inddata, men overfladearmeringens egne forudsætninger kontrolleres ikke af programmet.

## Gem, åbn og rapport
- **Gem** henter projektet som JSON, **Åbn …** og **Indsæt JSON** indlæser det igen. Programmet gemmer også automatisk i browseren.
- **Rapport** åbner en udskrivbar rapport med inddata, resultater, partialkoefficienter og bemærkninger. **Kopiér rapport** lægger en kort tekstudgave i udklipsholderen.
- **Ajour-mærket** øverst viser, om din fil er den nyeste version.

## Laster
Laster indtastes som **designværdier** (inkl. evt. K_FI). Programmet ganger ikke K_FI på. Fortegn: N positiv = træk; Vx, Vy og momenter følger akserne vist i 3D.

## Grænser og vigtige forbehold
- Dækket: træk (stål, udtrækning/vedhæftning, betonkegle, spaltning, sideudsprængning, armering), forskydning (stål, kantbrud, pry-out, armering) og interaktion.
- Ikke dækket: udmattelse, seismik, brand, ulykkeslast i brugerfladen (kernen er forberedt), ankerskinner, ekspansions- og skrueanker.
- Indstøbte anker uden produktdata: ccr,sp og hmin er **skøn** og markeres som sådan. Hent dem fra produktets ETA.
- Brudlegemerne i 3D er vejledende idealiseringer, ikke beregningsgrundlag.
- Verifikation: kernen er afprøvet mod den gamle kerne, en uafhængig Python-reference, normens eksempler, DK NA Tabel 4.1 og et offentligt Hilti PROFIS-regneeksempel (enkeltanker). Grupper, momenter, spaltning og armering mangler endnu en uafhængig kilde, se `docs/verifikation.md` og `docs/kritiske-fund.md`.
