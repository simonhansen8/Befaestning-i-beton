#!/usr/bin/env python3
"""Uafhængig referenceimplementation af udvalgte formler i DS/EN 1992-4:2018 (indstøbte bolte med hoved).

Skrevet direkte efter normens formler – IKKE oversat fra den gamle kode eller den nye TypeScript-kerne.
Dækker rene, simple situationer (ingen momenter, ingen armering, ingen løftestang), hvor resultatet kan
kontrolleres i hånden. Kun karakteristiske kapaciteter (Rk) sammenlignes: de afhænger ikke af nationale γ-værdier.

Kør:  python3 verifikation/reference.py   → skriver verifikation/expected.json
Enheder: N, mm, MPa.
"""
import json, math, pathlib

FCK = {'C20/25': 20, 'C25/30': 25, 'C30/37': 30, 'C35/45': 35, 'C40/50': 40, 'C50/60': 50}


def union_len(centers, half, lo=-math.inf, hi=math.inf):
    """Længde af foreningsmængden af intervallerne [c-half, c+half] klippet til [lo, hi]."""
    iv = sorted((max(lo, c - half), min(hi, c + half)) for c in centers)
    iv = [i for i in iv if i[1] > i[0]]
    tot, cur = 0.0, None
    for a, b in iv:
        if cur is None or a > cur[1]:
            if cur: tot += cur[1] - cur[0]
            cur = [a, b]
        else:
            cur[1] = max(cur[1], b)
    if cur: tot += cur[1] - cur[0]
    return tot


def proj_area(anchors, scr, edges):
    """Projiceret areal Ac,N: forening af kvadrater scr×scr omkring hver bolt, klippet af betonkanter.
    Rektangulær forening beregnes ved koordinatkomprimering."""
    xl = -edges['xNeg'] if edges.get('xNeg') is not None else -math.inf
    xh = edges['xPos'] if edges.get('xPos') is not None else math.inf
    yl = -edges['yNeg'] if edges.get('yNeg') is not None else -math.inf
    yh = edges['yPos'] if edges.get('yPos') is not None else math.inf
    h = scr / 2
    rects = [(max(xl, x - h), max(yl, y - h), min(xh, x + h), min(yh, y + h)) for x, y in anchors]
    xs = sorted({r[0] for r in rects} | {r[2] for r in rects})
    area = 0.0
    for i in range(len(xs) - 1):
        xm = (xs[i] + xs[i + 1]) / 2
        cov = [(r[1], r[3]) for r in rects if r[0] < xm < r[2]]
        ys = sorted(cov)
        tot, cur = 0.0, None
        for a, b in ys:
            if cur is None or a > cur[1]:
                if cur: tot += cur[1] - cur[0]
                cur = [a, b]
            else:
                cur[1] = max(cur[1], b)
        if cur: tot += cur[1] - cur[0]
        area += tot * (xs[i + 1] - xs[i])
    return area


def edge_dist(a, edges):
    x, y = a
    d = []
    if edges.get('xNeg') is not None: d.append(x + edges['xNeg'])
    if edges.get('xPos') is not None: d.append(edges['xPos'] - x)
    if edges.get('yNeg') is not None: d.append(y + edges['yNeg'])
    if edges.get('yPos') is not None: d.append(edges['yPos'] - y)
    return min(d) if d else math.inf


def n_rk_s(As, fuk):                       # EN 1992-4, (7.1)
    return As * fuk


def n_rk_p(fck, cracked, d, dh):           # (7.12): NRk,p = k2 · Ah · fck;  k2 = 7.5 (revnet) / 10.5 (urevnet)
    Ah = math.pi / 4 * (dh ** 2 - d ** 2)
    return (7.5 if cracked else 10.5) * Ah * fck


def n_rk_c(anchors, hef, fck, cracked, edges, tight=True):
    """(7.2)–(7.6): NRk,c = N0 · Ac/A0 · ψs · ψre · ψec (ingen excentricitet her)."""
    k1 = 8.9 if cracked else 12.7
    ccr, scr = 1.5 * hef, 3 * hef
    N0 = k1 * math.sqrt(fck) * hef ** 1.5
    Ac = proj_area(anchors, scr, edges)
    A0 = scr ** 2
    c = min(edge_dist(a, edges) for a in anchors)
    psi_s = min(1.0, 0.7 + 0.3 * c / ccr) if math.isfinite(c) else 1.0
    psi_re = min(1.0, 0.5 + hef / 200) if tight else 1.0
    return N0 * Ac / A0 * psi_s * psi_re


def v_rk_s(As, fuk, ductile, n_anchors):    # (7.37): VRk,s = k7 · k6 · As · fuk;  k6 = 0,6 (fuk ≤ 500) / 0,5
    k6 = 0.6 if fuk <= 500 else 0.5
    k7 = 1.0 if (ductile or n_anchors == 1) else 0.8
    return k7 * k6 * As * fuk


def v_rk_cp(anchors, hef, fck, cracked, edges):  # (7.39): VRk,cp = k8 · NRk,c ;  k8 = 1 (hef < 60) / 2
    return (1.0 if hef < 60 else 2.0) * n_rk_c(anchors, hef, fck, cracked, edges)


def v_rk_c(anchors, d, hef, fck, cracked, h, c1, edge_axis_coords, alpha_deg=0.0):
    """(7.42)–(7.49) for række af bolte parallelt med kanten (samme c1) og last vinkelret på kanten (α = 0)."""
    dnom = d
    lf = min(hef, 12 * dnom) if dnom <= 24 else min(hef, max(8 * dnom, 300))
    alpha = 0.1 * math.sqrt(lf / c1)
    beta = 0.1 * (dnom / c1) ** 0.2
    k9 = 1.7 if cracked else 2.4
    V0 = k9 * dnom ** alpha * lf ** beta * math.sqrt(fck) * c1 ** 1.5
    A0 = 4.5 * c1 ** 2
    width = union_len(edge_axis_coords, 1.5 * c1)
    Ac = width * min(1.5 * c1, h)
    c2 = min(min(edge_axis_coords) - (-math.inf), math.inf)  # ingen sidekanter i disse tilfælde → ψs,V = 1
    psi_s = 1.0
    psi_h = max(1.0, math.sqrt(1.5 * c1 / h))
    a = math.radians(alpha_deg)
    psi_a = max(1.0, math.sqrt(1 / (math.cos(a) ** 2 + (0.5 * math.sin(a)) ** 2)))
    return V0 * Ac / A0 * psi_s * psi_h * psi_a


def n_rk_cb(anchors, d, dh, fck, cracked, h, hef, edges):
    """(7.2.1.8) udsprængning, kun hvis c1 <= 0,5·hef. Returnerer None hvis ikke relevant.
    N0 = k5·c1·√Ah·√fck (k5 = 8,7 revnet / 12,2 urevnet); A0 = (4c1)²; ψs = 0,7+0,3·c2/(2c1); ψg = max(1, √n + (1-√n)·s2/(4c1)).
    Reference dækker kun bolte parallelt med én fri kant (xNeg) og uden ekscentricitet."""
    Ah = math.pi / 4 * (dh ** 2 - d ** 2)
    c1 = min(a[0] + edges['xNeg'] for a in anchors)
    if c1 > 0.5 * hef: return None
    k5 = 8.7 if cracked else 12.2
    N0 = k5 * c1 * math.sqrt(Ah) * math.sqrt(fck)
    ys = sorted(a[1] for a in anchors)
    n, s2 = len(ys), max([b - a for a, b in zip(ys, ys[1:])] or [0])
    L = union_len(ys, 2 * c1)
    Hb = 2 * c1 + min(2 * c1, max(0, h - hef))
    psi_g = max(1.0, math.sqrt(n) + (1 - math.sqrt(n)) * s2 / (4 * c1))
    return N0 * (L * Hb) / (4 * c1) ** 2 * 1.0 * psi_g


def case(name, d, hef, dh, th, As, fuk, fyk, ductile, klasse, cracked, h, edges, anchors, loads, beskrivelse):
    fck = FCK[klasse]
    e = {}
    ts = [a for a in anchors]
    e['N_s'] = n_rk_s(As, fuk)
    e['N_p'] = n_rk_p(fck, cracked, d, dh)
    e['N_c'] = n_rk_c(ts, hef, fck, cracked, edges)
    e['V_s'] = v_rk_s(As, fuk, ductile, len(anchors))
    e['V_cp'] = v_rk_cp(ts, hef, fck, cracked, edges)
    if edges.get('xNeg') is not None and not any(edges.get(k) is not None for k in ('xPos','yNeg','yPos')):
        v = n_rk_cb(anchors, d, dh, fck, cracked, h, hef, edges)
        if v is not None: e['N_cb'] = v
    free = [k for k in ('xNeg', 'xPos', 'yNeg', 'yPos') if edges.get(k) is not None]
    if free and loads.get('Vedge'):
        k = loads['Vedge']
        c1 = min(edge_dist(a, edges) for a in anchors)
        coords = [a[1] if k in ('xNeg', 'xPos') else a[0] for a in anchors]
        e['V_c'] = v_rk_c(anchors, d, hef, fck, cracked, h, c1, coords)
    pub = PUBLICERET.get(name)
    return {**({'publiceret': pub} if pub else {}), 'navn': name, 'beskrivelse': beskrivelse, 'd': d, 'hef': hef, 'dh': dh, 'th': th, 'As': As, 'fuk': fuk, 'fyk': fyk,
            'duktil': ductile, 'klasse': klasse, 'revnet': cracked, 'h': h, 'kanter': edges, 'ankre': anchors, 'last': loads, 'forventet': e}


# Værdier trykt i en offentlig Hilti PROFIS Engineering-rapport (3.0.87, 09.08.2023, indstøbt hovedbolt M16 5.8, hef 120, C20/25 revnet):
# https://files-ask.hilti.com/original/cf/cfip8ziqve.pdf  – N0Rk,c = 52,321 kN og V0Rk,c = 24,305 kN (c1 = 150 mm). Enhed: N.
PUBLICERET = {
    'P1 PROFIS-rapport: N0Rk,c': {'kilde': 'Hilti PROFIS Engineering 3.0.87 (2023-08-09), CastInPlace M16, hef 120, C20/25 revnet', 'N_c': 52321, 'tolerance': 1e-5},
    'P2 PROFIS-rapport: V0Rk,c': {'kilde': 'Hilti PROFIS Engineering 3.0.87 (2023-08-09), CastInPlace M16, hef 120, C20/25 revnet, c1 = 150', 'V_c': 24305, 'tolerance': 1e-5},
}

NOEDGE = {'xNeg': None, 'xPos': None, 'yNeg': None, 'yPos': None}


def edge(**kw):
    return {**NOEDGE, **kw}


CASES = [
    case('A1 enkeltbolt, revnet, ingen kanter', 16, 150, 29, 13, 157, 400, 240, True, 'C30/37', True, 400, NOEDGE, [(0, 0)],
         {'N': 50000, 'Vx': 20000}, 'Én bolt M16 4.6, hef 150, C30/37, revnet. Ac = A0 = (3·150)² → NRk,c = 8,9·√30·150^1,5.'),
    case('A2 enkeltbolt, urevnet', 16, 150, 29, 13, 157, 400, 240, True, 'C30/37', False, 400, NOEDGE, [(0, 0)],
         {'N': 50000, 'Vx': 20000}, 'Som A1 men urevnet (k1 = 12,7; k2 = 10,5).'),
    case('A3 to bolte s=150, ren træk', 16, 150, 29, 13, 157, 400, 240, True, 'C30/37', True, 400, NOEDGE, [(-75, 0), (75, 0)],
         {'N': 100000, 'Vx': 40000}, 'To bolte i række, s = 150 < scr = 450 → Ac = (150 + 450)·450.'),
    case('A4 fire bolte 150×150', 20, 200, 36, 16, 245, 800, 640, True, 'C40/50', True, 500, NOEDGE, [(-75, -75), (75, -75), (-75, 75), (75, 75)],
         {'N': 200000, 'Vx': 80000}, 'Rektangulær gruppe M20 8.8, hef 200: Ac = (150+600)².'),
    case('A5 enkeltbolt nær kant (træk)', 16, 150, 29, 13, 157, 400, 240, True, 'C30/37', True, 400, edge(xNeg=100), [(0, 0)],
         {'N': 50000, 'Vx': 20000}, 'Kant c = 100 mm på xNeg: Ac = (100 + 225)·450 (kvadratet er klippet), ψs = 0,7 + 0,3·100/225.'),
    case('A6 enkeltbolt nær kant (forskydning mod kant)', 16, 150, 29, 13, 157, 400, 240, True, 'C30/37', True, 300, edge(xNeg=100), [(0, 0)],
         {'N': 0, 'Vx': -20000, 'Vedge': 'xNeg'}, 'Forskydning mod kant, c1 = 100, h = 300: V0Rk,c, Ac,V = 3·c1·1,5·c1, ψh = 1.'),
    case('A7 to bolte langs kant, forskydning mod kant', 16, 150, 29, 13, 157, 400, 240, True, 'C30/37', True, 300, edge(xNeg=120), [(0, -80), (0, 80)],
         {'N': 0, 'Vx': -40000, 'Vedge': 'xNeg'}, 'To bolte parallelt med kanten, c1 = 120, s = 160 < 3c1: bredde = 160 + 3·120.'),
    case('A8 lav hef (k8 = 1)', 12, 50, 22, 10, 84.3, 500, 300, True, 'C25/30', True, 200, NOEDGE, [(0, 0)],
         {'N': 20000, 'Vx': 10000}, 'hef = 50 < 60 → k8 = 1 (VRk,cp = NRk,c).'),
    case('A9 ikke-duktilt stål, to bolte', 16, 150, 29, 13, 157, 600, 480, False, 'C30/37', True, 400, NOEDGE, [(-100, 0), (100, 0)],
         {'N': 40000, 'Vx': 30000}, 'Ikke-duktil (6.8): k7 = 0,8 for gruppe; fuk = 600 > 500 → k6 = 0,5.'),
    case('A10 tynd plade, ψh > 1', 16, 150, 29, 13, 157, 400, 240, True, 'C30/37', True, 120, edge(xNeg=200), [(0, 0)],
         {'N': 0, 'Vx': -10000, 'Vedge': 'xNeg'}, 'h = 120 < 1,5·c1 = 300 → Ac,V = 3c1·h og ψh = √(300/120).'),
    case('B1 sidebrud, enkeltbolt', 16, 200, 29, 13, 157, 400, 240, True, 'C30/37', True, 400, edge(xNeg=70), [(0, 0)],
         {'N': 50000}, 'c1 = 70 <= 0,5·hef = 100: N0 = 8,7·c1·√Ah·√fck, Ac = 4c1·(2c1 + 2c1).'),
    case('B2 sidebrud, to bolte s=100', 16, 200, 29, 13, 157, 400, 240, True, 'C30/37', True, 400, edge(xNeg=60), [(0, -50), (0, 50)],
         {'N': 80000}, 'Gruppe: s2 = 100 < 4c1 = 240 → ψg,N = √2 + (1-√2)·100/240.'),
    case('B3 sidebrud, tynd plade, urevnet', 16, 200, 29, 13, 157, 400, 240, True, 'C30/37', False, 250, edge(xNeg=80), [(0, 0)],
         {'N': 50000}, 'h - hef = 50 < 2c1 → Hb = 2c1 + 50. k5 = 12,2.'),
    case('P1 PROFIS-rapport: N0Rk,c', 16, 120, 29, 13, 157, 500, 300, True, 'C20/25', True, 1000, NOEDGE, [(0, 0)],
         {'N': 20000}, 'Enkeltbolt M16, hef 120, C20/25 revnet uden kanter: N0Rk,c = 8,9·√20·120^1,5 (offentlig PROFIS-rapport).'),
    case('P2 PROFIS-rapport: V0Rk,c', 16, 120, 29, 13, 157, 500, 300, True, 'C20/25', True, 1000, edge(xNeg=150), [(0, 0)],
         {'N': 0, 'Vx': -10000, 'Vedge': 'xNeg'}, 'Enkeltbolt M16, hef 120, c1 = 150, tyk plade (Ac,V = A0c,V, ψh = 1): V0Rk,c fra offentlig PROFIS-rapport.'),
]

if __name__ == '__main__':
    out = pathlib.Path(__file__).with_name('expected.json')
    out.write_text(json.dumps(CASES, indent=1, ensure_ascii=False))
    for c in CASES:
        print(c['navn'], {k: round(v, 1) for k, v in c['forventet'].items()})
