// Betonparametre (EN 1992-1-1 Tabel 3.1) til brug i EN 1992-4.

/** Udtrækker fck [MPa] af klassenavn, fx "C30/37" → 30. NaN hvis ukendt. */
export function fckAfKlasse(klasse: unknown): number {
  const m = /C\s*(\d+(?:[.,]\d+)?)/i.exec(String(klasse ?? ''));
  return m ? Number(m[1]!.replace(',', '.')) : NaN;
}

/** Karakteristisk betonstyrke: eksplicit fck har forrang, ellers afledes den af klassen (standard C30/37). */
export function fckAf(beton: { klasse?: string | null; fck?: number | null }): number {
  return beton.fck ?? fckAfKlasse(typeof beton.klasse === 'string' ? beton.klasse : 'C30/37');
}

/** Karakteristisk aksial trækstyrke fctk,0.05 [MPa] (EN 1992-1-1 Tabel 3.1). */
export function fctk005(fck: number): number {
  return fck <= 50 ? 0.7 * 0.3 * fck ** (2 / 3) : 0.7 * 2.12 * Math.log(1 + (fck + 8) / 10);
}

/** Beregningsværdi af vedhæftningsstyrke fbd (EN 1992-1-1, 8.4.2) – fck begrænses til 60 MPa. */
export function vedhaeftning(p: { fck: number; eta1?: number; ds: number; alphaCt?: number; gammaCt: number }) {
  const fckB = Math.min(p.fck, 60);
  const fctk = fctk005(fckB);
  const fctd = ((p.alphaCt ?? 1) * fctk) / p.gammaCt;
  const eta2 = p.ds <= 32 ? 1 : (132 - p.ds) / 100;
  return { fbd: 2.25 * (p.eta1 ?? 1) * eta2 * fctd, fctd, fctk, eta2, fckB };
}

/** Sekantmodul Ecm [MPa] efter EN 1992-1-1 Tabel 3.1 (fck → Ecm i GPa); ukendt fck → 22·((fck+8)/10)^0,3. */
const ECM_GPA: Record<number, number> = { 12: 27, 16: 29, 20: 30, 25: 31, 30: 33, 35: 34, 40: 35, 45: 36, 50: 37, 55: 38, 60: 39, 70: 41, 80: 42, 90: 44 };
export function ecmAfFck(fck: number): number {
  const t = ECM_GPA[fck];
  return (t ?? 22 * ((fck + 8) / 10) ** 0.3) * 1000;
}
