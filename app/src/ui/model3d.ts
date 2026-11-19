// Ren beskrivelse af 3D-scenen (ingen three.js, ingen DOM): koordinater i mm med x, y i plan og z op.
// Betonoverfladen er z = 0; indstøbte bolte går ned i negativ z. Scenen tegnes af scene3d.ts.
import { dornDiameter } from '../core/reinforcement';
import { psiReVMangler } from '../core/edgebreakout';
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

export interface Scene3DBeskrivelse { dele: Del[]; udstraekning: Udstraekning; stoerrelse: number; forklaring: { farve: string; tekst: string }[]; noter: string[] }

/** Afstand fra forreste anker (mindste koordinat for −kanter, største for +kanter) til kanten – til kravet a ≤ 2·c1. */
const q0x = (ankre: { x: number; y: number }[], w: 'x' | 'y' | 'xmax' | 'ymax'): number => {
  const v = ankre.map((q) => (w[0] === 'x' ? q.x : q.y));
  return w.endsWith('max') ? Math.max(...v) : Math.min(...v);
};
const dk = (v: number, d = 1) => v.toFixed(d).replace('.', ',').replace('-', '−');

type P3 = [number, number, number];
/** Hovedets radius for et indstøbt anker (firkantet hoved: halv side). */
const a2r = (a: Model): number | null => { const dh = a.hovedForm === 'firkant' ? (a.hovedSide ?? a.dh) : a.dh; return dh != null ? dh / 2 : null; };
/** Cylinder (stang eller ankerdel) givet ved aksens endepunkter og radius. */
interface Legeme { fra: P3; til: P3; r: number }
type Familie = 'traek' | 'traekFlade' | 'forskydning' | 'forskydningKant' | 'kantBoejle' | 'kantStang';
const FAMILIENAVN: Record<Familie, string> = {
  traek: 'trækbøjlerne', traekFlade: 'overfladearmeringen (træk)', forskydning: 'forskydningsarmeringen', forskydningKant: 'kantstangen (forskydning)',
  kantBoejle: 'kantbøjlerne (ψre,V)', kantStang: 'kantstængerne (ψre,V)',
};

/** Mindste afstand mellem to liniestykker p1–q1 og p2–q2. */
export function segAfstand(p1: P3, q1: P3, p2: P3, q2: P3): number {
  const d1: P3 = [q1[0] - p1[0], q1[1] - p1[1], q1[2] - p1[2]], d2: P3 = [q2[0] - p2[0], q2[1] - p2[1], q2[2] - p2[2]], w: P3 = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]];
  const dot = (u: P3, v: P3) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const A = dot(d1, d1), B = dot(d1, d2), C = dot(d2, d2), D = dot(d1, w), E = dot(d2, w), N = A * C - B * B;
  const kl = (t: number) => Math.min(1, Math.max(0, t));
  let s = A < 1e-12 ? 0 : N > 1e-12 ? kl((B * E - C * D) / N) : 0;
  let t = C < 1e-12 ? 0 : (B * s + E) / C;
  if (t < 0 || t > 1) { t = kl(t); s = A < 1e-12 ? 0 : kl((B * t - D) / A); }
  const x = w[0] + d1[0] * s - d2[0] * t, y = w[1] + d1[1] * s - d2[1] * t, z = w[2] + d1[2] * s - d2[2] * t;
  return Math.hypot(x, y, z);
}
/** Hvor meget (mm) to cylindre overlapper; ≤ 0 når de højst rører hinanden. */
const overlap = (a: Legeme, b: Legeme) => a.r + b.r - segAfstand(a.fra, a.til, b.fra, b.til);

/** Par af armeringsfamilier (eller familie og anker), hvis stænger overlapper mere end tol mm, med største overlap. */
export function armeringsKollisioner(dele: Del[], gruppe: Map<Del, string>, ankre: Legeme[], tol = 0.5): { a: Familie; b: Familie | 'anker'; mm: number }[] {
  const st = dele.filter((x): x is Extract<Del, { type: 'stang' }> => x.type === 'stang' && gruppe.has(x));
  const kasse = (L: Legeme) => [0, 1, 2].map((i) => [Math.min(L.fra[i]!, L.til[i]!) - L.r, Math.max(L.fra[i]!, L.til[i]!) + L.r] as const);
  const kasser = st.map(kasse), aKasser = ankre.map(kasse);
  const moedes = (p: readonly (readonly [number, number])[], q: readonly (readonly [number, number])[]) => p.every(([a0, a1], i) => a0 <= q[i]![1] && q[i]![0] <= a1);
  const fam = (x: Del) => gruppe.get(x)!.split('#')[0] as Familie;
  const fund = new Map<string, { a: Familie; b: Familie | 'anker'; mm: number }>();
  const noter = (a: Familie, b: Familie | 'anker', mm: number) => {
    const [x, y] = b !== 'anker' && b < a ? [b, a] : [a, b];
    const k = `${x}|${y}`, f = fund.get(k);
    if (!f || mm > f.mm) fund.set(k, { a: x as Familie, b: y, mm });
  };
  for (let i = 0; i < st.length; i++) {
    for (let j = i + 1; j < st.length; j++) {
      if (gruppe.get(st[i]!) === gruppe.get(st[j]!) || !moedes(kasser[i]!, kasser[j]!)) continue;
      const ov = overlap(st[i]!, st[j]!);
      if (ov > tol) noter(fam(st[i]!), fam(st[j]!), ov);
    }
    ankre.forEach((A, j) => { if (moedes(kasser[i]!, aKasser[j]!)) { const ov = overlap(st[i]!, A); if (ov > tol) noter(fam(st[i]!), 'anker', ov); } });
  }
  return [...fund.values()];
}

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
  // Hver stang tilhører en gruppe "familie#nr" (én fysisk stang/bøjle). Bruges til at finde stænger, der skærer hinanden eller ankrene.
  const gruppe = new Map<Del, string>();
  let gruppeNr = 0;
  const nyGruppe = (familie: Familie) => `${familie}#${gruppeNr++}`;
  const stang = (fra: Pkt3, til: Pkt3, r: number, ekstra: { inaktiv?: boolean; variant?: 'forankring' | 'tilbehoer'; gruppe?: string } = {}) => {
    const { gruppe: g, ...rest } = ekstra;
    const del: Del = { type: 'stang', rolle: 'armering', fra, til, r, ...rest };
    dele.push(del);
    if (g) gruppe.set(del, g);
  };
  // ankrenes skaft og hoved som forhindringer (akse fra–til og radius)
  const ankerLegemer: Legeme[] = ankre.flatMap((q) => [
    { fra: [q.x, q.y, -hef] as Pkt3, til: [q.x, q.y, topZ] as Pkt3, r: d / 2 },
    ...(indstoebt ? [{ fra: [q.x, q.y, -hef] as Pkt3, til: [q.x, q.y, -hef + a.th] as Pkt3, r: (a.hovedForm === 'firkant' ? (a.hovedSide ?? a.dh) : a.dh) / 2 }] : []),
  ]);
  // ankerarmering for træk (EN 1992-4, 7.2.1.2; CEN/TS 1992-4-2, 6.2.2): åbne bøjler (hårnåle) i lodrette planer, parvis og symmetrisk om ankeret,
  // så tæt på ankeret som praktisk muligt (virksomme inden for 0,75·hef) og helst omsluttende overfladearmeringen.
  // Planet er forskudt M fra boltens akse, benene sidder ±x fra planets midte (radial afstand √(x²+M²)).
  // Hjørnerne er bukket om en dorn (EN 1992-1-1, Tabel 8.1N: 4⌀ for ⌀ ≤ 16 mm, ellers 7⌀).
  // l1 = benets længde fra bøjlens overkant (ctop) til brudkeglens overflade (35°); herfra forankres benet uden for brudlegemet med lbd
  // (EN 1992-1-1, 8.4.4; α2–α5 = 1). Overfladearmeringen er rigtige stænger (⌀s, ss); en stang i hvert lag går gennem hver bøjle.
  const at = be.armering?.ankerarmeringTraek;
  if (at?.aktiv && ankre.length) {
    const p = at.diameter || 12, r = p / 2, n = Math.max(1, Math.round(at.antalBoejler ?? 1)), x = at.afstand, M = at.planAfstand != null && at.planAfstand > 0 ? at.planAfstand : d / 2 + r + 2;
    const fs = at.fladeDiameter ?? 10, ss = at.fladeAfstand ?? 150, cn = be.cnom ?? 30;
    const rad = Math.hypot(x, M), zKegle = -(hef - Math.tan((35 * Math.PI) / 180) * rad); // dybde hvor benet skærer brudkeglen
    const lbd = k?.forank?.T?.lbd ?? null;
    // 'stoed': benet føres lbd forbi keglen; 'ingen': benet ender i den angivne forankringsdybde – tom = hef, samme forudsætning som N_cre
    // (beregningen advarer, hvis det giver mindre end lbd uden for keglen)
    const bundZ = at.foering === 'ingen' ? -(k?.forankT?.endeDybde ?? at.forankringsdybde ?? hef) : (lbd != null ? zKegle - lbd : -hef);
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
    const th0 = at.vinkel != null ? (at.vinkel * Math.PI) / 180 : at.drejet ? Math.PI / 2 : 0;
    const aksial = n === 1;
    const retning = (j: number) => { const th = (j * Math.PI) / n + th0; return { u: [Math.cos(th), Math.sin(th)] as [number, number], w: [-Math.sin(th), Math.cos(th)] as [number, number] }; };
    // 1) bøjlerne (hårnåle); deres segmenter er forhindringer for overfladestængerne
    const boejleLegemer: Legeme[] = [];
    for (const q of ankre) {
      for (let j = 0; j < n; j++) {
        const { u, w } = retning(j), g = nyGruppe('traek');
        const zt = -(at.daeklagTop ?? 40) - j * (p + 1), zb = Math.min(bundZ, zt - 10), inaktiv = alleInaktive || j >= n - ikkeVirk;
        const pt = (sv: number, z: number): Pkt3 => [q.x + u[0] * sv + w[0] * M, q.y + u[1] * sv + w[1] * M, z];
        const seg = (fra: Pkt3, til: Pkt3) => { stang(fra, til, r, { inaktiv, gruppe: g }); boejleLegemer.push({ fra, til, r }); };
        if (at.krog) {
          const Rb = Math.max(0.1, Math.min(dorn / 2 + r, x, zt - zb)), N = 8;
          const bue = (cs: number, cz: number, a0: number, a1: number): [number, number][] => Array.from({ length: N + 1 }, (_, i) => [cs + Rb * Math.cos(a0 + ((a1 - a0) * i) / N), cz + Rb * Math.sin(a0 + ((a1 - a0) * i) / N)]);
          // åben bøjle (hårnål): bøjning foroven om overfladearmeringen, benene fortsætter lige ned og forankres med lbd uden for keglen
          const sti: [number, number][] = [
            [-x, zb], [-x, zt - Rb], ...bue(-x + Rb, zt - Rb, Math.PI, Math.PI / 2), [x - Rb, zt], ...bue(x - Rb, zt - Rb, Math.PI / 2, 0), [x, zb],
          ];
          for (let i = 0; i + 1 < sti.length; i++) { const a2 = sti[i]!, b2 = sti[i + 1]!; if (Math.hypot(a2[0] - b2[0], a2[1] - b2[1]) > 1e-6) seg(pt(a2[0], a2[1]), pt(b2[0], b2[1])); }
        } else {
          seg(pt(1 * x, zt), pt(1 * x, zb));
          seg(pt(-x, zt), pt(-x, zb));
        }
      }
    }
    // 2) overfladearmeringen (kun når bøjlerne har bøjning foroven): rigtige stænger, der ikke må gå gennem ankrene eller bøjlernes ben.
    //    En stang ligger på linjen  n·s + t·dv  (n ⟂ dv i planen) i dybden z; s forskydes til en fri placering.
    if (at.krog) {
      const placeret: Legeme[] = [];
      const set = new Set<string>();
      const linje = (dv: [number, number], sv: number, z: number): Legeme | null => {
        const nv: [number, number] = [-dv[1], dv[0]], p0: [number, number] = [nv[0] * sv, nv[1] * sv];
        const kl = klip(p0, dv); if (!kl) return null;
        return { fra: [p0[0] + dv[0] * kl[0], p0[1] + dv[1] * kl[0], z], til: [p0[0] + dv[0] * kl[1], p0[1] + dv[1] * kl[1], z], r: fs / 2 };
      };
      const noegle = (dv: [number, number], sv: number, z: number) => `${Math.round(dv[0] * 1e3)}:${Math.round(dv[1] * 1e3)}:${Math.round(sv * 10)}:${Math.round(z * 10)}`;
      const fri = (L: Legeme) => [...ankerLegemer, ...boejleLegemer, ...placeret].every((o) => overlap(L, o) <= 0.5);
      /** Placer en stang ved den første frie af kandidaterne; giver placeringen (eller null). tving: tegn den første uanset kollision. */
      const placer = (dv: [number, number], kandidater: number[], z: number, tving = false): number | null => {
        for (const sv of tving ? kandidater.slice(0, 1) : kandidater) {
          if (set.has(noegle(dv, sv, z))) return sv;
          const L = linje(dv, sv, z);
          if (!L || (!tving && !fri(L))) continue;
          set.add(noegle(dv, sv, z)); placeret.push(L);
          stang(L.fra, L.til, L.r, { variant: 'tilbehoer', gruppe: nyGruppe('traekFlade') });
          return sv;
        }
        return null;
      };
      const omkring = (s0: number, maks: number, trin = 2.5) => { const l = [s0]; for (let i = 1; i * trin <= maks; i++) l.push(s0 + i * trin, s0 - i * trin); return l; };
      const fri0 = d / 2 + fs / 2 + 1; // mindste afstand fra ankerets akse til stangens akse
      for (const q of ankre) {
        for (let j = 0; j < n; j++) {
          const { u, w } = retning(j), zt = -(at.daeklagTop ?? 40) - j * (p + 1), z1 = zt - r - fs / 2;
          // lag 1: stangen som bøjlen omslutter, vinkelret på bøjlens plan, inde i bøjlen (mellem benene) men fri af ankeret.
          // Stangen ligger på linjen u = uq + s (retning w); normalen til w er −u, derfor fortegnet.
          const uq = q.x * u[0] + q.y * u[1], inde = Math.max(fri0, x - r - fs / 2);
          const kand: number[] = [];
          for (let s2 = fri0; s2 <= inde + 1e-9; s2 += 2.5) kand.push(s2, -s2);
          // findes der ingen fri plads (fx for lille x), tegnes stangen alligevel, og kollisionen meldes som note
          const s1 = placer(w, kand.map((s2) => -(uq + s2)), z1) ?? placer(w, [-(uq + fri0)], z1, true);
          if (aksial && j === 0 && q === ankre[0]) {
            const z2 = z1 - fs; // lag 2 (parallelt med bøjlens plan) lige under lag 1, også inde i bøjlen
            const b1 = s1 ?? -(uq + fri0);
            for (let i = -200; i <= 200; i++) if (i !== 0 && linje(w, b1 - i * ss, z1)) placer(w, omkring(b1 - i * ss, ss / 2 - fs), z1);
            const wq = q.x * w[0] + q.y * w[1];
            for (let i = -200; i <= 200; i++) if (linje(u, wq + i * ss, z2)) placer(u, omkring(wq + i * ss, ss / 2 - fs), z2);
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
        const udenFor = zKegle - zbund, kort = lbd != null && udenFor < lbd - 0.5;
        dele.push({ type: 'maal', fra: benZ(zKegle), til: benZ(zbund), tekst: lbd == null ? 'forankring'
          : kort ? `forankring uden for keglen ${dk(udenFor, 0)} mm < lbd = ${dk(lbd, 0)} mm (ender i ${dk(-bundZ, 0)}${at.forankringsdybde == null ? ' = hef' : ''})`
          : `lbd = ${dk(lbd, 0)} mm (σsd = ${dk(k!.forank.T!.sigmaSd, 0)} MPa)${at.foering === 'ingen' ? ` (ender i ${dk(-bundZ, 0)}; forankret ${dk(udenFor, 0)} mm uden for keglen)` : ''}` });
        if (kort) dele.push({ type: 'tekst', pos: benZ(zbund - 10), tekst: `OBS: trækbøjlernes ben er kun forankret ${dk(udenFor, 0)} mm uden for brudkeglen, men kræver lbd = ${dk(lbd!, 0)} mm – angiv armeringens forankringsdybde ≥ ${dk(-zKegle + lbd!, 0)} mm` });
      }
      dele.push({ type: 'tekst', pos: [ben[0] - u0[0] * 25, ben[1] - u0[1] * 25, zt - 30], tekst: 'TRÆKARMERING (fig. 7.2): lodrette hårnåle' });
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
        // de fysiske stænger (hver tegnes én gang): tværkoordinat i tegningens system, l1 og om den regnes med (grå: ikke virksom eller gennem et anker)
        const tAx: [number, number] = kant === 'xNeg' || kant === 'xPos' ? [0, 1] : [1, 0], sig = per[0] * tAx[0] + per[1] * tAx[1];
        const fys: { vAbs: number; l: number; ok: boolean }[] = k.armV.alle?.length
          ? k.armV.alle.map((b: { pos: number; l1: number; virksom: boolean; konflikt: boolean }) => ({ vAbs: sig * b.pos, l: Math.max(0, b.l1), ok: b.virksom && !b.konflikt }))
          : række.flatMap((q) => (k.armV.staenger?.length
            ? k.armV.staenger.map((b: { v: number; l1: number; virksom: boolean }) => ({ vAbs: tvaers(q) + b.v, l: Math.max(0, b.l1), ok: b.virksom }))
            : [d / 2 + r + 2, -(d / 2 + r + 2)].map((v) => ({ vAbs: tvaers(q) + v, l: Math.max(0, k.armV.l1 ?? fr.c1 - cnom), ok: k.armV.virksom }))));
        const fE = række[0] ? langs(række[0]) + kantAfst(række[0]) - cnom : 0;
        for (const b of fys) {
          const inaktiv = !b.ok, gruppe = nyGruppe('forskydning');
          // krog ved kanten: 90°-bøjning (dorn 4⌀/7⌀) og 10⌀ lige ende (EN 1992-1-1, Fig. 8.1b); stangen regnes fra bøjningens start
          const Rh = av.krog ? dornV / 2 + r : 0, v0 = b.vAbs;
          if (av.krog) {
            const N = 8, bue = Array.from({ length: N + 1 }, (_, i) => { const a = Math.PI / 2 - ((Math.PI / 2) * i) / N; return [fE - Rh + Rh * Math.cos(a), zs - Rh + Rh * Math.sin(a)] as [number, number]; });
            for (let i = 0; i < N; i++) stang(G(bue[i]![0], v0, bue[i]![1]), G(bue[i + 1]![0], v0, bue[i + 1]![1]), r, { inaktiv, gruppe });
            stang(G(fE, v0, zs - Rh), G(fE, v0, zs - Rh - 10 * p), r, { inaktiv, gruppe });
          }
          stang(G(fE - Rh, v0, zs), G(fE - b.l, v0, zs), r, { inaktiv, gruppe });
          stang(G(fE - b.l, v0, zs), G(fE - b.l - hale, v0, zs), r, { inaktiv, variant: 'forankring', gruppe });
        }
        if (visMaal && (k.armV.konflikter ?? 0) > 0) dele.push({ type: 'tekst', pos: G(fE, 0, zs), tekst: `OBS: ${k.armV.konflikter} overfladestang${k.armV.konflikter === 1 ? '' : 'e'} ville gå gennem et anker – tegnet grå og ikke medregnet (ret x, s eller antal)` });
        if (række[0]) {
          // kantarmering langs kanten (EN 1992-4, 7.2.2.2 (3) f): skal altid forefindes ved overfladearmering. Med krog ligger den inde i krogens
          // bøjning an mod dornens inderside (knuden i trykstivermodellen); ellers lige under stængernes ender. Gennemgående langs kanten
          // (hele elementets bredde minus dæklag); én stang for hele rækken.
          const q = række[0], fE = langs(q) + kantAfst(q) - cnom, rk = (av.kantstangDiameter && av.kantstangDiameter > 0 ? av.kantstangDiameter : p) / 2;
          const hj: [number, number][] = [[x0 + cnom, y0 + cnom], [x1 - cnom, y0 + cnom], [x0 + cnom, y1 - cnom], [x1 - cnom, y1 - cnom]];
          const pr = hj.map((c) => c[0] * per[0] + c[1] * per[1]), lo = Math.min(...pr), hi = Math.max(...pr);
          const Rh = dornV / 2 + r, ind = Math.max(0, dornV / 2 - rk) / Math.SQRT2; // fra bøjningens centrum mod hjørnet
          const ka = av.krog ? fE - Rh + ind : fE - rk, kz = av.krog ? zs - Rh + ind : zs - r - rk;
          stang(G(ka, lo, kz), G(ka, hi, kz), rk, { variant: 'tilbehoer', gruppe: nyGruppe('forskydningKant') });
        }
        if (visMaal && række[0]) {
          const ek = k.brudformer?.find((x: { id: string }) => x.id === 'V_ek');
          const q = række[0], z0 = 0.5, c1 = kantAfst(q);
          dele.push({ type: 'tekst', pos: G(langs(q) + c1, tvaers(q) - 0.75 * c1 - 40, z0 + 25), tekst: 'FORSKYDNINGSARMERING (fig. 7.10 a): vandret ⟂ kant' });
          dele.push({ type: 'maal', fra: G(langs(q), tvaers(q) - 0.75 * c1, z0), til: G(langs(q), tvaers(q) + 0.75 * c1, z0), tekst: `±0,75·c1 = ${dk(0.75 * c1, 0)} mm` });
          const b0 = fys.reduce((a, b) => (Math.abs(b.vAbs - tvaers(q)) < Math.abs(a.vAbs - tvaers(q)) ? b : a), fys[0]!), fE0 = langs(q) + c1 - cnom, v1 = b0.vAbs + 25;
          dele.push({ type: 'maal', fra: G(fE0, v1, zs), til: G(fE0 - b0.l, v1, zs), tekst: `l1 = ${dk(b0.l, 0)} mm (min. ${dk((av.krog ? 4 : 10) * p, 0)})` });
          dele.push({ type: 'maal', fra: G(fE0 - b0.l, v1, zs), til: G(fE0 - b0.l - hale, v1, zs), tekst: lbdV != null ? `lbd = ${dk(lbdV, 0)} mm (σsd = ${dk(k.forank.V!.sigmaSd, 0)} MPa)` : 'forankring' });
          dele.push({ type: 'tekst', pos: G(fE0, v1 + 60, zs - 30), tekst: ek ? `kantstang ⌀${dk(av.kantstangDiameter ?? 0, 0)} (fig. 7.10 a): T_ek = ${dk(ek.Ed / 1000, 1)} kN ${ek.udnyttelse != null && ek.udnyttelse > 1 ? '>' : '≤'} ${dk(ek.Rd / 1000, 1)} kN (α = ${dk(av.trykstiverVinkel ?? 45, 0)}°) · ${ek.udnyttelse != null ? dk(ek.udnyttelse * 100, 0) + ' %' : ''}`
            : av.kantstangDiameter && av.kantstangDiameter > 0 ? `kantstang ⌀${dk(av.kantstangDiameter, 0)} langs kanten (7.2.2.2(3)f): eftervises først, når forskydningsarmeringen er virksom`
            : 'kantstang langs kanten (7.2.2.2(3)f): angiv ⌀ for at eftervise med trykstivere' });
          if (av.krog) dele.push({ type: 'tekst', pos: G(fE0, v1, zs + 12), tekst: `krog: bukkediameter ${dk(dornV, 0)} mm, lige ende 10⌀ = ${dk(10 * p, 0)} mm` });
        }
      } else if (række.length) {
        // bøjle om hele forreste række (b) eller løkke om hvert anker (c): lukket ende mod skafterne på kantsiden,
        // benene føres uden om befæstelsen ind i elementet; flere lægges under hinanden
        const grupper = av.type === 'boejle' ? [række] : række.map((q: { id: number; x: number; y: number }) => [q]);
        const ben = k.armV.ben || 2;
        const bj = k.armV.boejler;
        const antal = bj ? bj.length : Math.max(1, Math.round(av.type === 'boejle' ? (ben * række.length) / 2 : ben / 2));
        // bøjler/løkker omslutter skaftet og ligger an mod det på kantsiden (CEN/TS 1992-4-2, 6.3.5.4). Hjørnerne bukkes om en dorn
        // (EN 1992-1-1, Tabel 8.1N), så benene ligger mindst bøjningsradius Rb fra skaftets akse; ellers ville bøjningen skære skaftet.
        const Rb = dornV / 2 + r, o = Math.max(d / 2 + r, Rb), N = 8;
        const forreste = (gr: { x: number; y: number }[]) => Math.max(...gr.map(langs)) + d / 2 + r;
        const bagerste = (gr: { x: number; y: number }[]) => Math.min(Math.min(...gr.map(langs)) - d / 2 - r, forreste(gr) - Rb);
        if (visMaal) {
          const g0 = grupper[0]!, fore0 = forreste(g0), bag0 = bagerste(g0), lo0 = Math.min(...g0.map(tvaers)) - o;
          dele.push({ type: 'maal', fra: G(bag0, lo0 - 20, zs), til: G(bag0 - hale, lo0 - 20, zs), tekst: lbdV != null ? `lbd = ${dk(lbdV, 0)} mm (σsd = ${dk(k.forank.V!.sigmaSd, 0)} MPa)` : 'forankring' });
          dele.push({ type: 'tekst', pos: G(fore0, lo0, zs + 12), tekst: `bukkediameter ${dk(dornV, 0)} mm (${p <= 16 ? '4' : '7'}⌀), omslutter og berører skaftet` });
        }
        const kantstaenger = new Set<number>();
        for (const gr of grupper) {
          const fore = forreste(gr), bag = bagerste(gr);
          const lo = Math.min(...gr.map(tvaers)) - o, hi = Math.max(...gr.map(tvaers)) + o;
          for (let j = 0; j < antal; j++) {
            // med bøjleafstand ligger bøjlerne efter hinanden ind i elementet (grå uden for 0,5·c1); ellers ⌀+1 under hinanden
            const z = bj ? zs : zs - j * (p + 1), sk = bj ? -bj[j]!.pos : 0, ia = alle || (bj ? !bj[j]!.virksom : false), gruppe = nyGruppe('forskydning');
            // ben fra bag til forkant, to bukkede hjørner (dorn 4⌀/7⌀) og tværstykke; benene fortsætter lbd bagud (forankring uden for brudlegemet)
            const bue = (ca: number, cv: number, a0: number, a1: number): [number, number][] => Array.from({ length: N + 1 }, (_, i) => [ca + Rb * Math.cos(a0 + ((a1 - a0) * i) / N), cv + Rb * Math.sin(a0 + ((a1 - a0) * i) / N)]);
            const sti: [number, number][] = [[bag, lo], [fore - Rb, lo], ...bue(fore - Rb, lo + Rb, -Math.PI / 2, 0), ...bue(fore - Rb, hi - Rb, 0, Math.PI / 2), [bag, hi]];
            for (let i = 0; i + 1 < sti.length; i++) { const a2 = sti[i]!, b2 = sti[i + 1]!; if (Math.hypot(a2[0] - b2[0], a2[1] - b2[1]) > 1e-6) stang(G(a2[0] + sk, a2[1], z), G(b2[0] + sk, b2[1], z), r, { inaktiv: ia, gruppe }); }
            for (const vv of [lo, hi]) stang(G(bag + sk, vv, z), G(bag + sk - hale, vv, z), r, { inaktiv: ia, variant: 'forankring', gruppe });
          }
          if (!kantstaenger.has(Math.round(fore * 10))) {
            // kantstang langs kanten (fig. 7.10 b/c, 7.2.2.2(3)f): ligger uden for bøjlernes lukkede ende mod kanten, gennemgående langs kanten
            // (én stang pr. række, også når hvert anker har sin egen løkke)
            kantstaenger.add(Math.round(fore * 10));
            const rk2 = (av.kantstangDiameter && av.kantstangDiameter > 0 ? av.kantstangDiameter : p) / 2;
            const hj: [number, number][] = [[x0 + cnom, y0 + cnom], [x1 - cnom, y0 + cnom], [x0 + cnom, y1 - cnom], [x1 - cnom, y1 - cnom]];
            const pr = hj.map((c) => c[0] * per[0] + c[1] * per[1]);
            stang(G(fore + r + rk2, Math.min(...pr), zs), G(fore + r + rk2, Math.max(...pr), zs), rk2, { variant: 'tilbehoer', inaktiv: alle, gruppe: nyGruppe('forskydningKant') });
          }
        }
      }
    }
  }
  // forskydningsarmering er aktiv men kan ikke tegnes uden en forreste række mod en fri kant (fig. 7.10 vender mod kanten)
  if (visMaal && av?.aktiv && !(k?.armKant && k.kantbrud?.forreste?.[k.armKant.kant])) {
    dele.push({ type: 'tekst', pos: [0, pl.by / 2 + 60, topZ], tekst: 'Forskydningsarmering vises ikke: ingen fri kant' });
  }
  // kantarmering (7.2.2.5, ψre,V): kantstænger (⌀) langs den frie kant, omsluttet af åbne hårnålebøjler (samme ⌀) med bøjningen ved kanten med afstanden a.
  // Bøjlen ligger i planet vinkelret på kanten: dæklag cnom til bøjlens yderside, dornbøjede hjørner (EN 1992-1-1, Tabel 8.1N),
  // bredde bs ind i elementet og højde over hele elementet (afkortet i tegningen); to kantstænger, én i hver af bøjlens bøjninger ved kanten,
  // an mod dornens inderside (bøjningsradius efter Tabel 8.1N), så de ikke skærer bøjlen.
  if (be.armering?.kantarmering === 'boejler' && be.armering.kantarmeringDiameter) {
    const dkb = be.armering.kantarmeringDiameter, rk = dkb / 2, c = be.cnom ?? 30, a = be.armering.kantarmeringAfstand;
    const bs = be.armering.kantarmeringBredde ?? 150, dornK = dornDiameter(dkb), Rb = Math.min(dornK / 2 + rk, bs / 2 - 1);
    const kanter2: { fri: boolean; langs: boolean; e0: number; inw: 1 | -1; lo: number; hi: number; navn: string }[] = [
      { fri: fri('xNeg'), langs: true, e0: x0, inw: 1, lo: y0 + c, hi: y1 - c, navn: 'xNeg' }, { fri: fri('xPos'), langs: true, e0: x1, inw: -1, lo: y0 + c, hi: y1 - c, navn: 'xPos' },
      { fri: fri('yNeg'), langs: false, e0: y0, inw: 1, lo: x0 + c, hi: x1 - c, navn: 'yNeg' }, { fri: fri('yPos'), langs: false, e0: y1, inw: -1, lo: x0 + c, hi: x1 - c, navn: 'yPos' },
    ];
    let markeret = false;
    // Ved et hjørne mellem to armerede kanter krydser de to kanters armering hinanden: kanterne langs x (y−/y+) lægges i laget indenfor
    // (⌀ + 1 mm længere inde fra over- og underside), og bøjlerne holdes fri af den vinkelrette kants bøjningszone (dorn + to stænger).
    const lagdelt = (fri('xNeg') || fri('xPos')) && (fri('yNeg') || fri('yPos'));
    const hjoerneZone = c + rk + Rb + 2 * rk + 1;
    // ankrene som forhindringer for kantbøjlerne (skaft eller hoved, hvis større)
    const rA = Math.max(d / 2, indstoebt ? (a2r(a) ?? 0) : 0);
    for (const e2 of kanter2) {
      if (!e2.fri) continue;
      // punkt i bøjlens plan: s = afstand fra kanten (indad), z = dybde, t = placering langs kanten
      const P = (t: number, sv: number, z: number): Pkt3 => (e2.langs ? [e2.e0 + e2.inw * sv, t, z] : [t, e2.e0 + e2.inw * sv, z]);
      const lag = lagdelt && !e2.langs ? dkb + 1 : 0;
      const s0 = c + rk, s1 = c + bs - rk, zt0 = -(c + rk + lag), zb0 = -(Math.min(be.h, dybde) - c - rk - lag); // bøjlens akse (yderste fibre i cnom)
      const ind = Math.max(0, Rb - 2 * rk) / Math.SQRT2; // fra bøjningens centrum mod hjørnet til kantstangens akse
      for (const [sv, zv] of [[s0 + Rb - ind, zt0 - Rb + ind], [s0 + Rb - ind, zb0 + Rb - ind]] as const) stang(P(e2.lo, sv, zv), P(e2.hi, sv, zv), rk, { gruppe: nyGruppe('kantStang') });
      if (a != null && a > 0) {
        // bøjlernes placering langs kanten: fri af den vinkelrette kants bøjninger og – så vidt muligt – af ankrene (forskudt net med afstanden a)
        const [pLo, pHi] = e2.langs ? [fri('yNeg') ? y0 : null, fri('yPos') ? y1 : null] : [fri('xNeg') ? x0 : null, fri('xPos') ? x1 : null];
        const tLo = pLo != null ? Math.max(e2.lo, pLo + hjoerneZone) : e2.lo, tHi = pHi != null ? Math.min(e2.hi, pHi - hjoerneZone) : e2.hi;
        const naer = ankre.map((q) => ({ t: e2.langs ? q.y : q.x, sv: e2.inw * ((e2.langs ? q.x : q.y) - e2.e0) })).filter((q) => q.sv < c + bs + rA);
        const konflikter = (o: number) => { let n2 = 0; for (let t = tLo + o; t <= tHi + 1e-9; t += a) if (naer.some((q) => Math.abs(t - q.t) < rA + rk + 0.5)) n2++; return n2; };
        let off = 0, bedst = konflikter(0);
        for (let o = 2.5; o < a && bedst > 0; o += 2.5) { const k2 = konflikter(o); if (k2 < bedst) { bedst = k2; off = o; } }
        const t0 = tLo + off;
        const n = tHi >= t0 ? Math.min(200, Math.floor((tHi - t0) / a + 1e-9)) : -1, N = 6;
        const hj = (cs: number, cz: number, a0: number, a1: number): [number, number][] => Array.from({ length: N + 1 }, (_, i) => [cs + Rb * Math.cos(a0 + ((a1 - a0) * i) / N), cz + Rb * Math.sin(a0 + ((a1 - a0) * i) / N)]);
        // åben hårnålebøjle (C): bøjningen ligger ved kanten (dornbøjede hjørner) om kantstængerne, benene går vandret ind i elementet
        const sti: [number, number][] = [[s1, zt0], ...hj(s0 + Rb, zt0 - Rb, Math.PI / 2, Math.PI), ...hj(s0 + Rb, zb0 + Rb, Math.PI, (3 * Math.PI) / 2), [s1, zb0]];
        for (let i = 0; i <= n; i++) {
          const t = t0 + i * a;
          const gruppe = nyGruppe('kantBoejle');
          for (let j2 = 0; j2 + 1 < sti.length; j2++) { const p1 = sti[j2]!, p2 = sti[j2 + 1]!; if (Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) > 1e-6) stang(P(t, p1[0], p1[1]), P(t, p2[0], p2[1]), rk, { variant: 'forankring', gruppe }); }
        }
        if (visMaal && !markeret && n >= 1) {
          markeret = true;
          dele.push({ type: 'maal', fra: P(t0, s0, zt0), til: P(t0 + a, s0, zt0), tekst: `a = ${dk(a, 0)} mm` });
          dele.push({ type: 'maal', fra: P(t0, 0, 0.5), til: P(t0, c, 0.5), tekst: `cnom = ${dk(c, 0)} mm` });
          dele.push({ type: 'maal', fra: P(t0, c, zt0 + rk + 1), til: P(t0, c + bs, zt0 + rk + 1), tekst: `ben ind i elementet = ${dk(bs, 0)} mm (min. 10⌀ = ${dk(10 * dkb, 0)})` });
          dele.push({ type: 'tekst', pos: P(t0, s1, zt0 + 15), tekst: `åben kantbøjle (åben ind mod elementet) ⌀${dk(dkb, 0)}: bukkediameter ${dk(dornK, 0)} mm (${dkb <= 16 ? '4' : '7'}⌀)` });
          const c1 = Math.abs(((e2.navn === 'xNeg' ? q0x(ankre, 'x') + (be.kanter?.xNeg ?? 0) : e2.navn === 'xPos' ? (be.kanter?.xPos ?? 0) - q0x(ankre, 'xmax') : e2.navn === 'yNeg' ? q0x(ankre, 'y') + (be.kanter?.yNeg ?? 0) : (be.kanter?.yPos ?? 0) - q0x(ankre, 'ymax'))));
          // samme krav som beregningen (edgebreakout.ts); c1 fra beregningen for kanten, hvis den er regnet (evt. reduceret c1 i smalle elementer)
          const kand = k?.kantbrud?.kanterPr?.[e2.navn as 'xNeg'];
          const mangler = psiReVMangler({ revnet: !!be.revnet, kantarmering: 'boejler', hef, cnom: c, afstand: a, diameter: dkb, c1: kand?.R?.c1 ?? c1 });
          const tekstM: Record<string, string> = { urevnet: 'betonen er urevnet', hef: `hef < 2,5·cnom = ${dk(2.5 * c, 0)} mm`, 'a>100': 'a > 100 mm', 'a>2c1': 'a > 2·c1', 'dia<12': '⌀ < 12 mm', 'a-mangler': 'a ikke angivet', ingen: 'ingen kantarmering' };
          dele.push({ type: 'tekst', pos: P(t0 + a, s1, zt0 - 40), tekst: `krav ψre,V = 1,4 (revnet beton, kantstang ⌀ ≥ 12 mm, a ≤ 100 mm og a ≤ 2·c1 = ${dk(2 * (kand?.R?.c1 ?? c1), 0)} mm, hef ≥ 2,5·cnom)${mangler.length ? ` IKKE opfyldt: ${mangler.map((x) => tekstM[x] ?? x).join(', ')} – ψre,V = 1,0` : ' (opfyldt)'}` });
        }
      }
    }
  }
  // kollisionskontrol: forskellige stænger/bøjler må højst røre hinanden, og ingen stang må gå gennem et anker (meldes som note under 3D)
  {
    let vistHint = false;
    const hint = (a: Familie, b: Familie) => {
      if (vistHint || !((a === 'traek' || b === 'traek') && (a.startsWith('forskydning') || b.startsWith('forskydning')))) return '';
      vistHint = true;
      return ` Trækbøjlernes overkant ligger ${dk(be.armering?.ankerarmeringTraek?.daeklagTop ?? 40, 0)} mm og forskydningsarmeringen ${dk(be.armering?.ankerarmeringForskydning?.daekToAkse ?? 40, 0)} mm under overfladen (til aksen). Ret dybderne eller trækbøjlernes placering (afstand x, planets afstand eller vinkel); dybderne indgår i l1 og es.`;
    };
    for (const x of armeringsKollisioner(dele, gruppe, ankerLegemer)) {
      dele.push({ type: 'tekst', pos: [0, 0, 0], tekst: x.b === 'anker'
        ? `OBS: ${FAMILIENAVN[x.a]} går gennem et anker (op til ${dk(x.mm, 0)} mm) og kan ikke udføres som tegnet.`
        : `OBS: ${FAMILIENAVN[x.a]} og ${FAMILIENAVN[x.b]} skærer hinanden (op til ${dk(x.mm, 0)} mm) og kan ikke udføres som tegnet.${hint(x.a, x.b)}` });
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
  // Tekstnoter/advarsler hører ikke hjemme i selve 3D-visningen: de vises under den.
  const noter = [...new Set(dele.filter((d): d is Extract<Del, { type: 'tekst' }> => d.type === 'tekst').map((d) => d.tekst))];
  for (let i = dele.length - 1; i >= 0; i--) if (dele[i]!.type === 'tekst') dele.splice(i, 1);
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
  return { dele, udstraekning: udst, stoerrelse, forklaring, noter };
}
