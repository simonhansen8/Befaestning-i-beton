// Ren beskrivelse af 3D-scenen (ingen three.js, ingen DOM): koordinater i mm med x, y i plan og z op.
// Betonoverfladen er z = 0; indstøbte bolte går ned i negativ z. Scenen tegnes af scene3d.ts.
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
  // ankerarmering for træk (7.2.1.2, Fig. 7.2): lukkede bøjler i lodrette planer, parvis og symmetrisk om ankeret, omsluttende overfladearmeringen.
  // Planet er forskudt M fra boltens akse, benene sidder ±x fra planets midte (radial afstand √(x²+M²) ≤ 0,75·hef).
  // Hjørnerne er bukket om en dorn (EN 1992-1-1, 8.3: 4⌀ for ⌀ ≤ 16 mm, ellers 7⌀); benene føres ned forbi brudkeglen.
  // Overfladearmeringen er rigtige stænger (⌀s, ss) over hele elementet; en stang i hvert lag går gennem hver bøjle.
  const at = be.armering?.ankerarmeringTraek;
  if (at?.aktiv && ankre.length) {
    const p = at.diameter || 12, r = p / 2, n = Math.max(1, Math.round(at.antalBoejler ?? 1)), x = at.afstand, M = d / 2 + r + 2;
    const fs = at.fladeDiameter ?? 10, ss = at.fladeAfstand ?? 150, cn = be.cnom ?? 30;
    const bundZ = -(at.foering === 'ingen' ? (at.forankringsdybde ?? hef) : hef);
    const alleInaktive = !!k && !k.armT.virksom, ikkeVirk = k?.armT.ikkeVirksomme ?? 0;
    const dorn = p <= 16 ? 4 * p : 7 * p;
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
          const Rb = Math.max(0.1, Math.min(dorn / 2 + r, x, (zt - zb) / 2)), N = 8;
          const bue = (cs: number, cz: number, a0: number, a1: number): [number, number][] => Array.from({ length: N + 1 }, (_, i) => [cs + Rb * Math.cos(a0 + ((a1 - a0) * i) / N), cz + Rb * Math.sin(a0 + ((a1 - a0) * i) / N)]);
          const sti: [number, number][] = [
            [-x + Rb, zt], [x - Rb, zt], ...bue(x - Rb, zt - Rb, Math.PI / 2, 0), ...bue(x - Rb, zb + Rb, 0, -Math.PI / 2),
            ...bue(-x + Rb, zb + Rb, -Math.PI / 2, -Math.PI), ...bue(-x + Rb, zt - Rb, Math.PI, Math.PI / 2),
          ];
          for (let i = 0; i < sti.length; i++) { const a2 = sti[i]!, b2 = sti[(i + 1) % sti.length]!; if (Math.hypot(a2[0] - b2[0], a2[1] - b2[1]) > 1e-6) stang(pt(a2[0], a2[1]), pt(b2[0], b2[1]), r, { inaktiv }); }
        } else {
          stang(pt(1 * x, zt), pt(1 * x, zb), r, { inaktiv });
          stang(pt(-x, zt), pt(-x, zb), r, { inaktiv });
        }
        if (at.krog) {
          // enclosed bar (lag 1, vinkelret på bøjlens plan): under bøjlens overkant
          const uq = q.x * u[0] + q.y * u[1], z1 = zt - r - fs / 2;
          flade([u[0] * uq, u[1] * uq], w, z1);
          if (aksial && j === 0 && q === ankre[0]) {
            const z2 = zt + r + fs / 2; // lag 2 (parallelt med bøjlens plan) over bøjlens overkant – kun hvis det ligger i betonen
            for (let i = -200; i <= 200; i++) {
              const pu = uq + i * ss;
              flade([u[0] * pu, u[1] * pu], w, z1);
            }
            if (z2 + fs / 2 <= 0) { const wq = q.x * w[0] + q.y * w[1]; for (let i = -200; i <= 200; i++) flade([w[0] * (wq + i * ss), w[1] * (wq + i * ss)], u, z2); }
          }
        }
      }
    }
    if (visMaal) {
      const q = ankre[0]!, zt = -(at.daeklagTop ?? 40), th0 = at.drejet ? Math.PI / 2 : 0;
      const u0: [number, number] = [Math.cos(th0), Math.sin(th0)], w0: [number, number] = [-Math.sin(th0), Math.cos(th0)];
      const b0: Pkt3 = [q.x + w0[0] * M, q.y + w0[1] * M, zt];
      dele.push({ type: 'maal', fra: b0, til: [b0[0] + u0[0] * x, b0[1] + u0[1] * x, zt], tekst: `x = ${dk(x, 0)} mm` });
      dele.push({ type: 'maal', fra: [b0[0] + u0[0] * x, b0[1] + u0[1] * x, 0], til: [b0[0] + u0[0] * x, b0[1] + u0[1] * x, zt], tekst: `ctop = ${dk(-zt, 0)} mm` });
    }
  }
  // ankerarmering for forskydning (7.2.2.6, Fig. 7.10) vender mod armeringskanten; grå = regnes ikke virksom
  const av = m.beton.armering?.ankerarmeringForskydning;
  if (av?.aktiv && k?.armKant) {
    const kant = k.armKant.kant, fr = k.kantbrud.forreste[kant];
    if (fr) {
      const dir = { xNeg: [-1, 0], xPos: [1, 0], yNeg: [0, -1], yPos: [0, 1] }[kant as 'xNeg'] as [number, number], per: [number, number] = [-dir[1], dir[0]];
      const p = av.diameter || 10, r = p / 2, zs = -(av.daekToAkse ?? 40), cnom = be.cnom ?? 30, hale = 20 * p;
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
            stang(G(fE, t0 + b.v, zs), G(fE - b.l, t0 + b.v, zs), r, { inaktiv });
            stang(G(fE - b.l, t0 + b.v, zs), G(fE - b.l - hale, t0 + b.v, zs), r, { inaktiv, variant: 'forankring' });
            if (av.krog) stang(G(fE, t0 + b.v, zs), G(fE, t0 + b.v, zs - 5 * p), r, { inaktiv });
          }
          if (av.krog) {
            // tværstang som krogen omslutter: gennemgående langs kanten (hele elementets bredde minus dæklag)
            const hj: [number, number][] = [[x0 + cnom, y0 + cnom], [x1 - cnom, y0 + cnom], [x0 + cnom, y1 - cnom], [x1 - cnom, y1 - cnom]];
            const pr = hj.map((c) => c[0] * per[0] + c[1] * per[1]), lo = Math.min(...pr) - t0, hi = Math.max(...pr) - t0;
            stang(G(fE - p, t0 + lo, zs - p), G(fE - p, t0 + hi, zs - p), r, { variant: 'tilbehoer' });
          }
        }
        if (visMaal && række[0]) {
          const q = række[0], z0 = 0.5, c1 = kantAfst(q);
          dele.push({ type: 'maal', fra: G(langs(q), tvaers(q) - 0.75 * c1, z0), til: G(langs(q), tvaers(q) + 0.75 * c1, z0), tekst: `±0,75·c1 = ${dk(0.75 * c1, 0)} mm` });
        }
      } else if (række.length) {
        // bøjle om hele forreste række (b) eller løkke om hvert anker (c): lukket ende mod skafterne på kantsiden,
        // benene føres uden om befæstelsen ind i elementet; flere lægges under hinanden
        const grupper = av.type === 'boejle' ? [række] : række.map((q: { id: number; x: number; y: number }) => [q]);
        const ben = k.armV.ben || 2;
        const bj = k.armV.boejler;
        const antal = bj ? bj.length : Math.max(1, Math.round(av.type === 'boejle' ? (ben * række.length) / 2 : ben / 2));
        const o = d / 2 + r + 2;
        for (const gr of grupper) {
          const fore = Math.max(...gr.map(langs)) + d / 2 + r, bag = Math.min(...gr.map(langs)) - d / 2 - r;
          const lo = Math.min(...gr.map(tvaers)) - o, hi = Math.max(...gr.map(tvaers)) + o;
          for (let j = 0; j < antal; j++) {
            // med bøjleafstand ligger bøjlerne efter hinanden ind i elementet (grå uden for 0,5·c1); ellers ⌀+1 under hinanden
            const z = bj ? zs : zs - j * (p + 1), sk = bj ? -bj[j]!.pos : 0, ia = alle || (bj ? !bj[j]!.virksom : false);
            for (const vv of [lo, hi]) { stang(G(fore + sk, vv, z), G(bag + sk, vv, z), r, { inaktiv: ia }); stang(G(bag + sk, vv, z), G(bag + sk - hale, vv, z), r, { inaktiv: ia, variant: 'forankring' }); }
            stang(G(fore + sk, lo, z), G(fore + sk, hi, z), r, { inaktiv: ia });
          }
        }
      }
    }
  }
  // kantarmering (bøjler langs frie kanter): længdestænger foroven/forneden og bøjleben med afstanden a (7.2.2.5)
  if (be.armering?.kantarmering === 'boejler' && be.armering.kantarmeringDiameter) {
    const dk2 = be.armering.kantarmeringDiameter / 2, c = be.cnom ?? 30, a = be.armering.kantarmeringAfstand;
    const kanter2: { fri: boolean; langs: boolean; fast: number; lo: number; hi: number }[] = [
      { fri: fri('xNeg'), langs: true, fast: x0 + c, lo: y0 + c, hi: y1 - c }, { fri: fri('xPos'), langs: true, fast: x1 - c, lo: y0 + c, hi: y1 - c },
      { fri: fri('yNeg'), langs: false, fast: y0 + c, lo: x0 + c, hi: x1 - c }, { fri: fri('yPos'), langs: false, fast: y1 - c, lo: x0 + c, hi: x1 - c },
    ];
    let markeret = false;
    for (const e2 of kanter2) {
      if (!e2.fri) continue;
      const P = (t: number, z: number): Pkt3 => (e2.langs ? [e2.fast, t, z] : [t, e2.fast, z]);
      stang(P(e2.lo, -dybde + c), P(e2.hi, -dybde + c), dk2); stang(P(e2.lo, -c), P(e2.hi, -c), dk2);
      if (a != null && a > 0) {
        const n = Math.min(200, Math.floor((e2.hi - e2.lo) / a));
        for (let i = 0; i <= n; i++) stang(P(e2.lo + i * a, -c), P(e2.lo + i * a, -dybde + c), dk2);
        if (visMaal && !markeret && n >= 1) { markeret = true; dele.push({ type: 'maal', fra: P(e2.lo, -c), til: P(e2.lo + a, -c), tekst: `a = ${dk(a, 0)} mm` }); }
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
    ...(dele.some((x) => x.type === 'stang' && x.variant === 'forankring') ? [{ farve: 'forankring', tekst: 'Forankring uden for brudlegemet (skematisk, ikke eftervist)' }] : []),
    ...(dele.some((x) => x.type === 'stang' && x.variant === 'tilbehoer') ? [{ farve: 'tilbehoer', tekst: 'Overflade- og kantarmering (stænger)' }] : []),
    ...(dele.some((x) => x.type === 'cirkel') ? [{ farve: 'zone', tekst: 'Zone 0,75·hef om ankeret' }] : []),
    ...(dele.some((x) => x.type === 'pil' || x.type === 'bue') ? [{ farve: 'last', tekst: 'Laster' }] : []),
  ];
  return { dele, udstraekning: udst, stoerrelse, forklaring };
}
