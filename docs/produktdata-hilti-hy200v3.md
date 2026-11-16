# Produktdata: Hilti HIT-HY 200-A/R V3 (ETA-19/0601, 8. sept. 2025)

Kilde: ETA-19/0601, Bilag A1, B3 (Tabel B2), C2–C4 (Tabel C1 og C2), indlimede gevindstænger, statisk last, 50 års levetid.
Værdierne er indbygget som forvalg ("Udfyld fra Hilti HIT-HY 200 V3", `app/src/core/produkter.ts`) og kontrolleret mod ETA'en ved gennemgangen 2026-11-16.

| Parameter | Værdi | Program |
|---|---|---|
| d0 (M8–M30) | 10 / 12 / 14 / 18 / 22 / 28 / 30 / 35 | ✓ |
| hef,min–hef,max | 60–160 / 60–200 / 70–240 / 80–320 / 90–400 / 96–480 / 108–540 / 120–600 | ✓ |
| smin / cmin | 40/40, 50/45, 60/45, 75/50, 90/55, 115/60, 120/75, 140/80 | ✓ |
| h_min | M8–M12: hef + 30 ≥ 100 mm; M16–M30: hef + 2·d0 | ✓ (max(hef + 30; hef + 2d0; 100) giver det samme for alle størrelser) |
| k_cr,N / k_ucr,N | 7,7 / 11,0 | ✓ |
| c_cr,N / s_cr,N | 1,5·hef / 3,0·hef | ✓ |
| c_cr,sp (h/hef ≥ 2 / mellem / ≤ 1,3) | 1,0·hef / 4,6·hef − 1,8·h / 2,26·hef | ✓ |
| s_cr,sp | 2·c_cr,sp | ✓ |
| ψc (betonstyrke) | (fck/20)^0,1, uden afrunding | ✓ (følger betonklassen automatisk) |
| ψ⁰sus, temperaturområde I / II / III | 0,80 / 0,89 / 0,72 | ✓ |
| τRk,cr, tør/våd, område I | 7,5 (M8), 9,4 (M10), 9,5 (M12–M30) | ✓ |
| τRk,cr, tør/våd, område II / III | 6,4 / 8,0 (M10–M30) og 5,5 / 6,8 (M10) / 6,9 (M12–M30) | ✓ |
| τRk,ucr, tør/våd, område I / II / III | 18 / 15 / 13 | ✓ |
| τRk, vandfyldte huller | pr. størrelse (Tabel C1) | ✓ |
| γinst | 1,0 (tør/våd, HD/HDB/DD+RT); 1,4 (vandfyldt, HD/HDB) | ✓ |
| k7 / k8 | 1,0 / 2,0 | ✓ |
| lf | min(hef; 12·dnom) for dnom ≤ 24, ellers min(hef; max(8·dnom; 300)) | ✓ |
| γMs,N / γMs,V (5.8, 6.8, 8.8) | 1,5 / 1,25 *i mangel af nationale regler* | Programmet bruger DK NA (γMs,V ≥ 1,35) |

Stål (Tabel A1):

- 5.8- og 6.8-gevindstænger efter ETA'en har brudforlængelse > 8 % (duktile). Programmets stålklasser 4.8/5.8/6.8 er sat til ikke-duktile (ISO 898-1 angiver ikke A for disse klasser). Det er på den sikre side; Hilti-forvalget sætter k7 = 1,0 direkte fra ETA'en.
- Rustfri (CRC II/III) og HCR: til og med M24 klasse 70 (fuk 700, fyk 450). **Over M24 klasse 50 (fuk 500, fyk 210).** Programmet har klassen A4-50 og advarer, hvis A4-70/A4-80 er valgt over M24.
- HCR over M20: fuk 700, fyk 400 (vælg "Brugerdefineret").

Levetid 100 år har egne τRk- og ψ⁰sus-værdier (Tabel C1, fortsat); de er ikke indbygget.
