// Ren beskrivelse af 3D-scenen (ingen three.js, ingen DOM): koordinater i mm med x, y i plan og z op.
// Betonoverfladen er z = 0; indstøbte bolte går ned i negativ z. Scenen tegnes af scene3d.ts.
import type { KombinationsResultat } from '../core/kombination';

type Model = Record<string, any>;

export interface Udstraekning { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
export type Del =
  | { type: 'boks'; rolle: 'beton' | 'plade'; x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; afbrudt?: boolean }
  | { type: 'cyl'; rolle: 'skaft' | 'hoved' | 'moerik' | 'moertel'; x: number; y: number; z0: number; z1: number; r: number; sider: number; ankerId: number }
  | { type: 'stang'; rolle: 'armering'; fra: [number, number, number]; til: [number, number, number]; r: number; inaktiv?: boolean }
  | { type: 'kegle'; rolle: 'brud'; x: number; y: number; zTop: number; hoejde: number; radius: number }
  | { type: 'legeme'; rolle: 'brud'; punkter: [number, number, number][]; flader: [number, number, number][] }
  | { type: 'maal'; fra: [number, number, number]; til: [number, number, number]; tekst: string; felt?: string; vaerdi?: number }
  | { type: 'pil'; rolle: 'last'; fra: [number, number, number]; til: [number, number, number]; tekst: string; felt?: string; vaerdi?: number }
  | { type: 'bue'; rolle: 'last'; centrum: [number, number, number]; akse: 'x' | 'y' | 'z'; radius: number; fortegn: 1 | -1; tekst: string; vinkel: number; felt?: string; vaerdi?: number };

export interface Scene3DBeskrivelse { dele: Del[]; udstraekning: Udstraekning; stoerrelse: number; forklaring: { farve: string; tekst: string }[] }

const dk = (v: number, d = 1) => v.toFixed(d).replace('.', ',').replace('-', '−');

export function byg3d(m: Model, k: KombinationsResultat | null, last: Record<string, number> | null, visBrud = false, visMaal = true, visLast = true): Scene3DBeskrivelse {
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
  // ankerarmering for træk: bøjler (to ben) rundt om hvert anker, afvekslende langs x og y
  const at = be.armering?.ankerarmeringTraek;
  if (at?.aktiv) {
    const r = (at.diameter || 12) / 2, bund = -(at.forankringsdybde ?? hef), top = -(at.daeklagTop ?? 40);
    for (const q of ankre) {
      for (let i = 0; i < Math.max(1, at.antalBoejler ?? 1); i++) {
        const langsX = i % 2 === 0, o = at.afstand + Math.floor(i / 2) * 2 * r * 2;
        const [ax, ay] = langsX ? [0, 1] : [1, 0];
        const ben = (fortegn: number): [number, number, number][] => [[q.x + fortegn * o * ax, q.y + fortegn * o * ay, top], [q.x + fortegn * o * ax, q.y + fortegn * o * ay, bund]];
        const [a1, a2] = ben(1) as [[number, number, number], [number, number, number]], [b1, b2] = ben(-1) as [[number, number, number], [number, number, number]];
        dele.push({ type: 'stang', rolle: 'armering', fra: a1, til: a2, r }, { type: 'stang', rolle: 'armering', fra: b1, til: b2, r }, { type: 'stang', rolle: 'armering', fra: a2, til: b2, r });
      }
    }
  }
  // ankerarmering for forskydning: stænger fra bolten mod armeringskanten (grå hvis de ikke regnes virksomme)
  const av = m.beton.armering?.ankerarmeringForskydning;
  if (av?.aktiv && k?.armKant) {
    const kant = k.armKant.kant, fr = k.kantbrud.forreste[kant];
    if (fr) {
      const dir = { xNeg: [-1, 0], xPos: [1, 0], yNeg: [0, -1], yPos: [0, 1] }[kant as 'xNeg'] as [number, number], per: [number, number] = [-dir[1], dir[0]];
      const r = (av.diameter || 10) / 2, z = -(av.daekToAkse ?? 40), cnom = be.cnom ?? 30;
      const lateral: { v: number; l: number; ok: boolean }[] = k.armV.staenger?.length
        ? k.armV.staenger.map((q) => ({ v: q.v, l: Math.max(0, q.l1), ok: q.virksom }))
        : [d / 2 + r + 2, -(d / 2 + r + 2)].map((v) => ({ v, l: Math.max(0, k.armV.l1 ?? fr.c1 - cnom), ok: k.armV.virksom }));
      for (const id of fr.ankre) {
        const q = ankre.find((a2) => a2.id === id); if (!q) continue;
        for (const b of lateral) dele.push({ type: 'stang', rolle: 'armering', fra: [q.x + per[0] * b.v, q.y + per[1] * b.v, z], til: [q.x + per[0] * b.v + dir[0] * b.l, q.y + per[1] * b.v + dir[1] * b.l, z], r, inaktiv: !b.ok });
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
  if (visBrud && k && (styr === 'N_c' || kombi)) {
    for (const q of k.traek.traekAnkre) dele.push({ type: 'kegle', rolle: 'brud', x: q.x, y: q.y, zTop: 0, hoejde: hef, radius: 1.5 * hef });
  }
  if (visBrud && k && (styr === 'V_c' || kombi) && k.kantbrud.styrende) {
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
    ...(dele.some((x) => x.type === 'kegle' || x.type === 'legeme') ? [{ farve: 'brud', tekst: 'Brudlegeme (idealiseret)' }] : []),
    ...(dele.some((x) => x.type === 'stang') ? [{ farve: 'armering', tekst: 'Armering' }] : []),
    ...(dele.some((x) => x.type === 'pil' || x.type === 'bue') ? [{ farve: 'last', tekst: 'Laster' }] : []),
  ];
  return { dele, udstraekning: udst, stoerrelse, forklaring };
}
