# Verifikation mod Hilti PROFIS-rapporter

Fem PROFIS Engineering-rapporter (version 3.1.38, DS EN 1992-4 DK NA, 9. november 2026) er indlagt som testtilfælde i `app/src/core/profis.test.ts`. Rapporterne kommer fra brugerens egne beregninger. Alle tal er kopieret fra rapporterne.

| Rapport | Anker | Beton | Last |
|---|---|---|---|
| MC-B12 | 8 × HAS-U 8.8 M20, hef 205 | C30/37, h 250, revnet | N 169, Vx 81, Vy −1, My 8,1 (lastpunkt y = 20 mm) |
| MC-G10 | 8 × HAS-U 8.8 M20, hef 120 | C30/37, h 250, revnet | N 72, Vx 31, Vy −54, Mx 10,8, My 6,2 |
| WT01 B26 | 2 × HAS-U 8.8 M30, hef 200 | C25/30, h 270, revnet | Vy −50,2, Mx 5,5 (HE220B-søjle) |
| Kassø HEB100-søjle | 4 × HAS-U 8.8 M12, hef 90 | C25/30, h 400, revnet | Mx 5,5 |
| Kassø L-jern | 3 × HUS4-H 10 (mekanisk), hef 50 | C35/45, h 250, revnet | Vy −8,8 i højde 40 mm |

Alle fem har ingen kanter og ingen armering i forankringszonen, så de dækker **grupper, momenter, trykzone og vridning**, men ikke armering, kantbrud eller spaltning.

## Resultat

Kernen genskaber PROFIS' tal for de fire indlimede anker:

- **Ankerkræfter og trykresultant** stemmer på tre decimaler (kN) i alle fire, også med vridning og moment om begge akser, **når Ec = 30 000 N/mm²** (se forskel 1).
- **Forskydning pr. anker inkl. vridning** stemmer på tre decimaler (B12).
- **N_Rd,s, N_Rd,p, N_Rd,c, V_Rd,s og V_Rd,cp for gruppen** stemmer inden for 0,04 % (afrunding i rapporterne). Det dækker bl.a. Ac,N/A⁰c,N for grupper, ψec,N for begge akser, ψM,N (inkl. 1,697 i B26) og pry-out for en gruppe.
- Interaktionen (7.2.3) giver samme tal, når PROFIS' udnyttelser omregnes (PROFIS runder op: 0,9829 vises som 99 %).

For L-jernet (mekanisk skrueanker) findes der ingen produktdata i programmet. Lastfordelingen (3 × 4,226 kN, trykresultant 12,677 kN i y = −27,8 mm) og ψM,N = 1,631 stemmer.

## Forskelle, som slår igennem

1. **Ec (elasticitetsmodul for beton).** PROFIS bruger Ec = 30 000 N/mm² for alle betonklasser; det er eftervist ved at indsætte 30 000 i programmets felt Ec (C25/30 og C30/37 giver ens resultater til tre decimaler). Programmets standard er Ecm efter EN 1992-1-1 (C25/30: 31 000, C30/37: 33 000). Det ændrer ankerkræfterne med op til 0,15 kN i G10 og for et let belastet anker op til 15 % (anker 7: 0,978 mod 0,847 kN). Den styrende udnyttelse ændrer sig højst 0,3 procentpoint. Programmets valg er det normmæssigt begrundede; sæt Ec = 30 000 for at kunne sammenligne direkte med PROFIS.
2. **Lastangrebspunkt.** PROFIS tillader, at lasten angribes uden for pladens midte (B12: y = +20 mm). Det giver et ekstra moment (N·e) og en vridning (V·e) på ankrene. Programmet har ingen indtastning af lastpunkt, så momentet og vridningen skal regnes om ved indtastning (B12: Mx = 3,38 kNm, T = −1,62 kNm). Det er en funktion, der mangler.
3. **Pry-out under vridning (B12).** Når vridning giver forskydningskræfter i forskellige retninger, kontrollerer programmet pry-out pr. enkeltanker (konservativt, indstillingen "Ved vridning/modsatte V"). PROFIS kontrollerer kun gruppen. Resultatet for B12: PROFIS 100 % (OK), programmet 111 % (ikke OK). Begge er forsvarlige fortolkninger, men programmet er her strengere. Det bør afklares mod normteksten, om enkeltankertjekket kræves (QS-03).
4. **ψc afrundet (rettet).** Programmets Hilti-præset rundede ψc = (fck/20)^0,1 ned til to decimaler (1,02 i stedet for 1,023). ETA'en angiver formlen uden afrunding, så præsettet bruger nu den eksakte værdi. Effekten var 0,1–0,25 % på N_Rd,p (konservativ).
5. **N_Rk,s for M12.** PROFIS bruger 67,4 kN (ETA-tabel), programmet 84,3 mm² · 800 MPa = 67,44 kN (0,06 %).

## Forhold, der ikke er forskelle

- Standardværdien "Tæt armering" (ψre,N = 0,5 + hef/200) er konservativ. PROFIS-rapporterne antager "ingen armering eller afstand ≥ 150 mm" (ψre,N = 1); testene sætter programmets felt til "Åben".
- Delsikkerhedsfaktorerne γMc = 1,45, γMs = 1,5 (træk) og 1,35 (forskydning) er identiske med DK NA. For skrueankeret (L-jern) bruger PROFIS γMc = 1,74 (= 1,45 · 1,2 for installationsfølsomhed).
- PROFIS bruger hef,opti i B12 og G10 (hef = 205 og 120 mm); det er alene et inddata.

## Hvad der stadig mangler en uafhængig kilde

Armering (ankerarmering og kantarmering), spaltning, kantbrud (V_c), sideudsprængning og slidshuller. Her bør der indhentes PROFIS-rapporter med kanter og armering.
