"""The Peru hex map: grid, land/water, Andean relief, biogeographic cover, 25 regions, 196 provinces, rivers.

Saves interim "_world" so all other builders drop their data onto the exact same hex grid.
"""

from __future__ import annotations

import math
from collections import Counter

from ..core.geo import MapProjection, Shape, ShapeIndex
from ..core.hexgrid import HexGrid
from ..core.store import load_interim, save_interim, write_web

REQUIRES = ["peru_boundaries", "natural_earth", "etopo"]
PRODUCES = ["_world", "world.json"]

HEX_RADIUS_KM = 12.0
MARGIN_KM = 140.0

WATER, FOREIGN = -1, -2
LAND, OCEAN, COAST, LAKE = range(4)
TIDAL_SEA_SHARE = 0.5
COAST_DEPTH_M = -200

WATER_TABLE = [
    {"id": LAND, "name": "Tierra", "rule": "Mayoría de 7 puntos de muestreo dentro de los límites del Perú o países vecinos."},
    {"id": OCEAN, "name": "Océano Pacífico", "color": "#1b4266", "rule": "Mar más profundo que 200 m (Fosa de Perú-Chile) y sin colindar con tierra."},
    {"id": COAST, "name": "Mar costero", "color": "#2d6d97", "rule": "Mar adyacente a tierra o menos profundo que 200 m (ETOPO1)."},
    {"id": LAKE, "name": "Lago", "color": "#3a80b0", "rule": "Lago Titicaca y cuerpos de agua continentales (Natural Earth 1:50m)."},
]

WATER_NOTE = (
    "Los polígonos departamentales de la PNDA y los límites de países vecinos y lagos de Natural Earth 1:50m "
    "se concilian sobre una malla hexagonal de 12 km de radio. La profundidad marina proviene de ETOPO1."
)

FLAT, HILLS, MOUNTAINS, PEAKS = range(4)
LAND_MIN_ALT_M = -100
RELIEF_TABLE = [
    {"id": FLAT, "name": "Llano", "rule": "Desviación estándar de elevación < 90 m y elevación media < 2,600 m."},
    {"id": HILLS, "name": "Colinas / Piedemonte", "rule": "Desviación estándar ≥ 90 m."},
    {"id": MOUNTAINS, "name": "Cordillera", "rule": "Desviación estándar ≥ 280 m o elevación media ≥ 2,800 m."},
    {"id": PEAKS, "name": "Altas cumbres", "rule": "Elevación media ≥ 4,100 m (Andes altos y nevados)."},
]
RELIEF_NOTE = (
    "Calculado con muestras ETOPO1 (~3.7 km) dentro de cada hexágono. Los hexágonos de agua son siempre llanos."
)

COVER = [
    (1, "forest_deciduous", "Selva alta / Yunga", "#4f7a35", [41], "Bosque montano y selva alta en la vertiente oriental andina (1,000–2,800 m)."),
    (2, "forest_evergreen", "Selva amazónica", "#2f5a3a", [42], "Bosque húmedo tropical de la llanura amazónica (< 1,000 m, vertiente oriental)."),
    (3, "forest_mixed", "Bosque seco / mixto", "#43703f", [43], "Bosque seco ecuatorial (norte) y transición bosque-sierra."),
    (4, "scrub", "Matorral y desierto costero", "#c9b07a", [52], "Vertiente occidental árida, lomas y matorral andino."),
    (5, "grassland", "Puna y pajonal andino", "#a9b35a", [71], "Altiplano y puna altoandina (3,500–4,500 m)."),
    (6, "pasture", "Pastos altoandinos", "#8fb04e", [81], "Pastos naturales y ganadería andina."),
    (7, "cropland", "Valles agrícolas", "#c2b84e", [82], "Valles interandinos y oasis agrícolas costeros."),
    (8, "wetland", "Humedal amazónico", "#4f8a6e", [90], "Aguajales y planicies inundables amazónicas (Loreto / Ucayali)."),
    (9, "urban", "Urbano", "#8a8378", [24], "Núcleos metropolitanos principales del Perú."),
    (10, "barren", "Desierto / roquedal", "#bfae95", [31], "Desierto costero hiperárido y zonas rocosas de alta montaña."),
    (11, "ice", "Nevados y glaciares", "#e8eef2", [12], "Cordilleras nevadas (> 4,700 m)."),
]
COVER_NOTE = (
    "Clasificación biogeográfica por piso altitudinal (ETOPO1: regiones naturales de Pulgar Vidal — Costa, "
    "Yunga, Quechua, Suni, Puna, Janca, Selva Alta y Selva Baja) y vertiente hidrográfica."
)

PCT_KEYS = ("forest", "crop", "pasture", "grass", "shrub", "wetland", "developed")

# Approximate Andean continental divide longitude by latitude (Peru)
def _divide_lon(lat: float) -> float:
    # Runs from ~(-79.3, -4.5) in Piura/Cajamarca to ~(-70.2, -17.5) in Tacna/Puno
    t = max(0.0, min(1.0, (-lat - 4.0) / 14.0))
    return -79.4 + t * 9.0


# Major metro centers (lon, lat) for urban land-cover hex tagging
MAJOR_METROS = [
    (-77.04, -12.05, 22.0),  # Lima-Callao
    (-71.54, -16.41, 12.0),  # Arequipa
    (-79.03, -8.11, 12.0),   # Trujillo
    (-79.84, -6.77, 10.0),   # Chiclayo
    (-80.63, -5.19, 10.0),   # Piura
    (-75.20, -12.07, 10.0),  # Huancayo
    (-71.97, -13.53, 10.0),  # Cusco
    (-73.25, -3.74, 10.0),   # Iquitos
]


def classify_relief(mean: float, std: float) -> int:
    if mean >= 4100:
        return PEAKS
    if std >= 280 or mean >= 2800:
        return MOUNTAINS
    if std >= 90:
        return HILLS
    return FLAT


def classify_peru_cover(lon: float, lat: float, elev_m: float, elev_max_m: float, dep_fips: str) -> tuple[int, dict[str, int]]:
    """Map (lon, lat, elev) to Peru biogeographic cover id and land-cover percentages."""
    # Check major urban cores
    for mlon, mlat, rad_km in MAJOR_METROS:
        d_km = math.hypot((lon - mlon) * 111.0 * math.cos(math.radians(lat)), (lat - mlat) * 110.6)
        if d_km <= rad_km:
            return 9, {"forest": 5, "crop": 15, "pasture": 5, "grass": 10, "shrub": 15, "wetland": 0, "developed": 50}

    div = _divide_lon(lat)
    east = lon > div

    # Glacial peaks
    if elev_m >= 4750 or elev_max_m >= 5200:
        return 11, {"forest": 0, "crop": 0, "pasture": 5, "grass": 20, "shrub": 10, "wetland": 0, "developed": 0}

    # Amazon basin (Selva Baja / Omagua)
    if east and elev_m < 650:
        # Loreto / Pacaya Samiria floodplains
        if dep_fips == "16" and -5.8 <= lat <= -3.5 and -75.8 <= lon <= -73.0 and elev_m < 140:
            return 8, {"forest": 38, "crop": 2, "pasture": 2, "grass": 3, "shrub": 2, "wetland": 52, "developed": 1}
        return 2, {"forest": 88, "crop": 3, "pasture": 2, "grass": 2, "shrub": 1, "wetland": 3, "developed": 1}

    # Selva Alta / Rupa-Rupa
    if east and elev_m < 2300:
        return 1, {"forest": 72, "crop": 10, "pasture": 6, "grass": 5, "shrub": 5, "wetland": 1, "developed": 1}

    # Puna / Altiplano
    if elev_m >= 3600:
        if dep_fips in ("21", "08", "05", "09", "12", "19"):
            return 5, {"forest": 2, "crop": 8, "pasture": 25, "grass": 55, "shrub": 8, "wetland": 1, "developed": 1}
        return 5, {"forest": 1, "crop": 5, "pasture": 18, "grass": 56, "shrub": 18, "wetland": 1, "developed": 1}

    # Inter-Andean valleys (Quechua / Suni)
    if elev_m >= 1800:
        if dep_fips in ("06", "12", "08", "03", "05", "10", "02"):
            return 7, {"forest": 12, "crop": 42, "pasture": 20, "grass": 15, "shrub": 9, "wetland": 0, "developed": 2}
        return 6, {"forest": 8, "crop": 25, "pasture": 35, "grass": 18, "shrub": 12, "wetland": 0, "developed": 2}

    # Northern equatorial dry forest (Tumbes, Piura, Lambayeque interior)
    if not east and lat > -6.8 and elev_m < 1400:
        if dep_fips == "24" or lon > -80.4:
            return 3, {"forest": 45, "crop": 22, "pasture": 8, "grass": 8, "shrub": 15, "wetland": 0, "developed": 2}
        return 4, {"forest": 12, "crop": 18, "pasture": 5, "grass": 8, "shrub": 54, "wetland": 0, "developed": 3}

    # Coastal valleys & desert (Costa / Chala)
    if not east and elev_m < 1800:
        if dep_fips in ("14", "13", "11") and elev_m < 450:
            return 7, {"forest": 4, "crop": 46, "pasture": 4, "grass": 5, "shrub": 35, "wetland": 0, "developed": 6}
        if elev_m < 500:
            return 10, {"forest": 1, "crop": 8, "pasture": 2, "grass": 5, "shrub": 28, "wetland": 0, "developed": 3}
        return 4, {"forest": 3, "crop": 12, "pasture": 5, "grass": 12, "shrub": 65, "wetland": 0, "developed": 3}

    return 4, {"forest": 15, "crop": 15, "pasture": 15, "grass": 20, "shrub": 33, "wetland": 0, "developed": 2}


def simplify(points: list[tuple[float, float]], min_km: float) -> list[tuple[float, float]]:
    out = [points[0]]
    for p in points[1:-1]:
        if math.dist(p, out[-1]) >= min_km:
            out.append(p)
    out.append(points[-1])
    return out


def clip_segment(p, q, w, h):
    (x0, y0), (x1, y1) = p, q
    dx, dy = x1 - x0, y1 - y0
    t0, t1 = 0.0, 1.0
    for pk, qk in ((-dx, x0), (dx, w - x0), (-dy, y0), (dy, h - y0)):
        if pk == 0:
            if qk < 0:
                return None
            continue
        t = qk / pk
        if pk < 0:
            t0 = max(t0, t)
        else:
            t1 = min(t1, t)
        if t0 > t1:
            return None
    return (x0 + t0 * dx, y0 + t0 * dy), (x0 + t1 * dx, y0 + t1 * dy)


def clip_polyline(pts, w, h) -> list[list[tuple[float, float]]]:
    pieces, cur = [], []
    for p, q in zip(pts, pts[1:]):
        seg = clip_segment(p, q, w, h)
        if seg is None:
            if len(cur) >= 2:
                pieces.append(cur)
            cur = []
            continue
        a, b = seg
        if cur and math.dist(cur[-1], a) < 1e-9:
            cur.append(b)
        else:
            if len(cur) >= 2:
                pieces.append(cur)
            cur = [a, b]
        if b != q:
            pieces.append(cur)
            cur = []
    if len(cur) >= 2:
        pieces.append(cur)
    return pieces


def join_lines(lines: list[list[tuple[float, float]]], tol: float = 0.5) -> list[list[tuple[float, float]]]:
    lines = [list(l) for l in lines]
    joined = True
    while joined:
        joined = False
        for a in range(len(lines)):
            for b in range(len(lines)):
                if a == b or not lines[a] or not lines[b]:
                    continue
                la, lb = lines[a], lines[b]
                for la2, lb2 in ((la, lb), (la, lb[::-1]), (la[::-1], lb), (la[::-1], lb[::-1])):
                    if math.dist(la2[-1], lb2[0]) <= tol:
                        lines[a] = la2 + lb2[1:]
                        lines[b] = []
                        joined = True
                        break
        lines = [l for l in lines if l]
    return lines


def majority(values: list, centre):
    counts = Counter(values)
    top = max(counts.values())
    tied = [v for v in counts if counts[v] == top]
    return centre if centre in tied else tied[0]


def build() -> None:
    bounds = load_interim("peru_boundaries")
    ne = load_interim("natural_earth")
    etopo = load_interim("etopo")

    states = sorted(bounds["states"], key=lambda s: s["name"])
    counties = sorted(bounds["counties"], key=lambda c: c["geoid"])

    probe = MapProjection(0, 0, 0)
    xs, ys = [], []
    for s in states:
        for ring in s["rings"]:
            for lon, lat in ring:
                x, y = probe._albers(lon, lat)
                xs.append(x)
                ys.append(y)
    proj = MapProjection(min(xs), max(ys), MARGIN_KM)
    width = max(xs) - min(xs) + 2 * MARGIN_KM
    height = max(ys) - min(ys) + 2 * MARGIN_KM
    grid = HexGrid.covering(width, height, HEX_RADIUS_KM)
    print(f"    malla {grid.cols}×{grid.rows} = {grid.size} hexágonos de {HEX_RADIUS_KM:g} km")

    def shape(rings):
        return Shape([[proj(lon, lat) for lon, lat in r] for r in rings])

    state_idx = ShapeIndex([shape(s["rings"]) for s in states], cell_km=50)
    county_idx = ShapeIndex([shape(c["rings"]) for c in counties], cell_km=30)
    foreign_idx = ShapeIndex([shape(c["rings"]) for c in ne["countries"]], cell_km=120)
    lake_idx = ShapeIndex([shape(l["rings"]) for l in ne["lakes"]], cell_km=50)

    # Elevation stats per hex
    stats_all = [[0, 0.0, 0.0] for _ in range(grid.size)]
    stats_land = [[0, 0.0, 0.0] for _ in range(grid.size)]
    samples_land: list[list[int]] = [[] for _ in range(grid.size)]
    below_sea = [0] * grid.size
    below_sum = [0.0] * grid.size
    for lat, lon, alt in zip(etopo["lat"], etopo["lon"], etopo["alt"]):
        i = grid.cell_at(*proj(lon, lat))
        if i < 0:
            continue
        if alt < 0:
            below_sea[i] += 1
            below_sum[i] += alt
        for st in (stats_all[i], stats_land[i]) if alt >= LAND_MIN_ALT_M else (stats_all[i],):
            st[0] += 1
            st[1] += alt
            st[2] += alt * alt
        if alt >= LAND_MIN_ALT_M:
            samples_land[i].append(alt)

    def sea_share(i):
        return below_sea[i] / stats_all[i][0] if stats_all[i][0] else 0.0

    def mean_std(st):
        n, s1, s2 = st
        if not n:
            return None, None
        m = s1 / n
        return m, math.sqrt(max(0.0, s2 / n - m * m))

    # Ownership: 7 sample points per hex
    offsets = [(0.0, 0.0)] + [
        (0.6 * HEX_RADIUS_KM * math.cos(math.radians(60 * k - 30)), 0.6 * HEX_RADIUS_KM * math.sin(math.radians(60 * k - 30)))
        for k in range(6)
    ]
    owner = [WATER] * grid.size
    water = [OCEAN] * grid.size
    for i in range(grid.size):
        cx, cy = grid.center(*grid.col_row(i))
        kinds = []
        for dx, dy in offsets:
            x, y = cx + dx, cy + dy
            if lake_idx.locate(x, y) >= 0:
                kinds.append("lake")
            elif (s := state_idx.locate(x, y)) >= 0:
                kinds.append(s)
            elif foreign_idx.locate(x, y) >= 0:
                kinds.append(FOREIGN)
            else:
                kinds.append("sea")
        land = [k for k in kinds if not isinstance(k, str)]
        m_all, _ = mean_std(stats_all[i])
        tidal = kinds[0] == "sea" and m_all is not None and (m_all <= 0 or sea_share(i) >= TIDAL_SEA_SHARE)
        if len(land) * 2 > len(kinds) and not tidal:
            pe = [k for k in land if k >= 0]
            n_foreign = len(land) - len(pe)
            if len(pe) > n_foreign or (len(pe) == n_foreign and kinds[0] != FOREIGN):
                owner[i] = majority(pe, kinds[0])
            else:
                owner[i] = FOREIGN
            water[i] = LAND
        else:
            wet = [k for k in kinds if isinstance(k, str)]
            above_sea = m_all is not None and m_all > 0
            lakeish = "lake" in wet and (above_sea or majority(wet, kinds[0] if kinds[0] in wet else "lake") == "lake")
            water[i] = LAKE if lakeish else OCEAN

    # Sliver fix along borders
    slivers = []
    for i in range(grid.size):
        if water[i] != OCEAN:
            continue
        m, _ = mean_std(stats_all[i])
        land_nb = [owner[j] for j in grid.neighbours(i) if water[j] == LAND]
        border = FOREIGN in land_nb and any(o >= 0 for o in land_nb)
        if m is not None and m > 0 and sea_share(i) < TIDAL_SEA_SHARE and (len(land_nb) >= 4 or border):
            slivers.append((i, Counter(land_nb).most_common(1)[0][0]))
    for i, o in slivers:
        owner[i], water[i] = o, LAND

    # Provinces for Peru cells
    county = [-1] * grid.size
    county_samples: list[list[int]] = [[] for _ in range(grid.size)]
    for i in range(grid.size):
        if owner[i] >= 0:
            cx, cy = grid.center(*grid.col_row(i))
            county_samples[i] = [county_idx.locate(cx + dx, cy + dy) for dx, dy in offsets]
    for i in range(grid.size):
        smp = county_samples[i]
        if smp and max(smp) < 0:
            nb = [k for j in grid.neighbours(i) if owner[j] == owner[i] for k in county_samples[j] if k >= 0]
            if nb:
                smp[0] = Counter(nb).most_common(1)[0][0]
    county_state = [c["state_fips"] for c in counties]
    for i, smp in enumerate(county_samples):
        valid = [k for k in smp if k >= 0]
        if not valid:
            continue
        same = [k for k in valid if county_state[k] == states[owner[i]]["fips"]]
        pool = same or valid
        county[i] = smp[0] if smp[0] in pool else Counter(pool).most_common(1)[0][0]

    # Elevation, water depth, relief
    elev = [0] * grid.size
    relief = [FLAT] * grid.size
    elev_max = [0] * grid.size
    for i in range(grid.size):
        if water[i] == LAND:
            m, sd = mean_std(stats_land[i])
            if m is None:
                m, sd = mean_std(stats_all[i])
                m = None if m is None else max(m, 0.0)
            if m is None:
                continue
            elev[i] = round(m)
            relief[i] = classify_relief(max(m, 0.0), sd)
            if samples_land[i]:
                elev_max[i] = max(0, round(max(samples_land[i])))
        else:
            m, _ = mean_std(stats_all[i])
            if m is None:
                elev[i] = -4000
            elif water[i] != LAKE and below_sea[i]:
                elev[i] = round(below_sum[i] / below_sea[i])
            else:
                elev[i] = min(round(m), 0)
            if water[i] == OCEAN:
                near_land = any(water[j] == LAND for j in grid.neighbours(i))
                water[i] = COAST if near_land or elev[i] > COAST_DEPTH_M else OCEAN

    # Land cover
    cover = [0] * grid.size
    pct = {k: [0] * grid.size for k in PCT_KEYS}
    pe_hexes = 0
    for i in range(grid.size):
        if owner[i] < 0:
            continue
        pe_hexes += 1
        cx, cy = grid.center(*grid.col_row(i))
        lon, lat = proj.inverse(cx, cy)
        cid, pdict = classify_peru_cover(lon, lat, elev[i], elev_max[i], states[owner[i]]["fips"])
        cover[i] = cid
        for k in PCT_KEYS:
            pct[k][i] = pdict[k]
    print(f"    {pe_hexes} hexágonos peruanos de tierra")

    # Rivers
    by_river: dict[tuple, list] = {}
    for r in ne["rivers"]:
        if r["rank"] > 8:
            continue
        line = [proj(lon, lat) for lon, lat in r["line"]]
        parts = clip_polyline(line, width, height)
        by_river.setdefault((r["name"], r["rank"]), []).extend(parts)
    rivers = []
    for (name, rank), parts in by_river.items():
        for piece in join_lines(parts):
            if sum(math.dist(a, b) for a, b in zip(piece, piece[1:])) < 1.0:
                continue
            pts = simplify(piece, 3.0)
            if len(pts) >= 2:
                rivers.append({"name": name, "rank": rank, "pts": [round(v, 1) for p in pts for v in p]})

    cover_table = [{"id": 0, "key": "none", "name": "Ninguno", "rule": "Agua o territorio extranjero."}] + [
        {"id": cid, "key": key, "name": name, "color": color, "nlcd": codes, "rule": rule}
        for cid, key, name, color, codes, rule in COVER
    ]
    tables = {
        "water": WATER_TABLE,
        "relief": RELIEF_TABLE,
        "cover": cover_table,
        "notes": {"water": WATER_NOTE, "relief": RELIEF_NOTE, "cover": COVER_NOTE},
    }
    states_out = [{"fips": s["fips"], "abbr": s["abbr"], "name": s["name"]} for s in states]
    write_web(
        "world.json",
        {
            "version": 2,
            "grid": grid.to_dict(),
            "width": round(width, 1),
            "height": round(height, 1),
            "margin": MARGIN_KM,
            "owner": owner,
            "county": county,
            "elev": elev,
            "elev_max": elev_max,
            "water": water,
            "relief": relief,
            "cover": cover,
            "pct": pct,
            "tables": tables,
            "states": states_out,
            "counties": [{"geoid": c["geoid"], "name": c["name"]} for c in counties],
            "rivers": rivers,
        },
    )
    save_interim(
        "_world",
        {
            "grid": grid.to_dict(),
            "projection": proj.to_dict(),
            "owner": owner,
            "county": county,
            "county_samples": county_samples,
            "states": [s["fips"] for s in states],
            "counties": [c["geoid"] for c in counties],
            "water": water,
            "cover": cover,
            "pct": pct,
        },
    )
