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

export function byg3d(m: Model, k: KombinationsResultat | null, last: Record<string, number> | null, visBrud = false, visMaal = true, visLast = true, valgtBrud: string | null = null): Scene3DBeskrivelse {
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
  // ankerarmering for træk (7.2.1.2, Fig. 7.2): bøjler i lodrette planer, parvis og symmetrisk om ankeret.
  // Planet er forskudt M fra boltens akse, benene sidder ±x fra planets midte (radial afstand √(x²+M²) ≤ 0,75·hef),
  // bøjningen ligger ved overfladen om overfladearmeringen, og benene føres ned forbi brudkeglen. Flere bøjler drejes om ankeret.
  const at = be.armering?.ankerarmeringTraek;
  if (at?.aktiv && ankre.length) {
    const p = at.diameter || 12, r = p / 2, n = Math.max(1, Math.round(at.antalBoejler ?? 1)), x = at.afstand, M = d / 2 + r + 2;
    const bundZ = -(at.foering === 'ingen' ? (at.forankringsdybde ?? hef) : hef);
    const alleInaktive = !!k && !k.armT.virksom, ikkeVirk = k?.armT.ikkeVirksomme ?? 0;
    for (const q of ankre) {
      dele.push({ type: 'cirkel', x: q.x, y: q.y, z: 0.5, radius: 0.75 * hef });
      for (let j = 0; j < n; j++) {
        const th = (j * Math.PI) / n, u: [number, number] = [Math.cos(th), Math.sin(th)], w: [number, number] = [-Math.sin(th), Math.cos(th)];
        const zt = -(at.daeklagTop ?? 40) - j * (p + 1), zb = Math.min(bundZ, zt - 10), inaktiv = alleInaktive || j >= n - ikkeVirk;
        const pt = (s: number, z: number): Pkt3 => [q.x + u[0] * s * x + w[0] * M, q.y + u[1] * s * x + w[1] * M, z];
        stang(pt(1, zt), pt(1, zb), r, { inaktiv });
        stang(pt(-1, zt), pt(-1, zb), r, { inaktiv });
        if (at.krog) {
          stang(pt(1, zt), pt(-1, zt), r, { inaktiv });
          // overfladearmering som bøjlens bøjning omslutter (skematisk; ikke et input)
          const fl = (ww: number): Pkt3 => [q.x + w[0] * ww, q.y + w[1] * ww, zt - p];
          stang(fl(M), fl(M + 8 * p), r, { variant: 'tilbehoer' });
        }
      }
    }
    if (visMaal) {
      const q = ankre[0]!, zt = -(at.daeklagTop ?? 40);
      dele.push({ type: 'maal', fra: [q.x, q.y + M, zt], til: [q.x + x, q.y + M, zt], tekst: `x = ${dk(x, 0)} mm` });
      dele.push({ type: 'maal', fra: [q.x + x, q.y + M, 0], til: [q.x + x, q.y + M, zt], tekst: `ctop = ${dk(-zt, 0)} mm` });
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
            const vs = lateral.map((b) => b.v), lo = Math.min(...vs) - 3 * p, hi = Math.max(...vs) + 3 * p;
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
        const antal = Math.max(1, Math.round(av.type === 'boejle' ? (ben * række.length) / 2 : ben / 2));
        const o = d / 2 + r + 2;
        for (const gr of grupper) {
          const fore = Math.max(...gr.map(langs)) + d / 2 + r, bag = Math.min(...gr.map(langs)) - d / 2 - r;
          const lo = Math.min(...gr.map(tvaers)) - o, hi = Math.max(...gr.map(tvaers)) + o;
          for (let j = 0; j < antal; j++) {
            const z = zs - j * (p + 1);
            for (const vv of [lo, hi]) { stang(G(fore, vv, z), G(bag, vv, z), r, { inaktiv: alle }); stang(G(bag, vv, z), G(bag - hale, vv, z), r, { inaktiv: alle, variant: 'forankring' }); }
            stang(G(fore, lo, z), G(fore, hi, z), r, { inaktiv: alle });
          }
        }
      }
    }
  }
  // kantarmering (bøjler langs frie kanter), vist som stænger med valgt afstand
  if (be.armering?.kantarmering === 'boejler' && be.armering.kantarmeringDiameter) {
    const dk2 = be.armering.kantarmeringDiameter / 2, c = be.cnom ?? 30;
    for (const [kant, k] of [['xNeg', 'x0'], ['xPos', 'x1']] as const) {
      if (!fri(kant)) continue;
      const x = k === 'x0' ? x0 + c : x1 - c;
      dele.push({ type: 'stang', rolle: 'armering', fra: [x, y0 + c, -dybde + c], til: [x, y1 - c, -dybde + c], r: dk2 }, { type: 'stang', rolle: 'armering', fra: [x, y0 + c, -c], til: [x, y1 - c, -c], r: dk2 });
    }
    for (const [kant, k] of [['yNeg', 'y0'], ['yPos', 'y1']] as const) {
      if (!fri(kant)) continue;
      const y = k === 'y0' ? y0 + c : y1 - c;
      dele.push({ type: 'stang', rolle: 'armering', fra: [x0 + c, y, -dybde + c], til: [x1 - c, y, -dybde + c], r: dk2 }, { type: 'stang', rolle: 'armering', fra: [x0 + c, y, -c], til: [x1 - c, y, -c], r: dk2 });
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
  if (aktiv('Vx')) dele.push({ type: 'pil', rolle: 'last', fra: p0, til: [Math.sign(l.Vx!) * L, 0, lastZ], tekst: `Vx = ${dk(l.Vx! / 1e3)} kN`, felt: 'last:Vx', vaerdi: l.Vx! / 1e3 });
  if (aktiv('Vy')) dele.push({ type: 'pil', rolle: 'last', fra: p0, til: [0, Math.sign(l.Vy!) * L, lastZ], tekst: `Vy = ${dk(l.Vy! / 1e3)} kN`, felt: 'last:Vy', vaerdi: l.Vy! / 1e3 });
  const c: [number, number, number] = [0, 0, lastZ + L * 0.35];
  if (aktiv('Mx')) dele.push({ type: 'bue', rolle: 'last', centrum: c, akse: 'x', radius: L * 0.32, fortegn: l.Mx! > 0 ? 1 : -1, tekst: `Mx = ${dk(l.Mx! / 1e6)} kNm`, felt: 'last:Mx', vaerdi: l.Mx! / 1e6, vinkel: 270 });
  if (aktiv('My')) dele.push({ type: 'bue', rolle: 'last', centrum: c, akse: 'y', radius: L * 0.32, fortegn: l.My! > 0 ? 1 : -1, tekst: `My = ${dk(l.My! / 1e6)} kNm`, felt: 'last:My', vaerdi: l.My! / 1e6, vinkel: 270 });
  if (aktiv('T')) dele.push({ type: 'bue', rolle: 'last', centrum: [0, 0, topZ + 2], akse: 'z', radius: Math.max(pl.bx, pl.by) * 0.42, fortegn: l.T! > 0 ? 1 : -1, tekst: `T = ${dk(l.T! / 1e6)} kNm`, felt: 'last:T', vaerdi: l.T! / 1e6, vinkel: 300 });
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
    ...(dele.some((x) => x.type === 'stang' && x.variant === 'tilbehoer') ? [{ farve: 'tilbehoer', tekst: 'Forudsat overfladearmering/kantarmering (skematisk)' }] : []),
    ...(dele.some((x) => x.type === 'cirkel') ? [{ farve: 'zone', tekst: 'Zone 0,75·hef om ankeret' }] : []),
    ...(dele.some((x) => x.type === 'pil' || x.type === 'bue') ? [{ farve: 'last', tekst: 'Laster' }] : []),
  ];
  return { dele, udstraekning: udst, stoerrelse, forklaring };
}
