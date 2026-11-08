// UAFHÆNGIG referenceimplementation af udvalgte formler i DS/EN 1992-4:2018.
// Skrevet fra normens ligninger (ikke fra index.html) – bruges kun til at
// krydstjekke beregningskernen. Enheder: N, mm, MPa. Kræfter i N.
// Partialkoefficienter (DK NA) er INPUT og kontrolleres separat i tests.

// --- 7.2.1.3 Stålbrud, træk
export const NRks = (As, fuk) => As * fuk;
// --- 7.2.1.4 Betonkeglebrud
export const N0Rkc = (k1, fck, hef) => k1 * Math.sqrt(fck) * Math.pow(hef, 1.5);       // (7.2)
export const ccrN = (hef) => 1.5 * hef;                                                  // indstøbte
export const scrN = (hef) => 3 * hef;
export const psisN = (c, ccr) => Math.min(1, 0.7 + 0.3 * c / ccr);                       // (7.4)
export const psireN = (hef) => Math.min(1, 0.5 + hef / 200);                             // (7.5) ved tæt armering
export const psiecN = (e, scr) => 1 / (1 + 2 * e / scr);                                 // (7.6)
// Ac,N for 1D-række (én retning): længde langs en akse, begrænset af kanter.
// positions: ankerkoordinater langs aksen; lo/hi: afstand fra akse-origo til kant (Infinity = ingen).
export function lenN(positions, scr, edgeLo, edgeHi) {
  const lo = Math.min(...positions), hi = Math.max(...positions);
  // hver ankers bidrag er interval [p - scr/2, p + scr/2]; vi tager foreningen og klipper med kanter
  const iv = positions.map(p => [p - scr / 2, p + scr / 2]).sort((a, b) => a[0] - b[0]);
  let tot = 0, cur = null;
  for (const [a0, b0] of iv) {
    const a = Math.max(a0, -edgeLo), b = Math.min(b0, edgeHi);
    if (cur && a0 <= cur[1] + 1e-9) cur[1] = Math.max(cur[1], b);
    else { if (cur) tot += cur[1] - cur[0]; cur = [a, b]; }
  }
  if (cur) tot += cur[1] - cur[0];
  return tot;
}
// --- 7.2.1.5 Udtrækning (hoved)
export const Ah = (dh, d) => Math.PI / 4 * (dh * dh - d * d);                            // (7.12)
export const NRkp = (k2, ah, fck) => k2 * ah * fck;                                      // (7.11)
// --- 7.2.1.7 Spaltning
export const psihsp = (h, hmin, hef, c1) =>
  Math.min(Math.pow(h / hmin, 2 / 3), Math.max(1, Math.pow((hef + 1.5 * c1) / hmin, 2 / 3)), 2); // (7.24)
// --- 7.2.2.3 Stålbrud, forskydning uden løftestang
export const k6 = (fuk) => (fuk <= 500 ? 0.6 : 0.5);
export const VRks = (k7, fuk, As) => k7 * k6(fuk) * As * fuk;                            // (7.35)
// --- 7.2.2.4 Pry-out
export const k8 = (hef) => (hef >= 60 ? 2 : 1);
// --- 7.2.2.5 Betonkantbrud
export function V0Rkc(k9, dnom, lf, fck, c1) {                                           // (7.41)-(7.43)
  const alpha = 0.1 * Math.sqrt(lf / c1), beta = 0.1 * Math.pow(dnom / c1, 0.2);
  return k9 * Math.pow(dnom, alpha) * Math.pow(lf, beta) * Math.sqrt(fck) * Math.pow(c1, 1.5);
}
export const A0cV = (c1) => 4.5 * c1 * c1;                                              // (7.44)
export const psihV = (c1, h) => Math.max(1, Math.sqrt(1.5 * c1 / h));                    // (7.46)
export const psisV = (c1, c2) => Math.min(1, 0.7 + 0.3 * c2 / (1.5 * c1));               // (7.45)
export const psiecV = (e, c1) => 1 / (1 + 2 * e / (3 * c1));                             // (7.47)
// --- 7.2.3 Interaktion
export const interStaal = (bN, bV) => bN * bN + bV * bV;                                 // (7.54)
export const interBeton55 = (bN, bV) => Math.pow(bN, 1.5) + Math.pow(bV, 1.5);           // (7.55)
export const interBeton56 = (bN, bV) => (bN + bV) / 1.2;                                 // (7.56)
