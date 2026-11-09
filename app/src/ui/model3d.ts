// Ren beskrivelse af 3D-scenen (ingen three.js, ingen DOM): koordinater i mm med x, y i plan og z op.
// Betonoverfladen er z = 0; indstøbte bolte går ned i negativ z. Scenen tegnes af scene3d.ts.
import { dornDiameter } from '../core/reinforcement';
import type { KombinationsResultat } from '../core/kombination';
import { brudlegemer } from './brudlegemer';

type Model = Record<string, any>;

export interface Udstraekning { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
export type Del =
  | { type: 'boks'; rolle: 'beton' | 'plade' | 'brud'; x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; afbrudt?: boolean }
  | { type: 'cyl'; rolle: 'skaft' | 'hoved' | 'moerik' | 'moertel'; x: number; y: number; z0: number; z1: number; r: number; sider: number; ankerId: number }
  | { type: 'stang'; rolle: 'armering'; fra: [number, number, number]; til: [number, number, number]; r: number; inaktiv?: boolean; variant?: 'forankring' | 'tilbehoer' }
  | { type: 'cirkel'; x: number; y: number; z: number; radius: number }
  | { type: 'kegle'; rolle: 'brud'; x: number; y: number; zTop: number; hoejde: number; radius: number }
  | { type: 'linjer'; segmenter: [[number, number, number], [number, number, number]][] }
  | { type: 'tekst'; pos: [number, number, number]; tekst: string }
  | { type: 'markering'; x: number; y: number; z0: number; z1: number; r: number }
  | { type: 'legeme'; rolle: 'brud'; punkter: [number, number, number][]; flader: [number, number, number][] }
  | { type: 'maal'; fra: [number, number, number]; til: [number, number, number]; tekst: string; felt?: string; vaerdi?: number }
  | { type: 'pil'; rolle: 'last'; fra: [number, number, number]; til: [number, number, number]; tekst: string; felt?: string; vaerdi?: number }
  | { type: 'bue'; rolle: 'last'; centrum: [number, number, number]; akse: 'x' | 'y' | 'z'; radius: number; fortegn: 1 | -1; tekst: string; vinkel: number; felt?: string; vaerdi?: number };

export interface Scene3DBeskrivelse { dele: Del[]; udstraekning: Udstraekning; stoerrelse: number; forklaring: { farve: string; tekst: string }[] }

/** Afstand fra forreste anker (mindste koordinat for −kanter, største for +kanter) til kanten – til kravet a ≤ 2·c1. */
const q0x = (ankre: { x: number; y: number }[], w: 'x' | 'y' | 'xmax' | 'ymax'): number => {
  const v = ankre.map((q) => (w[0] === 'x' ? q.x : q.y));
  return w.endsWith('max') ? Math.max(...v) : Math.min(...v);
};
const dk = (v: number, d = 1) => v.toFixed(d).replace('.', ',').replace('-', '−');

export function byg3d(m: Model, k: KombinationsResultat | null, last: Record<string, number> | null, visBrud = false, visMaal = true, visLast = true, valgtBrud: string | null = null, visTilbehoer = true): Scene3DBeskrivelse {
  const a = m.anker, be = m.beton, pl = m.plade, ankre: { id: number; x: number; y: number }[] = m.opstilling.anker ?? [];
  const hef = a.hef, d = a.d, e = pl.afstandTilBeton ?? 0, t = pl.t;
  const indstoebt = a.type !== 'indlimet';
  const xs = ankre.map((q) => q.x), ys = ankre.map((q) => q.y);
  const margin = Math.max(150, 0.9 * hef);
  const fri = (kant: string) => be.kanter?.[kant] != null;
  const x0 = fri('xNeg') ? -be.kanter.xNeg : Math.min(-pl.bx / 2, ...xs) - margin;
  const x1 = fri('xPos') ? be.kanter.xPos : Math.max(pl.bx / 2, ...xs) + margin;
  const y0 = fri('yNeg') ? -be.kanter.yNeg : Math.min(-pl.by / 2, ...ys) - margin;
  const y1 = fri('yPos') ? be.kanter.yPos : Math.max(pl.by / 2, ...ys) + margin;
  const dybdeMax = hef * 2 + 60, dybde = Math.min(be.h, dybdeMax);
  const dele: Del[] = [{ type: 'boks', rolle: 'beton', x0, x1, y0, y1, z0: -dybde, z1: 0, afbrudt: be.h > dybdeMax }];
  dele.push({ type: 'boks', rolle: 'plade', x0: -pl.bx / 2, x1: pl.bx / 2, y0: -pl.by / 2, y1: pl.by / 2, z0: e, z1: e + t });
  const topZ = e + t;
  for (const q of ankre) {
    dele.push({ type: 'cyl', rolle: 'skaft', x: q.x, y: q.y, z0: -hef, z1: topZ + 1.4 * d, r: d / 2, sider: 24, ankerId: q.id });
    if (indstoebt) {
      const firkant = a.hovedForm === 'firkant', dh = firkant ? (a.hovedSide ?? a.dh) : a.dh;
      dele.push({ type: 'cyl', rolle: 'hoved', x: q.x, y: q.y, z0: -hef, z1: -hef + a.th, r: dh / 2, sider: firkant ? 4 : 32, ankerId: q.id });
    }
    dele.push({ type: 'cyl', rolle: 'moertel', x: q.x, y: q.y, z0: topZ, z1: topZ + 0.8 * d, r: 0.95 * d, sider: 6, ankerId: q.id });
  }
  type Pkt3 = [number, number, number];
  const stang = (fra: Pkt3, til: Pkt3, r: number, ekstra: { inaktiv?: boolean; variant?: 'forankring' | 'tilbehoer' } = {}) => dele.push({ type: 'stang', rolle: 'armering', fra, til, r, ...ekstra });
  // ankerarmering for træk (EN 1992-4, 7.2.1.2; CEN/TS 1992-4-2, 6.2.2): åbne bøjler (hårnåle) i lodrette planer, parvis og symmetrisk om ankeret,
  // så tæt på ankeret som praktisk muligt (virksomme inden for 0,75·hef) og helst omsluttende overfladearmeringen.
  // Planet er forskudt M fra boltens akse, benene sidder ±x fra planets midte (radial afstand √(x²+M²)).
  // Hjørnerne er bukket om en dorn (EN 1992-1-1, Tabel 8.1N: 4⌀ for ⌀ ≤ 16 mm, ellers 7⌀).
  // l1 = benets længde fra bøjlens overkant (ctop) til brudkeglens overflade (35°); herfra forankres benet uden for brudlegemet med lbd
  // (EN 1992-1-1, 8.4.4; α2–α5 = 1). Overfladearmeringen er rigtige stænger (⌀s, ss); en stang i hvert lag går gennem hver bøjle.
  const at = be.armering?.ankerarmeringTraek;
  if (at?.aktiv && ankre.length) {
    const p = at.diameter || 12, r = p / 2, n = Math.max(1, Math.round(at.antalBoejler ?? 1)), x = at.afstand, M = d / 2 + r + 2;
    const fs = at.fladeDiameter ?? 10, ss = at.fladeAfstand ?? 150, cn = be.cnom ?? 30;
    const rad = Math.hypot(x, M), zKegle = -(hef - Math.tan((35 * Math.PI) / 180) * rad); // dybde hvor benet skærer brudkeglen
    const lbd = k?.forank?.T?.lbd ?? null;
    // 'stoed': benet føres lbd forbi keglen; 'ingen': benet ender i den angivne dybde (forankringsdybde, standard hef eller keglen + lbd)
    const bundZ = at.foering === 'ingen' ? -(at.forankringsdybde ?? (lbd != null ? -zKegle + lbd : hef)) : (lbd != null ? zKegle - lbd : -hef);
    const alleInaktive = !!k && !k.armT.virksom, ikkeVirk = k?.armT.ikkeVirksomme ?? 0;
    const dorn = dornDiameter(p);
    // stykke af en linje (p0 + t·dv) inden for elementet minus dæklag
    const klip = (p0: [number, number], dv: [number, number]): [number, number] | null => {
      let a0 = -1e9, a1 = 1e9;
      for (const [po, dd, lo, hi] of [[p0[0], dv[0], x0 + cn, x1 - cn], [p0[1], dv[1], y0 + cn, y1 - cn]] as const) {
        if (Math.abs(dd) < 1e-9) { if (po < lo || po > hi) return null; continue; }
        const ta = (lo - po) / dd, tb = (hi - po) / dd; a0 = Math.max(a0, Math.min(ta, tb)); a1 = Math.min(a1, Math.max(ta, tb));
      }
      return a1 > a0 ? [a0, a1] : null;
    };
    const set = new Set<string>();
    const flade = (p0: [number, number], dv: [number, number], z: number) => {
      const key = `${Math.round(p0[0] * 10)}:${Math.round(p0[1] * 10)}:${Math.round(dv[0])}:${Math.round(dv[1])}:${Math.round(z * 10)}`;
      if (set.has(key)) return; set.add(key);
      const kl = klip(p0, dv); if (!kl) return;
      stang([p0[0] + dv[0] * kl[0], p0[1] + dv[1] * kl[0], z], [p0[0] + dv[0] * kl[1], p0[1] + dv[1] * kl[1], z], fs / 2, { variant: 'tilbehoer' });
    };
    const th0 = at.drejet ? Math.PI / 2 : 0;
    const aksial = n === 1;
    for (const q of ankre) {
      for (let j = 0; j < n; j++) {
        const th = (j * Math.PI) / n + th0, u: [number, number] = [Math.cos(th), Math.sin(th)], w: [number, number] = [-Math.sin(th), Math.cos(th)];
        const zt = -(at.daeklagTop ?? 40) - j * (p + 1), zb = Math.min(bundZ, zt - 10), inaktiv = alleInaktive || j >= n - ikkeVirk;
        const pt = (sv: number, z: number): Pkt3 => [q.x + u[0] * sv + w[0] * M, q.y + u[1] * sv + w[1] * M, z];
        if (at.krog) {
          const Rb = Math.max(0.1, Math.min(dorn / 2 + r, x, zt - zb)), N = 8;
          const bue = (cs: number, cz: number, a0: number, a1: number): [number, number][] => Array.from({ length: N + 1 }, (_, i) => [cs + Rb * Math.cos(a0 + ((a1 - a0) * i) / N), cz + Rb * Math.sin(a0 + ((a1 - a0) * i) / N)]);
          // åben bøjle (hårnål): bøjning foroven om overfladearmeringen, benene fortsætter lige ned og forankres med lbd uden for keglen
          const sti: [number, number][] = [
            [-x, zb], [-x, zt - Rb], ...bue(-x + Rb, zt - Rb, Math.PI, Math.PI / 2), [x - Rb, zt], ...bue(x - Rb, zt - Rb, Math.PI / 2, 0), [x, zb],
          ];
          for (let i = 0; i + 1 < sti.length; i++) { const a2 = sti[i]!, b2 = sti[i + 1]!; if (Math.hypot(a2[0] - b2[0], a2[1] - b2[1]) > 1e-6) stang(pt(a2[0], a2[1]), pt(b2[0], b2[1]), r, { inaktiv }); }
        } else {
          stang(pt(1 * x, zt), pt(1 * x, zb), r, { inaktiv });
          stang(pt(-x, zt), pt(-x, zb), r, { inaktiv });
        }
        if (at.krog) {
          // enclosed bar (lag 1, vinkelret på bøjlens plan): under bøjlens overkant
          const uq = q.x * u[0] + q.y * u[1], z1 = zt - r - fs / 2;
          flade([u[0] * uq, u[1] * uq], w, z1);
          if (aksial && j === 0 && q === ankre[0]) {
            const z2 = z1 - fs; // lag 2 (parallelt med bøjlens plan) lige under lag 1, også inde i bøjlen
            for (let i = -200; i <= 200; i++) {
              const pu = uq + i * ss;
              flade([u[0] * pu, u[1] * pu], w, z1);
            }
            { const wq = q.x * w[0] + q.y * w[1]; for (let i = -200; i <= 200; i++) flade([w[0] * (wq + i * ss), w[1] * (wq + i * ss)], u, z2); }
          }
        }
      }
    }
    if (visMaal) {
      const q = ankre[0]!, zt = -(at.daeklagTop ?? 40);
      const u0: [number, number] = [Math.cos(th0), Math.sin(th0)], w0: [number, number] = [-Math.sin(th0), Math.cos(th0)];
      const b0: Pkt3 = [q.x + w0[0] * M, q.y + w0[1] * M, zt];
      const ben: [number, number] = [b0[0] + u0[0] * x, b0[1] + u0[1] * x];
      const benZ = (z: number): Pkt3 => [ben[0], ben[1], z];
      dele.push({ type: 'maal', fra: b0, til: [ben[0], ben[1], zt], tekst: `x = ${dk(x, 0)} mm` });
      dele.push({ type: 'maal', fra: benZ(0), til: benZ(zt), tekst: `ctop = ${dk(-zt, 0)} mm` });
      const zbund = Math.min(bundZ, zKegle - 1);
      if (zKegle < zt) {
        dele.push({ type: 'maal', fra: benZ(zt), til: benZ(zKegle), tekst: `l1 = ${dk(zt - zKegle, 0)} mm${k ? ` (min. ${dk(k.armT.l1min, 0)})` : ''}` });
        dele.push({ type: 'maal', fra: benZ(zKegle), til: benZ(zbund), tekst: `${lbd != null ? `lbd = ${dk(lbd, 0)} mm (σsd = ${dk(k!.forank.T!.sigmaSd, 0)} MPa)` : 'forankring'}${at.foering === 'ingen' ? ` (ender i ${dk(-bundZ, 0)})` : ''}` });
      }
      dele.push({ type: 'tekst', pos: [ben[0] + u0[0] * 25, ben[1] + u0[1] * 25, zbund + 10], tekst: `bukkediameter ${dk(dorn, 0)} mm (${p <= 16 ? '4' : '7'}⌀) · radius til bøjlens akse ${dk(dorn / 2 + r, 0)} mm` });
      dele.push({ type: 'tekst', pos: [ben[0] - u0[0] * 25, ben[1] - u0[1] * 25, zt + 12], tekst: `afstand til anker ${dk(rad, 0)} mm ≤ 0,75·hef = ${dk(0.75 * hef, 0)} mm` });
      if (-bundZ > be.h - cn) dele.push({ type: 'tekst', pos: [ben[0], ben[1], -Math.min(be.h - cn, dybde)], tekst: `OBS: benet når ${dk(-bundZ, 0)} mm ned, men elementet er kun ${dk(be.h, 0)} mm tykt (dæklag ${dk(cn, 0)})` });
    }
  }
  // ankerarmering for forskydning (7.2.2.6, Fig. 7.10) vender mod armeringskanten; grå = regnes ikke virksom
  const av = m.beton.armering?.ankerarmeringForskydning;
  if (av?.aktiv && k?.armKant) {
    const kant = k.armKant.kant, fr = k.kantbrud.forreste[kant];
    if (fr) {
      const dir = { xNeg: [-1, 0], xPos: [1, 0], yNeg: [0, -1], yPos: [0, 1] }[kant as 'xNeg'] as [number, number], per: [number, number] = [-dir[1], dir[0]];
      const p = av.diameter || 10, r = p / 2, zs = -(av.daekToAkse ?? 40), cnom = be.cnom ?? 30, lbdV = k.forank?.V?.lbd ?? null, hale = lbdV ?? 20 * p, dornV = dornDiameter(p);
      const række = fr.ankre.map((id: number) => ankre.find((a2) => a2.id === id)).filter((q: unknown): q is { id: number; x: number; y: number } => !!q);
      const langs = (q: { x: number; y: number }) => q.x * dir[0] + q.y * dir[1], tvaers = (q: { x: number; y: number }) => q.x * per[0] + q.y * per[1];
      const G = (a: number, v: number, z: number): Pkt3 => [dir[0] * a + per[0] * v, dir[1] * a + per[1] * v, z];
      const kantAfst = (q: { x: number; y: number }) => ({ xNeg: q.x + (be.kanter?.xNeg ?? 0), xPos: (be.kanter?.xPos ?? 0) - q.x, yNeg: q.y + (be.kanter?.yNeg ?? 0), yPos: (be.kanter?.yPos ?? 0) - q.y })[kant as 'xNeg'];
      const alle = !k.armV.virksom;
      if (av.type === 'overflade' || !av.type) {
        const lateral: { v: number; l: number; ok: boolean }[] = k.armV.staenger?.length
          ? k.armV.staenger.map((s: { v: number; l1: number; virksom: boolean }) => ({ v: s.v, l: Math.max(0, s.l1), ok: s.virksom }))
          : [d / 2 + r + 2, -(d / 2 + r + 2)].map((v) => ({ v, l: Math.max(0, k.armV.l1 ?? fr.c1 - cnom), ok: k.armV.virksom }));
        for (const q of række) {
          const a0 = langs(q), t0 = tvaers(q), fE = a0 + kantAfst(q) - cnom;
          for (const b of lateral) {
            const inaktiv = !b.ok;
            // krog ved kanten: 90°-bøjning (dorn 4⌀/7⌀) og 10⌀ lige ende (EN 1992-1-1, Fig. 8.1b); stangen regnes fra bøjningens start
            const Rh = av.krog ? dornV / 2 + r : 0, v0 = t0 + b.v;
            if (av.krog) {
              const N = 8, bue = Array.from({ length: N + 1 }, (_, i) => { const a = Math.PI / 2 - ((Math.PI / 2) * i) / N; return [fE - Rh + Rh * Math.cos(a), zs - Rh + Rh * Math.sin(a)] as [number, number]; });
              for (let i = 0; i < N; i++) stang(G(bue[i]![0], v0, bue[i]![1]), G(bue[i + 1]![0], v0, bue[i + 1]![1]), r, { inaktiv });
              stang(G(fE, v0, zs - Rh), G(fE, v0, zs - Rh - 10 * p), r, { inaktiv });
            }
            stang(G(fE - Rh, v0, zs), G(fE - b.l, v0, zs), r, { inaktiv });
            stang(G(fE - b.l, v0, zs), G(fE - b.l - hale, v0, zs), r, { inaktiv, variant: 'forankring' });
          }
          if (av.krog) {
            // tværstang som krogen omslutter: gennemgående langs kanten (hele elementets bredde minus dæklag)
            const hj: [number, number][] = [[x0 + cnom, y0 + cnom], [x1 - cnom, y0 + cnom], [x0 + cnom, y1 - cnom], [x1 - cnom, y1 - cnom]];
            const pr = hj.map((c) => c[0] * per[0] + c[1] * per[1]), lo = Math.min(...pr) - t0, hi = Math.max(...pr) - t0;
            stang(G(fE - dornV / 2 - r, t0 + lo, zs - dornV / 2 - r), G(fE - dornV / 2 - r, t0 + hi, zs - dornV / 2 - r), r, { variant: 'tilbehoer' });
          }
        }
        if (visMaal && række[0]) {
          const q = række[0], z0 = 0.5, c1 = kantAfst(q);
          dele.push({ type: 'maal', fra: G(langs(q), tvaers(q) - 0.75 * c1, z0), til: G(langs(q), tvaers(q) + 0.75 * c1, z0), tekst: `±0,75·c1 = ${dk(0.75 * c1, 0)} mm` });
          const b0 = lateral[0]!, fE0 = langs(q) + c1 - cnom, v1 = tvaers(q) + b0.v + 25;
          dele.push({ type: 'maal', fra: G(fE0, v1, zs), til: G(fE0 - b0.l, v1, zs), tekst: `l1 = ${dk(b0.l, 0)} mm (min. ${dk((av.krog ? 4 : 10) * p, 0)})` });
          dele.push({ type: 'maal', fra: G(fE0 - b0.l, v1, zs), til: G(fE0 - b0.l - hale, v1, zs), tekst: lbdV != null ? `lbd = ${dk(lbdV, 0)} mm (σsd = ${dk(k.forank.V!.sigmaSd, 0)} MPa)` : 'forankring' });
          if (av.krog) dele.push({ type: 'tekst', pos: G(fE0, v1, zs + 12), tekst: `krog: bukkediameter ${dk(dornV, 0)} mm, lige ende 10⌀ = ${dk(10 * p, 0)} mm` });
        }
      } else if (række.length) {
        // bøjle om hele forreste række (b) eller løkke om hvert anker (c): lukket ende mod skafterne på kantsiden,
        // benene føres uden om befæstelsen ind i elementet; flere lægges under hinanden
        const grupper = av.type === 'boejle' ? [række] : række.map((q: { id: number; x: number; y: number }) => [q]);
        const ben = k.armV.ben || 2;
        const bj = k.armV.boejler;
        const antal = bj ? bj.length : Math.max(1, Math.round(av.type === 'boejle' ? (ben * række.length) / 2 : ben / 2));
        const o = d / 2 + r; // bøjler/løkker omslutter og berører skaftet (CEN/TS 1992-4-2, 6.3.5.4)
        if (visMaal) {
          const g0 = grupper[0]!, fore0 = Math.max(...g0.map(langs)) + d / 2 + r, bag0 = Math.min(...g0.map(langs)) - d / 2 - r, lo0 = Math.min(...g0.map(tvaers)) - (d / 2 + r);
          dele.push({ type: 'maal', fra: G(bag0, lo0 - 20, zs), til: G(bag0 - hale, lo0 - 20, zs), tekst: lbdV != null ? `lbd = ${dk(lbdV, 0)} mm (σsd = ${dk(k.forank.V!.sigmaSd, 0)} MPa)` : 'forankring' });
          dele.push({ type: 'tekst', pos: G(fore0, lo0, zs + 12), tekst: `bukkediameter ${dk(dornV, 0)} mm (${p <= 16 ? '4' : '7'}⌀), omslutter og berører skaftet` });
        }
        for (const gr of grupper) {
          const fore = Math.max(...gr.map(langs)) + d / 2 + r, bag = Math.min(...gr.map(langs)) - d / 2 - r;
          const lo = Math.min(...gr.map(tvaers)) - o, hi = Math.max(...gr.map(tvaers)) + o;
          for (let j = 0; j < antal; j++) {
            // med bøjleafstand ligger bøjlerne efter hinanden ind i elementet (grå uden for 0,5·c1); ellers ⌀+1 under hinanden
            const z = bj ? zs : zs - j * (p + 1), sk = bj ? -bj[j]!.pos : 0, ia = alle || (bj ? !bj[j]!.virksom : false);
            // ben fra bag til forkant, to bukkede hjørner (dorn 4⌀/7⌀) og tværstykke; benene fortsætter lbd bagud (forankring uden for brudlegemet)
            const Rb = Math.max(0.1, Math.min(dornV / 2 + r, (hi - lo) / 2, fore - bag)), N = 8;
            const bue = (ca: number, cv: number, a0: number, a1: number): [number, number][] => Array.from({ length: N + 1 }, (_, i) => [ca + Rb * Math.cos(a0 + ((a1 - a0) * i) / N), cv + Rb * Math.sin(a0 + ((a1 - a0) * i) / N)]);
            const sti: [number, number][] = [[bag, lo], [fore - Rb, lo], ...bue(fore - Rb, lo + Rb, -Math.PI / 2, 0), ...bue(fore - Rb, hi - Rb, 0, Math.PI / 2), [bag, hi]];
            for (let i = 0; i + 1 < sti.length; i++) { const a2 = sti[i]!, b2 = sti[i + 1]!; if (Math.hypot(a2[0] - b2[0], a2[1] - b2[1]) > 1e-6) stang(G(a2[0] + sk, a2[1], z), G(b2[0] + sk, b2[1], z), r, { inaktiv: ia }); }
            for (const vv of [lo, hi]) stang(G(bag + sk, vv, z), G(bag + sk - hale, vv, z), r, { inaktiv: ia, variant: 'forankring' });
          }
        }
      }
    }
  }
  // kantarmering (7.2.2.5, ψre,V): kantstænger (⌀) langs den frie kant, omsluttet af lukkede bøjler (samme ⌀) med afstanden a.
  // Bøjlen ligger i planet vinkelret på kanten: dæklag cnom til bøjlens yderside, dornbøjede hjørner (EN 1992-1-1, Tabel 8.1N),
  // bredde bs ind i elementet og højde over hele elementet (afkortet i tegningen); fire kantstænger i bøjlens hjørner.
  if (be.armering?.kantarmering === 'boejler' && be.armering.kantarmeringDiameter) {
    const dkb = be.armering.kantarmeringDiameter, rk = dkb / 2, c = be.cnom ?? 30, a = be.armering.kantarmeringAfstand;
    const bs = be.armering.kantarmeringBredde ?? 150, dornK = dornDiameter(dkb), Rb = Math.min(dornK / 2 + rk, bs / 2 - 1);
    const kanter2: { fri: boolean; langs: boolean; e0: number; inw: 1 | -1; lo: number; hi: number; navn: string }[] = [
      { fri: fri('xNeg'), langs: true, e0: x0, inw: 1, lo: y0 + c, hi: y1 - c, navn: 'xNeg' }, { fri: fri('xPos'), langs: true, e0: x1, inw: -1, lo: y0 + c, hi: y1 - c, navn: 'xPos' },
      { fri: fri('yNeg'), langs: false, e0: y0, inw: 1, lo: x0 + c, hi: x1 - c, navn: 'yNeg' }, { fri: fri('yPos'), langs: false, e0: y1, inw: -1, lo: x0 + c, hi: x1 - c, navn: 'yPos' },
    ];
    let markeret = false;
    for (const e2 of kanter2) {
      if (!e2.fri) continue;
      // punkt i bøjlens plan: s = afstand fra kanten (indad), z = dybde, t = placering langs kanten
      const P = (t: number, sv: number, z: number): Pkt3 => (e2.langs ? [e2.e0 + e2.inw * sv, t, z] : [t, e2.e0 + e2.inw * sv, z]);
      const s0 = c + rk, s1 = c + bs - rk, zt0 = -(c + rk), zb0 = -(Math.min(be.h, dybde) - c - rk); // bøjlens akse (yderste fibre i cnom)
      const sk = [c + 2 * rk + rk, c + bs - 3 * rk], zk = [-(c + 3 * rk), -(Math.min(be.h, dybde) - c - 3 * rk)]; // kantstængernes akser inde i hjørnerne
      for (const sv of sk) for (const zv of zk) stang(P(e2.lo, sv, zv), P(e2.hi, sv, zv), rk);
      if (a != null && a > 0) {
        const n = Math.min(200, Math.floor((e2.hi - e2.lo) / a)), N = 6;
        const hj = (cs: number, cz: number, a0: number, a1: number): [number, number][] => Array.from({ length: N + 1 }, (_, i) => [cs + Rb * Math.cos(a0 + ((a1 - a0) * i) / N), cz + Rb * Math.sin(a0 + ((a1 - a0) * i) / N)]);
        const sti: [number, number][] = [
          ...hj(s1 - Rb, zt0 - Rb, Math.PI / 2, 0), ...hj(s1 - Rb, zb0 + Rb, 0, -Math.PI / 2), ...hj(s0 + Rb, zb0 + Rb, -Math.PI / 2, -Math.PI), ...hj(s0 + Rb, zt0 - Rb, Math.PI, Math.PI / 2),
        ];
        for (let i = 0; i <= n; i++) {
          const t = e2.lo + i * a;
          for (let j2 = 0; j2 < sti.length; j2++) { const p1 = sti[j2]!, p2 = sti[(j2 + 1) % sti.length]!; if (Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) > 1e-6) stang(P(t, p1[0], p1[1]), P(t, p2[0], p2[1]), rk); }
        }
        if (visMaal && !markeret && n >= 1) {
          markeret = true;
          dele.push({ type: 'maal', fra: P(e2.lo, s0, zt0), til: P(e2.lo + a, s0, zt0), tekst: `a = ${dk(a, 0)} mm` });
          dele.push({ type: 'maal', fra: P(e2.lo, 0, 0.5), til: P(e2.lo, c, 0.5), tekst: `cnom = ${dk(c, 0)} mm` });
          dele.push({ type: 'maal', fra: P(e2.lo, c, zt0 + rk + 1), til: P(e2.lo, c + bs, zt0 + rk + 1), tekst: `bs = ${dk(bs, 0)} mm` });
          dele.push({ type: 'tekst', pos: P(e2.lo, s1, zt0 + 15), tekst: `kantbøjle ⌀${dk(dkb, 0)}: bukkediameter ${dk(dornK, 0)} mm (${dkb <= 16 ? '4' : '7'}⌀)` });
          const c1 = Math.abs(((e2.navn === 'xNeg' ? q0x(ankre, 'x') + (be.kanter?.xNeg ?? 0) : e2.navn === 'xPos' ? (be.kanter?.xPos ?? 0) - q0x(ankre, 'xmax') : e2.navn === 'yNeg' ? q0x(ankre, 'y') + (be.kanter?.yNeg ?? 0) : (be.kanter?.yPos ?? 0) - q0x(ankre, 'ymax'))));
          dele.push({ type: 'tekst', pos: P(e2.lo + a, s1, zt0 - 40), tekst: `krav ψre,V = 1,4: a ≤ 100 mm og a ≤ 2·c1 = ${dk(2 * c1, 0)} mm${a <= 100 && a <= 2 * c1 ? ' (opfyldt)' : ' (IKKE opfyldt)'}` });
        }
      }
    }
  }
  // mål (kan slås fra): hef, h, fodplade, stand-off, boltafstande og kantafstande
  if (visMaal && ankre.length) {
    const mm = (v: number) => `${dk(v, 0)} mm`;
    const q0 = ankre[0]!, zO = 0.5;
    dele.push({ type: 'maal', fra: [q0.x + 1.6 * d, q0.y, -hef], til: [q0.x + 1.6 * d, q0.y, 0], tekst: `hef = ${mm(hef)}`, felt: 'hef', vaerdi: hef });
    dele.push({ type: 'maal', fra: [x1, y0, -dybde], til: [x1, y0, 0], tekst: `h = ${mm(be.h)}`, felt: 'h', vaerdi: be.h });
    const off = Math.max(80, 0.16 * Math.max(pl.bx, pl.by));
    dele.push({ type: 'maal', fra: [-pl.bx / 2, -pl.by / 2 - off, topZ + 0.4 * d], til: [pl.bx / 2, -pl.by / 2 - off, topZ + 0.4 * d], tekst: `bx = ${mm(pl.bx)}`, felt: 'bx', vaerdi: pl.bx });
    dele.push({ type: 'maal', fra: [pl.bx / 2 + off, -pl.by / 2, topZ + 0.4 * d], til: [pl.bx / 2 + off, pl.by / 2, topZ + 0.4 * d], tekst: `by = ${mm(pl.by)}`, felt: 'by', vaerdi: pl.by });
    dele.push({ type: 'maal', fra: [-pl.bx / 2 - off, -pl.by / 2, e], til: [-pl.bx / 2 - off, -pl.by / 2, e + t], tekst: `t = ${mm(t)}`, felt: 't', vaerdi: t });
    if (e > 0) dele.push({ type: 'maal', fra: [-pl.bx / 2 - off, pl.by / 2, 0], til: [-pl.bx / 2 - off, pl.by / 2, e], tekst: `e = ${mm(e)}`, felt: 'e', vaerdi: e });
    const unik = (v: number[]) => [...new Set(v.map((x) => Math.round(x * 10) / 10))].sort((p, r) => p - r);
    const ux = unik(xs), uy = unik(ys), yMaal = Math.max(...ys) + 0.6 * off, xMaal = Math.max(...xs) + 0.6 * off;
    for (let j = 1; j < ux.length; j++) dele.push({ type: 'maal', fra: [ux[j - 1]!, yMaal, zO], til: [ux[j]!, yMaal, zO], tekst: `sx = ${mm(ux[j]! - ux[j - 1]!)}`, felt: 'sx', vaerdi: ux[j]! - ux[j - 1]! });
    for (let j = 1; j < uy.length; j++) dele.push({ type: 'maal', fra: [xMaal, uy[j - 1]!, zO], til: [xMaal, uy[j]!, zO], tekst: `sy = ${mm(uy[j]! - uy[j - 1]!)}`, felt: 'sy', vaerdi: uy[j]! - uy[j - 1]! });
    const kanter: [string, number, (q: { x: number; y: number }) => number, (q: { x: number; y: number }, c: number) => [[number, number, number], [number, number, number]]][] = [
      ['xNeg', 0, (q) => q.x + (be.kanter?.xNeg ?? 0), (q, c) => [[q.x, q.y, zO], [q.x - c, q.y, zO]]],
      ['xPos', 0, (q) => (be.kanter?.xPos ?? 0) - q.x, (q, c) => [[q.x, q.y, zO], [q.x + c, q.y, zO]]],
      ['yNeg', 0, (q) => q.y + (be.kanter?.yNeg ?? 0), (q, c) => [[q.x, q.y, zO], [q.x, q.y - c, zO]]],
      ['yPos', 0, (q) => (be.kanter?.yPos ?? 0) - q.y, (q, c) => [[q.x, q.y, zO], [q.x, q.y + c, zO]]],
    ];
    for (const [kant, , afst, linje] of kanter) {
      if (!fri(kant)) continue;
      const naer = ankre.reduce((b, q) => (afst(q) < afst(b) ? q : b), ankre[0]!);
      const c = afst(naer), [fra, til] = linje(naer, c);
      dele.push({ type: 'maal', fra, til, tekst: `c = ${mm(c)}`, felt: `c:${kant}`, vaerdi: c });
    }
  }
  const udst: Udstraekning = { x0, x1, y0, y1, z0: -dybde, z1: topZ + 2 * d };
  const stoerrelse = Math.max(x1 - x0, y1 - y0, dybde);
  // laster
  const lastZ = topZ + 1.6 * d, L = stoerrelse * 0.2, p0: [number, number, number] = [0, 0, lastZ];
  const l = last ?? {};
  const aktiv = (n: string) => Math.abs(l[n] ?? 0) > 1e-9;
  if (aktiv('N')) {
    const op = (l.N ?? 0) >= 0;
    dele.push({ type: 'pil', rolle: 'last', fra: op ? p0 : [0, 0, lastZ + L], til: op ? [0, 0, lastZ + L] : p0, tekst: `N = ${dk((l.N ?? 0) / 1e3)} kN`, felt: 'last:N', vaerdi: (l.N ?? 0) / 1e3 });
  }
  const vZ = pl.lasthoejde ?? lastZ, v0: [number, number, number] = [0, 0, vZ];
  if (aktiv('Vx')) dele.push({ type: 'pil', rolle: 'last', fra: v0, til: [Math.sign(l.Vx!) * L, 0, vZ], tekst: `Vx = ${dk(l.Vx! / 1e3)} kN`, felt: 'last:Vx', vaerdi: l.Vx! / 1e3 });
  if (aktiv('Vy')) dele.push({ type: 'pil', rolle: 'last', fra: v0, til: [0, Math.sign(l.Vy!) * L, vZ], tekst: `Vy = ${dk(l.Vy! / 1e3)} kN`, felt: 'last:Vy', vaerdi: l.Vy! / 1e3 });
  const c: [number, number, number] = [0, 0, lastZ + L * 0.35];
  if (aktiv('Mx')) dele.push({ type: 'bue', rolle: 'last', centrum: c, akse: 'x', radius: L * 0.32, fortegn: l.Mx! > 0 ? 1 : -1, tekst: `Mx = ${dk(l.Mx! / 1e6)} kNm`, felt: 'last:Mx', vaerdi: l.Mx! / 1e6, vinkel: 270 });
  if (aktiv('My')) dele.push({ type: 'bue', rolle: 'last', centrum: c, akse: 'y', radius: L * 0.32, fortegn: l.My! > 0 ? 1 : -1, tekst: `My = ${dk(l.My! / 1e6)} kNm`, felt: 'last:My', vaerdi: l.My! / 1e6, vinkel: 270 });
  if (aktiv('T')) dele.push({ type: 'bue', rolle: 'last', centrum: [0, 0, topZ + 2], akse: 'z', radius: Math.max(pl.bx, pl.by) * 0.42, fortegn: l.T! > 0 ? 1 : -1, tekst: `T = ${dk(l.T! / 1e6)} kNm`, felt: 'last:T', vaerdi: l.T! / 1e6, vinkel: 300 });
  if (!visTilbehoer) dele.splice(0, dele.length, ...dele.filter((x) => !(x.type === 'stang' && x.variant === 'tilbehoer')));
  if (!visLast) dele.splice(0, dele.length, ...dele.filter((x) => x.type !== 'pil' && x.type !== 'bue'));
  // idealiserede brudlegemer for den styrende brudform (EN 1992-4, 35°-model); kun vejledende
  const styr = k?.styrendeBrudform ?? null;
  const kombi = styr === 'NV_c';
  if (valgtBrud && k) {
    dele.push(...brudlegemer(valgtBrud, { m, k, ankre, x0, x1, y0, y1, dybde, hef, d }));
  } else if (visBrud && k && (styr === 'N_c' || kombi)) {
    for (const q of k.traek.traekAnkre) dele.push({ type: 'kegle', rolle: 'brud', x: q.x, y: q.y, zTop: 0, hoejde: hef, radius: 1.5 * hef });
  }
  if (!valgtBrud && visBrud && k && (styr === 'V_c' || kombi) && k.kantbrud.styrende) {
    const { kant, c1, ankre: ids } = k.kantbrud.styrende;
    const dir = { xNeg: [-1, 0], xPos: [1, 0], yNeg: [0, -1], yPos: [0, 1] }[kant as 'xNeg'] as [number, number];
    const per: [number, number] = [-dir[1], dir[0]];
    for (const id of ids) {
      const q = ankre.find((z) => z.id === id); if (!q) continue;
      const P = (f: number, g: number, z: number): [number, number, number] => [q.x + dir[0] * f + per[0] * g, q.y + dir[1] * f + per[1] * g, z];
      dele.push({ type: 'legeme', rolle: 'brud', punkter: [P(0, 0, 0), P(c1, 1.5 * c1, 0), P(c1, -1.5 * c1, 0), P(c1, 0, -c1)], flader: [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]] });
    }
  }
  const forklaring = [
    { farve: 'beton', tekst: be.revnet ? 'Beton (revnet)' : 'Beton (urevnet)' },
    { farve: 'staal', tekst: indstoebt ? 'Bolt med hoved' : 'Indlimet gevindstang' },
    ...(dele.some((x) => x.type === 'kegle' || x.type === 'legeme' || x.type === 'markering' || x.type === 'linjer' || (x.type === 'boks' && x.rolle === 'brud')) ? [{ farve: 'brud', tekst: 'Brudlegeme (idealiseret)' }] : []),
    ...(dele.some((x) => x.type === 'stang' && !x.inaktiv && !x.variant) ? [{ farve: 'armering', tekst: 'Armering' }] : []),
    ...(dele.some((x) => x.type === 'stang' && x.inaktiv) ? [{ farve: 'inaktiv', tekst: 'Armering der ikke regnes virksom' }] : []),
    ...(dele.some((x) => x.type === 'stang' && x.variant === 'forankring') ? [{ farve: 'forankring', tekst: 'Forankring uden for brudlegemet (lbd efter EN 1992-1-1, 8.4.4)' }] : []),
    ...(dele.some((x) => x.type === 'stang' && x.variant === 'tilbehoer') ? [{ farve: 'tilbehoer', tekst: 'Overflade- og kantarmering (stænger)' }] : []),
    ...(dele.some((x) => x.type === 'cirkel') ? [{ farve: 'zone', tekst: 'Zone 0,75·hef om ankeret' }] : []),
    ...(dele.some((x) => x.type === 'pil' || x.type === 'bue') ? [{ farve: 'last', tekst: 'Laster' }] : []),
  ];
  return { dele, udstraekning: udst, stoerrelse, forklaring };
}
