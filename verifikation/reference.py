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


def psi_s_n(c, ccr):                         # (7.4)-form: ψs = 0,7 + 0,3·c/ccr ≤ 1
    return min(1.0, 0.7 + 0.3 * c / ccr) if math.isfinite(c) else 1.0


def n_rk_sp(anchors, d, dh, hef, fck, cracked, h, edges, ccr_sp, hmin, tight=True):
    """7.2.1.7, (7.23)-(7.24): NRk,sp = N0 · Ac,N/A0c,N · ψs,N · ψre,N · ψec,N · ψh,sp
    med N0 = min(NRk,p ; N0Rk,c), scr,sp = 2·ccr,sp og ψh,sp = (h/hmin)^(2/3) ≤ max(1; ((hef + 1,5·c1)/hmin)^(2/3)) ≤ 2."""
    scr = 2 * ccr_sp
    n0c = (8.9 if cracked else 12.7) * math.sqrt(fck) * hef ** 1.5
    n0 = min(n_rk_p(fck, cracked, d, dh), n0c)
    Ac = proj_area(anchors, scr, edges)
    c = min(edge_dist(a, edges) for a in anchors)
    psi_h = min((h / hmin) ** (2 / 3), max(1.0, ((hef + 1.5 * c) / hmin) ** (2 / 3)), 2.0)
    psi_re = min(1.0, 0.5 + hef / 200) if tight else 1.0
    return n0 * Ac / scr ** 2 * psi_s_n(c, ccr_sp) * psi_re * psi_h


def v_rk_c_enkelt(a, d, hef, fck, cracked, h, edges, Vx, Vy):
    """7.2.2.5 for ÉN bolt og alle frie kanter: for hver kant regnes komposanterne mod kanten (kun hvis den peger mod kanten)
    og parallelt med den; α = vinklen fra normalen (90° for ren parallel last). Hjørne (c2 < 1,5c1), smalt element (
    c'1 = max(c2,max/1,5; h/1,5) når begge c2 og h < 1,5c1) og tynd plade (ψh). Returnerer VRk,c for den mest udnyttede kant."""
    dnom = d
    lf = min(hef, 12 * dnom) if dnom <= 24 else min(hef, max(8 * dnom, 300))
    k9 = 1.7 if cracked else 2.4
    x, y = a
    kanter = {  # navn: (afstand c1, normal mod kanten, afstande til de to sidekanter)
        'xNeg': (lambda: (x + edges['xNeg'], (-1, 0), ('yNeg', 'yPos'))),
        'xPos': (lambda: (edges['xPos'] - x, (1, 0), ('yNeg', 'yPos'))),
        'yNeg': (lambda: (y + edges['yNeg'], (0, -1), ('xNeg', 'xPos'))),
        'yPos': (lambda: (edges['yPos'] - y, (0, 1), ('xNeg', 'xPos'))),
    }
    def side(k):
        if edges.get(k) is None: return math.inf
        return {'xNeg': x + edges['xNeg'], 'xPos': edges['xPos'] - x if edges.get('xPos') is not None else math.inf,
                'yNeg': y + edges['yNeg'], 'yPos': edges['yPos'] - y if edges.get('yPos') is not None else math.inf}[k]
    bedst = None
    for k, f in kanter.items():
        if edges.get(k) is None: continue
        c1, n, sider = f()
        if c1 >= max(10 * hef, 60 * dnom): continue
        vperp = Vx * n[0] + Vy * n[1]
        vpar = abs(-Vx * n[1] + Vy * n[0])
        vperp = max(0.0, vperp)
        VEd = math.hypot(vperp, vpar)
        if VEd < 1e-9: continue
        aV = math.atan2(vpar, vperp) if vperp > 0 else math.pi / 2
        c2a, c2b = side(sider[0]), side(sider[1])
        if c2a < 1.5 * c1 and c2b < 1.5 * c1 and h < 1.5 * c1:
            c1 = min(c1, max(max(c2a, c2b) / 1.5, h / 1.5))
        alpha = 0.1 * math.sqrt(lf / c1)
        beta = 0.1 * (dnom / c1) ** 0.2
        V0 = k9 * dnom ** alpha * lf ** beta * math.sqrt(fck) * c1 ** 1.5
        Ac = (min(1.5 * c1, c2a) + min(1.5 * c1, c2b)) * min(1.5 * c1, h)
        A0 = 4.5 * c1 ** 2
        psi_s = min(1.0, 0.7 + 0.3 * min(c2a, c2b) / (1.5 * c1))
        psi_h = max(1.0, math.sqrt(1.5 * c1 / h))
        psi_a = max(1.0, math.sqrt(1 / (math.cos(aV) ** 2 + (0.5 * math.sin(aV)) ** 2)))
        VRk = V0 * Ac / A0 * psi_s * psi_h * psi_a
        if bedst is None or VEd / VRk > bedst[0]: bedst = (VEd / VRk, VRk)
    return bedst[1]


def n_rk_p_bond(anchors, d, hef, fck, cracked, edges, tau_cr, tau_ucr, psi_c, k_cr, k_ucr, psi_sus=1.0, tight=True):
    """7.2.1.6, (7.13)-(7.20): NRk,p = N0Rk,p · Ap,N/A0p,N · ψg,Np · ψs,Np · ψre,N · ψec,Np (ingen excentricitet).
    N0Rk,p = ψsus·τRk·π·d·hef; τRk = τRk,(C20/25)·ψc; scr,Np = 7,3·d·√(ψsus·τRk,ucr) ≤ 3hef (τRk,ucr for C20/25);
    ψ0g = √n − (√n − 1)·(τRk/τRk,c)^1,5 ≥ 1, τRk,c = k3/(π·d)·√(hef·fck); ψg = ψ0g − √(s/scr)·(ψ0g − 1) ≥ 1."""
    tau = (tau_cr if cracked else tau_ucr) * psi_c
    N0 = psi_sus * tau * math.pi * d * hef
    scr = min(7.3 * d * math.sqrt(psi_sus * tau_ucr), 3 * hef)
    Ap = proj_area(anchors, scr, edges)
    n = len(anchors)
    if n > 1:
        tau_c = (k_cr if cracked else k_ucr) / (math.pi * d) * math.sqrt(hef * fck)
        psi0g = max(1.0, math.sqrt(n) - (math.sqrt(n) - 1) * (tau / tau_c) ** 1.5)
        # gennemsnitlig afstand mellem nabobolte (her ensartet)
        s = sum(min(math.hypot(a[0] - b[0], a[1] - b[1]) for b in anchors if b is not a) for a in anchors) / n
        psi_g = max(1.0, psi0g - math.sqrt(min(s, scr) / scr) * (psi0g - 1))
    else:
        psi_g = 1.0
    c = min(edge_dist(a, edges) for a in anchors)
    psi_re = min(1.0, 0.5 + hef / 200) if tight else 1.0
    return N0 * Ap / scr ** 2 * psi_g * psi_s_n(c, scr / 2) * psi_re


def n_rk_c_bond(anchors, hef, fck, cracked, edges, k_cr, k_ucr, tight=True):
    """(7.2) med produktets k-faktor (ETA): ccr,N = 1,5hef, scr,N = 3hef."""
    N0 = (k_cr if cracked else k_ucr) * math.sqrt(fck) * hef ** 1.5
    Ac = proj_area(anchors, 3 * hef, edges)
    c = min(edge_dist(a, edges) for a in anchors)
    psi_re = min(1.0, 0.5 + hef / 200) if tight else 1.0
    return N0 * Ac / (3 * hef) ** 2 * psi_s_n(c, 1.5 * hef) * psi_re


def ankerarmering_traek(d_anker, hef, fck, ds, n_boejler, fyk, afstand, daeklag, krog, gamma_ct=1.7):
    """7.2.1.9: NRk,re = Σ As,re·fyk,re (2 ben pr. bøjle); NRd,a = Σ l1·π·ds·fbd/α (7.2.1.9, EN 1992-1-1 8.4.2).
    l1 = længden af hvert ben inde i brudkeglen (35° fra overfladen): l1 = hef − r·tan35° − dæklag, r = √(a² + (d/2 + ds/2 + 2)²).
    fbd = 2,25·η1·η2·fctd, fctd = fctk,0,05/γc,træk (DK NA: 1,70), fctk,0,05 = 0,7·0,3·fck^(2/3); α = 1 (ingen kroge med cd > 3ds)."""
    r = math.hypot(afstand, d_anker / 2 + ds / 2 + 2)
    l1 = hef - r * math.tan(math.radians(35)) - daeklag
    As = math.pi / 4 * ds ** 2
    fbd = 2.25 * 1.0 * 1.0 * (0.7 * 0.3 * min(fck, 60) ** (2 / 3)) / gamma_ct
    ben = 2 * n_boejler
    return {'N_re': ben * As * fyk, 'N_a@Rd': ben * l1 * math.pi * ds * fbd, 'l1': l1}


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


def ekstra(name, beskrivelse, model, forventet):
    """Tilfælde med egne inddata (spaltning, kantbrud for enkeltbolt, indlimede anker, ankerarmering)."""
    base = {'d': 16, 'hef': 150, 'dh': 29, 'th': 13, 'As': 157, 'fuk': 400, 'fyk': 240, 'duktil': True, 'klasse': 'C30/37', 'revnet': True,
            'h': 400, 'kanter': NOEDGE, 'ankre': [(0, 0)], 'last': {'N': 0}}
    return {'navn': name, 'beskrivelse': beskrivelse, **base, **model, 'forventet': forventet}


F30 = FCK['C30/37']
PSIC30 = (30 / 20) ** 0.1
CASES += [
    ekstra('S1 spaltning, enkeltbolt nær kant (ccr,sp og hmin fra produkt)', 'c = 150 < ccr,sp = 300 → eftervis; h = 300 ≥ hmin = 230; ψh,sp = min((300/230)^(2/3); max(1; ((150+225)/230)^(2/3)); 2).',
           {'h': 300, 'kanter': edge(xNeg=150), 'ccrSp': 300, 'hmin': 230, 'last': {'N': 30000}},
           {'N_sp': n_rk_sp([(0, 0)], 16, 29, 150, F30, True, 300, edge(xNeg=150), 300, 230)}),
    ekstra('S2 spaltning, to bolte langs kant, tyndt element', 'To bolte s = 200 langs kanten, c = 120, ccr,sp = 250, h = 260, hmin = 250.',
           {'h': 260, 'kanter': edge(xNeg=120), 'ankre': [(0, -100), (0, 100)], 'ccrSp': 250, 'hmin': 250, 'last': {'N': 60000}},
           {'N_sp': n_rk_sp([(0, -100), (0, 100)], 16, 29, 150, F30, True, 260, edge(xNeg=120), 250, 250)}),
    ekstra('E1 kantbrud i hjørne', 'Enkeltbolt c1 = 100 (xNeg) og c2 = 80 (yNeg), last mod xNeg. Begge kanter eftervises (yNeg med parallel last, ψα = 2); den mest udnyttede styrer.',
           {'kanter': edge(xNeg=100, yNeg=80), 'last': {'N': 0, 'Vx': -20000}},
           {'V_c': v_rk_c_enkelt((0, 0), 16, 150, F30, True, 400, edge(xNeg=100, yNeg=80), -20000, 0)}),
    ekstra('E2 kantbrud, smalt og tyndt element (c\'1)', 'Bolt midt i en 200 mm bred bjælke (c2 = 100 til begge sider), h = 120, c1 = 100: c\'1 = max(100/1,5; 120/1,5) = 80.',
           {'h': 120, 'kanter': edge(xNeg=100, yNeg=100, yPos=100), 'last': {'N': 0, 'Vx': -15000}},
           {'V_c': v_rk_c_enkelt((0, 0), 16, 150, F30, True, 120, edge(xNeg=100, yNeg=100, yPos=100), -15000, 0)}),
    ekstra('E3 kantbrud, skrå last (α = 30°)', 'Én kant (xNeg, c1 = 120); last 20 kN mod kanten 30° fra normalen: ψα,V = √(1/(cos²30° + 0,25·sin²30°)).',
           {'kanter': edge(xNeg=120), 'last': {'N': 0, 'Vx': -20000 * math.cos(math.radians(30)), 'Vy': 20000 * math.sin(math.radians(30))}},
           {'V_c': v_rk_c_enkelt((0, 0), 16, 150, F30, True, 400, edge(xNeg=120), -20000 * math.cos(math.radians(30)), 20000 * math.sin(math.radians(30)))}),
    ekstra('I1 indlimet enkeltanker nær kant (HY 200 V3, M16, revnet)', 'τRk,cr = 9,5·ψc (C30/37), hef = 125, c = 100: NRk,p med scr,Np = min(7,3·d·√τRk,ucr; 3hef) og NRk,c med kcr,N = 7,7.',
           {'type': 'indlimet', 'hef': 125, 'kanter': edge(xNeg=100), 'tauRkCr': 9.5, 'tauRkUcr': 18, 'psiC': PSIC30, 'kcrN': 7.7, 'kucrN': 11, 'psi0Sus': 0.8, 'last': {'N': 30000}},
           {'N_p': n_rk_p_bond([(0, 0)], 16, 125, F30, True, edge(xNeg=100), 9.5, 18, PSIC30, 7.7, 11),
            'N_c': n_rk_c_bond([(0, 0)], 125, F30, True, edge(xNeg=100), 7.7, 11)}),
    ekstra('I2 indlimet gruppe, urevnet, ψg,Np > 1', 'To anker s = 150, τRk,ucr = 8 (lav vedhæftning) → ψ0g,Np = √2 − (√2−1)(τRk/τRk,c)^1,5 > 1 og ψg,Np = ψ0g − √(s/scr)(ψ0g − 1).',
           {'type': 'indlimet', 'hef': 125, 'revnet': False, 'ankre': [(-75, 0), (75, 0)], 'tauRkCr': 5, 'tauRkUcr': 8, 'psiC': PSIC30, 'kcrN': 7.7, 'kucrN': 11, 'psi0Sus': 0.8, 'last': {'N': 40000}},
           {'N_p': n_rk_p_bond([(-75, 0), (75, 0)], 16, 125, F30, False, NOEDGE, 5, 8, PSIC30, 7.7, 11)}),
]
_arm = ankerarmering_traek(20, 200, F30, 12, 1, 500, 50, 40, True)
CASES += [
    ekstra('R1 ankerarmering i træk, én bøjle', 'M20, hef 200, Ø12-bøjle (2 ben) 50 mm fra ankeret, dæklag 40: l1 = 200 − r·tan35° − 40; NRk,re = 2·113·500; NRd,a = 2·l1·π·12·fbd (γc,træk = 1,70).',
           {'d': 20, 'dh': 36, 'th': 16, 'As': 245, 'fuk': 800, 'fyk': 640, 'hef': 200, 'h': 500,
            'armT': {'aktiv': True, 'diameter': 12, 'antalBoejler': 1, 'fyk': 500, 'afstand': 50, 'daeklagTop': 40, 'krog': True, 'eta1': 1, 'cd': None, 'foering': 'stoed', 'forankringsdybde': None, 'planAfstand': None},
            'last': {'N': 60000}},
           {'N_re': _arm['N_re'], 'N_a@Rd': _arm['N_a@Rd']}),
]

if __name__ == '__main__':
    out = pathlib.Path(__file__).with_name('expected.json')
    out.write_text(json.dumps(CASES, indent=1, ensure_ascii=False))
    for c in CASES:
        print(c['navn'], {k: round(v, 1) for k, v in c['forventet'].items()})
