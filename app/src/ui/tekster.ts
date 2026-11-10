// Præsentationslag: kodede diagnoser → dansk tekst. Kernen indeholder ingen tekst; hver kode skal have en tekst her (testes).
import type { Diagnostik } from '../core/diagnostik';

type D = Diagnostik['data'];
const t = (v: unknown, dec = 1): string => {
  if (typeof v !== 'number') return String(v ?? '–');
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
  return (+v.toFixed(dec)).toString().replace('.', ',').replace('-', '−');
};
const t0 = (v: unknown) => t(v, 0);
const MANGEL: Record<string, (d: D) => string> = {
  'l1-for-kort': (d) => `benenes forankringslængde l1 i brudkeglen er kun ${t0(d.l1)} mm mod krav ${t0(d.l1min)} mm. l1 beregnes af geometrien (hef − tan 35°·afstand − dæklag c_top, 7.2.1.2(2)d) og kan ikke indtastes – gør bøjlen længere ved at mindske c_top eller afstanden x, øge hef, bruge færre bøjler, eller vælg bøjning ved overfladen (krav 4⌀ i stedet for 10⌀)`,
  'afstand-over-0.75hef': (d) => `benene ligger ${t0(d.rad)} mm fra ankeret, dvs. uden for 0,75·hef = ${t0(0.75 * Number(d.hef))} mm (7.2.1.2(2)c) – mindsk afstanden x`,
  'skaerer-skaft': () => 'bøjleparrets plan ligger tættere på boltens akse end ⌀/2 – bøjlen skærer skaftet (7.2.1.2(2)c: så tæt på som praktisk muligt, men ikke gennem ankeret)',
  'dia-over-16': () => 'stangdiameter over 16 mm',
  'fyk-over-600': () => 'fyk,re over 600 MPa',
  'intet-ben': () => 'ingen ben',
  'ingen-virksomme-ben': (d) => `ingen stænger er virksomme (ligger inden for 0,75·c1 og har l1 ≥ ${t0(d.l1min)} mm)`,
  'intet-virksomt-ben-forreste': () => 'ingen ben i forreste række',
};
const manglerTekst = (m: unknown, d: D): string => String(m ?? '').split(', ').filter(Boolean).map((k) => MANGEL[k]?.(d) ?? k).join('; ') + '.';
const t2 = (v: unknown) => t(v, 2);
const KANT: Record<string, string> = { xNeg: 'x−', xPos: 'x+', yNeg: 'y−', yPos: 'y+' };
const kant = (v: unknown) => KANT[String(v)] ?? String(v ?? '');

export const TEKSTER: Record<string, (d: D) => string> = {
  // Indlæsning
  'model-mangler': () => 'Modellen mangler eller er ikke et objekt.',
  'ugyldig-vaerdi': () => 'Ugyldig værdi.',
  'vaerdi-for-lav': (d) => `Værdien skal være ${d.streng ? 'større end' : 'mindst'} ${t(d['grænse'], 2)} (angivet ${t(d.angivet, 2)}).`,
  'vaerdi-for-hoej': (d) => `Værdien må højst være ${t(d['grænse'], 2)} (angivet ${t(d.angivet, 2)}).`,
  'ingen-bolte': () => 'Ingen bolte i opstillingen.',
  'bolt-id-ikke-entydige': () => 'Bolte-id er ikke entydige.',
  'ukendt-ankertype': (d) => `Ukendt ankertype "${d.angivet}" – regnet som indstøbt.`,
  'as-estimeret': (d) => `Spændingsarealet for d = ${t0(d.d)} mm findes ikke i tabellen – estimeret til ${t0(d.As)} mm². Angiv As.`,
  'fyk-over-fuk': (d) => `fyk = ${t0(d.fyk)} MPa skal være mindre end fuk = ${t0(d.fuk)} MPa.`,
  'hoveddiameter-for-lille': (d) => `Hoveddiameter dh = ${t0(d.dh)} mm skal være større end d = ${t0(d.d)} mm.`,
  'gamma-inst-under-1': (d) => `γinst = ${t2(d.gammaInst)} < 1,0 – værdien bruges, men er ikke tilladt efter DK NA.`,
  'ukendt-betonklasse': (d) => `Ukendt betonklasse "${d.klasse}".`,
  'kantafstand-negativ': (d) => `Kantafstand ${t0(d['værdi'])} mm er negativ.`,
  'kantstang-lige': () => 'Kantarmering "lige kantstang" giver ψre,V = 1,0 i EN 1992-4:2018.',
  'kantstang-lige-fjernet': () => 'Kantarmering "lige kantstang" findes ikke i EN 1992-4:2018 og er sat til "ingen" (ψre,V = 1,0).',
  'plade-slids-som-stor-hulfrigang': () => 'Slidshul skal angives pr. bolt og retning. Pladens "slids" er regnet som stor hulfrigang (konservativt).',
  'slidshul-pr-bolt': () => 'Hulfrigang "slidshul" angives nu pr. bolt under Opstilling.',
  'kfi-paa-laster-ignoreres': () => 'Filen angiver at lasterne skal ganges med KFI. Det gøres ikke længere: lasterne indtastes som designværdier inklusive KFI.',
  'psi0-sus-standard': () => 'ψ⁰sus er ikke angivet – standardværdien 0,6 er brugt (erstat med ETA-værdi).',
  'last-ugyldigt-felt': (d) => `Ugyldige værdier i lasten (${d.felter}) er sat til 0 / ikke angivet.`,
  'ingen-lastkombinationer': () => 'Ingen lastkombinationer angivet – regnet med nul-last.',
  'indstilling-justeret': (d) => String(d.tekst),
  'taetArmering-erstattet': () => 'Feltet "taetArmering" er erstattet af "Armering i forankringszonen" = tæt (konservativt). Vælg "åben" hvis armeringsafstanden er ≥ 150 mm (≥ 100 mm for ⌀ ≤ 10) eller der ikke er armering i zonen.',
  'antal-ben-omregnet': (d) => `"Antal ben i alt" (${t0(d.antalBen)}) er omregnet til ${t0(d.benPrAnker)} ben pr. anker.`,
  'skaerpet-kontrolklasse': () => 'Skærpet kontrolklasse (γ3 = 0,95) er ikke hjemlet for befæstelser og er sat til udførelsesklasse (γ3 = 1,00).',
  'ikke-standarddiameter': (d) => `d = ${t0(d.d)} mm er ikke en standarddiameter – As skal kontrolleres.`,
  'intet-versionsfelt': () => 'Filen har intet versionsfelt – fortolket som version 1.',
  // Model (validering)
  'bolt-uden-for-beton': (d) => `Bolt ${d.id} ligger uden for betonen (kant ${kant(d.kant)}).`,
  'bolt-uden-for-fodplade': (d) => `Bolt ${d.id} ligger uden for fodpladen (${t0(d.bx)} × ${t0(d.by)} mm, hulfrigang ${t0(d.df)} mm).`,
  'bolt-taet-paa-pladekant': (d) => `Bolt ${d.id}: afstand til pladekant ${t0(d.afstand)} mm er under 1,2·d0 = ${t0(d['grænse'])} mm.`,
  'bolte-sammenfaldende': (d) => `Bolt ${d.id1} og ${d.id2} er (næsten) sammenfaldende (afstand ${t(d.s, 1)} mm).`,
  'hoved-uden-for-beton': (d) => `Boltens hoved rager ud over betonkanten (c = ${t0(d.c)} mm < dh/2 = ${t0(d.halvHoved)} mm).`,
  'tykkelse-under-hmin': (d) => `Elementtykkelsen h = ${t0(d.h)} mm er under hmin = ${t0(d.hmin)} mm${d.angivet ? ' (ETA)' : ''}.`,
  'hef-under-40': (d) => `hef = ${t0(d.hef)} mm er under 40 mm.`,
  'hef-under-hefmin': (d) => `hef = ${t0(d.hef)} mm er under produktets hef,min = ${t0(d.hefMin)} mm.`,
  'hef-over-hefmax': (d) => `hef = ${t0(d.hef)} mm er over produktets hef,max = ${t0(d.hefMax)} mm.`,
  'hef-over-20d': (d) => `hef = ${t0(d.hef)} mm overstiger 20·d = ${t0(d['grænse'])} mm.`,
  'hef-under-4d': (d) => `hef = ${t0(d.hef)} mm er under 4·d = ${t0(d['grænse'])} mm (uden for typisk ETA-område).`,
  'betonklasse-uden-for-eta': (d) => `Betonklassen ${d.klasse} ligger uden for produktets område (${d.min} – ${d.max}).`,
  'taurk-cr-mangler': () => 'τRk,cr (revnet beton) mangler – angiv værdi fra ETA.',
  'taurk-ucr-mangler': () => 'τRk,ucr (urevnet beton) mangler – angiv værdi fra ETA.',
  'taurk-ucr-under-cr': () => 'τRk,ucr er mindre end τRk,cr – kontrollér ETA-værdierne.',
  'produktvaerdier-fra-eta': () => 'Produktværdier (τRk, ψc, ψ⁰sus, hef-grænser …) skal hentes fra produktets ETA og er ikke kontrolleret af programmet.',
  'hoved-areal-begraenset': (d) => `Hovedets bæreareal er begrænset (dh = ${t0(d.dh)} mm > 6·th + d = ${t0(d['grænse'])} mm).`,
  'ccrsp-er-skoen': () => 'ccr,sp og hmin er skønnet (EAD-udtryk). Erstat med ETA-værdier.',
  'fck-over-60': (d) => `fck = ${t0(d.fck)} MPa: der regnes højst med 60 MPa i betonbrud (EN 1992-4, 7.1(2)).`,
  'fck-uden-for-c12-c90': (d) => `fck = ${t0(d.fck)} MPa ligger uden for C12/15–C90/105.`,
  'betonklasse-ikke-standard': (d) => `Betonklassen "${d.klasse}" er ikke en standardklasse; fck = ${t0(d.fck)} MPa er brugt.`,
  'dnom-over-60': (d) => `dnom = ${t0(d.dnom)} mm overstiger 60 mm (EN 1992-4, 7.2.2.5).`,
  'fuk-over-1000': () => 'fuk overstiger 1000 MPa – ikke omfattet af EN 1992-4.',
  'plade-ikke-paa-beton': () => 'Fodpladen ligger ikke på betonen (ingen overlap).',
  'plade-rager-ud-over-kant': (d) => `Fodpladen rager ud over betonkanten (${d.kanter}); trykzonen er klippet til betonen.`,
  'plade-forudsat-stiv': () => 'Fodpladen forudsættes stiv (EN 1992-4, 6.2.1 (2)); stivhed og pladebøjning er ikke eftervist.',
  'ligningsnumre-ikke-kontrolleret': () => 'Ligningsnumre og henvisninger i rapporten er ikke kontrolleret mod normteksten.',
  'plade-tynd': (d) => `Pladetykkelsen t = ${t0(d.t)} mm er mindre end d = ${t0(d.d)} mm.`,
  'stor-hulfrigang': () => 'Stor hulfrigang: forskydning og vridning regnes kun optaget af anker i én retning (Tabel 6.1).',
  'mellemlaeg-inkonsistent': (d) => `Afstand til beton e = ${t0(d.e)} mm men mellemlæg er "ingen" – angiv mellemlæg.`,
  'slidshuller': (d) => `Slidshuller: ${d.bolte}. Ankrene tager ikke forskydning i slidsens retning.`,
  'urevnet-forudsaetning': () => 'Urevnet beton forudsætter at betonen er eftervist urevnet i brugsgrænsetilstand (σL + σR ≤ σadm).',
  'urevnet-ikke-eftervist': (d) => `σL + σR = ${t2(d.sum)} MPa overstiger σadm = ${t2(d.sigmaAdm)} MPa – betonen kan ikke regnes urevnet.`,
  'psi-re-v-hef-for-lille': (d) => `ψre,V = 1,4 kræver hef ≥ 2,5·cnom; her hef = ${t0(d.hef)} mm < ${t0(d['grænse'])} mm.`,
  'psi-re-v-krav-ikke-opfyldt': () => 'Kravene til kantarmering (bøjleafstand ≤ 100 mm, ⌀ ≥ 12 mm) er ikke opfyldt – ψre,V = 1,0.',
  'psi-re-v-krav-pr-kant': () => 'Kantarmering er forudsat opfyldt for hver belastet kant.',
  'ankerarmering-traek-forbehold': (d) => `Ankerarmering i træk er medregnet efter EN 1992-4, 7.2.1.2(2)${d.stoed ? ' (med støbefuge)' : ''}, men forudsætning ${d.mangler} er ikke bekræftet. Programmet kontrollerer selv ⌀ ≤ 16 mm, fyk ≤ 600 MPa, afstand ≤ 0,75·hef og l1; resten bekræftes med afkrydsningsfelterne under "Ankerarmering for træk".`,
  'ankerarmering-traek-bekraeftet': (d) => `Forudsætningerne a${d.stoed ? ', e' : ''} og f i EN 1992-4, 7.2.1.2(2) er bekræftet af brugeren.`,
  'ankerarmering-forskydning-forbehold': (d) => `Ankerarmering i forskydning (${d.type}) er medregnet efter EN 1992-4, 7.2.2.2(2); forudsætningerne skal kontrolleres.${d.kantstangMangler ? ' Kantstangen langs kanten er ikke bekræftet: 7.2.2.2(3)f) kræver den dimensioneret efter en strut-and-tie-model (45° trykstivere), og programmet regner den ikke – bekræft under "Ankerarmering for forskydning".' : ''}`,
  'national-parameter-aendret': (d) => d.dkNa == null ? `${d.parameter} er overstyret manuelt til ${t(d['vaerdi'], 0)} (uden angivelse udledes værdien af betonklassen).` : `National parameter ${d.parameter} er ændret til ${t(d['vaerdi'], 3)} (DK NA: ${t(d.dkNa, 3)}).`,
  // Kombination
  'lastfordeling-ikke-konvergeret': (d) => `Lastfordelingen konvergerede ikke (residual ${t(d.residual, 3)}).`,
  'ankre-med-lille-traek': (d) => `Ankre med lille trækkraft (< 5 % af største) udelades af trækgruppen: ${d.ankre}.`,
  'betontryk-over-3fcd': (d) => `Betontrykket ${t(d.sigma, 1)} MPa under pladen overstiger 3·fcd = ${t(d['grænse'], 1)} MPa.`,
  'trykzone': (d) => `Trykzone under pladen: C = ${t(Number(d.C) / 1000, 1)} kN, σmax = ${t(d.sigma, 1)} MPa.`,
  'forskydning-kan-ikke-optages': () => 'Vridning/forskydning kan ikke optages af de virksomme ankre.',
  'loeftestang': (d) => `Løftestang (6.2.2.3): αM = ${t0(d.alphaM)}.`,
  'alpha-sus-over-psi0': (d) => `αsus = ${t2(d.alphaSus)} overstiger ψ⁰sus = ${t2(d.psi0Sus)}; vedhæftningen reduceres.`,
  'ankerarmering-traek-ikke-virksom': (d) => `Ankerarmering i træk er ikke virksom: ${manglerTekst(d.mangler, d)}`,
  'ankerarmering-boejler-for-dybt': (d) => `${t0(d.antal)} af ${t0(d.af)} bøjler ligger for dybt (> 0,75·hef) og er ikke medregnet.`,
  'fuk-over-1000-forskydning': () => 'fuk > 1000 MPa: stålbrud i forskydning kan ikke eftervises efter 7.2.2.3.1.',
  'spaltning-udeladt-armering': () => 'Spaltning er udeladt, fordi revnebegrænsende armering er forudsat (7.2.1.7 (2) b).',
  'kantbrud-kant-for-fjern': (d) => `Kant ${kant(d.kant)} er for langt væk til at give kantbrud.`,
  'dnom-over-60-kantbrud': (d) => `dnom = ${t0(d.dnom)} mm > 60 mm i kantbrud (7.2.2.5).`,
  'forskydningsarmering-kant-ikke-belastet': (d) => `Forskydningsarmeringens kant ${kant(d.kant)} er ikke belastet; armeringen er ikke medregnet.`,
  'ankerarmering-forskydning-ikke-virksom': (d) => `Ankerarmering i forskydning er ikke virksom: ${manglerTekst(d.mangler, d)}`,
  'forskydningsarmering-daekker-kun-en-kant': (d) => `Forskydningsarmeringen dækker kun én kant; kant ${d.kanter} er uden armering.`,
  'overfladearmering-staenger-ikke-virksomme': (d) => `${t0(d.antal)} af ${t0(d.af)} overfladestænger opfylder ikke 7.2.2.2(3)c–d og er ikke medregnet.`,
  'forskydningsarmering-kant-valgt-automatisk': (d) => `Forskydningsarmeringens kant (${kant(d.kant)}) er valgt automatisk som den mest udnyttede kant uden armering (lastkombination ${t0(Number(d.kombination) + 1)}).`,
  // Interne koder
  'fejl': (d) => String(d.tekst ?? 'Fejl'),
};

export function tekst(d: Diagnostik): string {
  const f = TEKSTER[d.kode];
  return f ? f(d.data) : `${d.kode}${Object.keys(d.data).length ? ' ' + JSON.stringify(d.data) : ''}`;
}
