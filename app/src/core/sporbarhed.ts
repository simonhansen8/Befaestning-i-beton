// Sporbarhed: for hver brudform – normhenvisning, implementering og dokumentation af hvordan den er kontrolleret.
// Tabellen testes mod kernens faktiske brudform-id'er, facit-sættet og den uafhængige reference, og gengives i docs/sporbarhed.md.

export interface Sporbarhed {
  id: string;
  navn: string;
  /** Normhenvisning (EN 1992-4:2018). */
  paragraf: string;
  /** Ligningsnumre der er kontrolleret mod referenceimplementeringen; tomt hvis ingen. */
  formler: string[];
  /** Implementering (relativt til app/src/core/). */
  fil: string;
  /** Test mod facit (gammel kerne). */
  facit: string;
  /** Åbne forbehold fra docs/kritiske-fund.md. */
  forbehold: string[];
}

export const SPORBARHED: Sporbarhed[] = [
  { id: 'N_s', navn: 'Stålbrud, træk', paragraf: '7.2.1.3', formler: ['(7.1)'], fil: 'tension.ts', facit: 'tension.golden.test.ts', forbehold: ['#6 γMs (DK NA)'] },
  { id: 'N_p', navn: 'Udtrækning', paragraf: '7.2.1.5 (indstøbt), 7.2.1.6 (indlimet)', formler: ['(7.12)'], fil: 'tension.ts / bond.ts', facit: 'tension.golden.test.ts', forbehold: [] },
  { id: 'N_c', navn: 'Betonkegle', paragraf: '7.2.1.4', formler: [], fil: 'cone.ts', facit: 'cone.golden.test.ts', forbehold: [] },
  { id: 'N_sp', navn: 'Spaltning', paragraf: '7.2.1.7', formler: [], fil: 'splitting.ts', facit: 'splitting.golden.test.ts', forbehold: ['#11 ccr,sp og hmin skønnet'] },
  { id: 'N_cb', navn: 'Sidebrud', paragraf: '7.2.1.8', formler: [], fil: 'sideblowout.ts', facit: 'sideblowout.golden.test.ts', forbehold: [] },
  { id: 'N_re', navn: 'Ankerarmering i træk (stål)', paragraf: '7.2.1.2(2)', formler: [], fil: 'reinforcement.ts', facit: 'kombination.golden.test.ts', forbehold: ['#14 dnom/ben pr. anker'] },
  { id: 'N_a', navn: 'Ankerarmering i træk (forankring)', paragraf: '7.2.1.2(2)', formler: [], fil: 'reinforcement.ts', facit: 'kombination.golden.test.ts', forbehold: ['#14 dnom/ben pr. anker'] },
  { id: 'N_cre', navn: 'Betonkegle med ankerarmering', paragraf: '7.2.1.2(2)', formler: [], fil: 'reinforcement.ts', facit: 'kombination.golden.test.ts', forbehold: [] },
  { id: 'V_s', navn: 'Stålbrud, forskydning', paragraf: '7.2.2.3', formler: ['(7.37)'], fil: 'shear.ts', facit: 'shear.golden.test.ts', forbehold: ['#6 γMs,V (DK NA)'] },
  { id: 'V_cp', navn: 'Pry-out', paragraf: '7.2.2.4', formler: ['(7.39)'], fil: 'shear.ts', facit: 'shear.golden.test.ts', forbehold: [] },
  { id: 'V_c', navn: 'Betonkantbrud', paragraf: '7.2.2.5', formler: [], fil: 'edgebreakout.ts', facit: 'shear.golden.test.ts', forbehold: [] },
  { id: 'V_re', navn: 'Ankerarmering i forskydning (stål)', paragraf: '7.2.2.6', formler: [], fil: 'reinforcement.ts', facit: 'kombination.golden.test.ts', forbehold: ['#12 kant vælges på tværs af kombinationer', '#13 V_re-formel/k10'] },
  { id: 'V_a', navn: 'Ankerarmering i forskydning (forankring)', paragraf: '7.2.2.6', formler: [], fil: 'reinforcement.ts', facit: 'kombination.golden.test.ts', forbehold: ['#13 V_re-formel/k10'] },
  { id: 'NV_s', navn: 'Interaktion, stål', paragraf: '7.2.3', formler: ['(7.54)'], fil: 'interaction.ts', facit: 'kombination.golden.test.ts', forbehold: [] },
  { id: 'NV_c', navn: 'Interaktion, beton', paragraf: '7.2.3', formler: ['(7.55)', '(7.56)', '(7.57)'], fil: 'interaction.ts', facit: 'kombination.golden.test.ts', forbehold: [] },
  { id: 'NV_re', navn: 'Interaktion, ankerarmering', paragraf: '7.2.3', formler: ['(7.55)', '(7.56)', '(7.57)'], fil: 'interaction.ts', facit: 'kombination.golden.test.ts', forbehold: [] },
];

/** Markdown-tabellen i docs/sporbarhed.md. `uafhaengige` = id'er hvor Rk er kontrolleret mod den uafhængige Python-reference. */
export function sporbarhedMarkdown(uafhaengige: string[], antalModeller: number): string {
  const r = (s: Sporbarhed) => `| ${s.id} | ${s.navn} | EN 1992-4, ${s.paragraf} | ${s.formler.join(' ') || '–'} | \`${s.fil}\` | ${uafhaengige.includes(s.id) ? 'ja' : 'nej'} | \`${s.facit}\` | ${s.forbehold.join('; ') || '–'} |`;
  return `# Sporbarhed: brudform → norm → kode → kontrol

Genereres af \`app/src/core/sporbarhed.test.ts\` (\`npm run sporbarhed\`); CI fejler, hvis filen er ude af trit med \`sporbarhed.ts\`, kernen, facit-sættet eller den uafhængige reference.

- **Facit**: sammenligning med den gamle kerne på ${antalModeller} modeller (\`golden/cases.json\`).
- **Uafhængig**: karakteristisk kapacitet (Rk) er sammenlignet med \`verifikation/reference.py\`, som er skrevet direkte efter normens formler.
- Ligningsnumre er kun angivet for formler, der er kontrolleret mod referencen eller kendt entydigt; øvrige formler er angivet med afsnit.
- Afsnitsnumre er hentet fra de henvisninger programmet i forvejen bruger (felt-skema og diagnoser) og er ikke kontrolleret mod normteksten.

| Id | Brudform | Norm | Formler | Implementering | Uafhængig | Facit-test | Åbne forbehold |
|---|---|---|---|---|---|---|---|
${SPORBARHED.map(r).join('\n')}

Forbehold henviser til \`docs/kritiske-fund.md\`.
`;
}
