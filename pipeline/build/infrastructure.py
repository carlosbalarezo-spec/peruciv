"""Build infrastructure.json: carreteras, ferrocarriles (Natural Earth 1:10m), puertos y aeropuertos (OSITRAN)."""

from __future__ import annotations

import math

from ..core.geo import MapProjection
from ..core.hexgrid import HexGrid
from ..core.store import load_interim, write_web

REQUIRES = ["_world", "natural_earth_roads", "ositran_airports"]
PRODUCES = ["infrastructure.json"]

AIRPORT_COORDS = {
    "LIM": ("Aeropuerto Internacional Jorge Chávez", "Lima / Callao", -12.0219, -77.1143, "CAL", "L"),
    "CUZ": ("Aeropuerto Alejandro Velasco Astete", "Cusco", -13.5357, -71.9388, "CUS", "M"),
    "AQP": ("Aeropuerto Rodríguez Ballón", "Arequipa", -16.3411, -71.5831, "ARE", "M"),
    "PIU": ("Aeropuerto Guillermo Concha Iberico", "Piura", -5.2058, -80.6164, "PIU", "S"),
    "IQT": ("Aeropuerto Francisco Secada Vignetta", "Iquitos", -3.7847, -73.3088, "LOR", "S"),
    "TRU": ("Aeropuerto Carlos Martínez de Pinillos", "Trujillo", -8.0814, -79.1088, "LAL", "S"),
    "TPP": ("Aeropuerto Guillermo del Castillo", "Tarapoto", -6.5087, -76.3732, "SAM", "S"),
    "CIX": ("Aeropuerto José Abelardo Quiñones", "Chiclayo", -6.7875, -79.8281, "LAM", "S"),
    "JUL": ("Aeropuerto Inca Manco Cápac", "Juliaca", -15.4671, -70.1582, "PUN", "S"),
    "PCL": ("Aeropuerto David Abensur Rengifo", "Pucallpa", -8.3779, -74.5743, "UCA", "S"),
    "TCQ": ("Aeropuerto Carlos Ciriani Santa Rosa", "Tacna", -18.0533, -70.2758, "TAC", "N"),
    "CJA": ("Aeropuerto Armando Revoredo Iglesias", "Cajamarca", -7.1392, -78.4894, "CAJ", "N"),
    "PEM": ("Aeropuerto Padre Aldamiz", "Puerto Maldonado", -12.6136, -69.2286, "MDD", "N"),
    "AYP": ("Aeropuerto Alfredo Mendívil Duarte", "Ayacucho", -13.1548, -74.2044, "AYA", "N"),
    "TBP": ("Aeropuerto Pedro Canga Rodríguez", "Tumbes", -3.5525, -80.3814, "TUM", "N"),
    "TYL": ("Aeropuerto Víctor Montes Arias", "Talara", -4.5766, -81.2541, "PIU", "N"),
    "PIO": ("Aeropuerto Renán Elías Olivera", "Pisco", -13.7448, -76.2203, "ICA", "N"),
    "HUU": ("Aeropuerto Alférez FAP David Figueroa", "Huánuco", -9.8788, -76.2048, "HUC", "N"),
    "ATA": ("Aeropuerto Comandante FAP Germán Arias", "Huaraz / Anta", -9.3474, -77.5984, "ANC", "N"),
}

PERU_PORTS = [
    ("callao", "Puerto del Callao (APM / DP World)", "coastal", 1, 56000000, -12.054, -77.152, "CAL"),
    ("chancay", "Megapuerto de Chancay", "coastal", 2, 18000000, -11.592, -77.274, "LIM"),
    ("matarani", "Terminal Portuario de Matarani", "coastal", 3, 7800000, -17.001, -72.106, "ARE"),
    ("paita", "Terminal Portuario de Paita", "coastal", 4, 4800000, -5.084, -81.112, "PIU"),
    ("salaverry", "Terminal Portuario de Salaverry", "coastal", 5, 3900000, -8.222, -78.979, "LAL"),
    ("pisco", "Terminal Portuario San Martín (Paracas)", "coastal", 6, 3500000, -13.800, -76.292, "ICA"),
    ("ilo", "Puerto de Ilo", "coastal", 7, 2900000, -17.646, -71.348, "MOQ"),
    ("iquitos", "Terminal Portuario Fluvial de Iquitos", "inland", 8, 1200000, -3.720, -73.235, "LOR"),
    ("yurimaguas", "Terminal Portuario Yurimaguas — Nueva Reforma", "inland", 9, 650000, -5.850, -76.085, "LOR"),
]


def _nearest_land(grid: HexGrid, owner: list[int], x: float, y: float) -> int:
    c = grid.cell_at(x, y)
    if c >= 0 and owner[c] >= 0:
        return c
    best, bd = 0, 1e18
    for i, o in enumerate(owner):
        if o < 0:
            continue
        cx, cy = grid.center(*grid.col_row(i))
        d = math.hypot(cx - x, cy - y)
        if d < bd:
            bd, best = d, i
    return best


def _rasterize_links(lines, grid: HexGrid, proj: MapProjection, owner: list[int], cls_idx: int, name: str | None, out: dict):
    for ln in lines:
        prev = -1
        for p, q in zip(ln, ln[1:]):
            px, py = proj(*p)
            qx, qy = proj(*q)
            n = max(1, int(math.ceil(math.hypot(qx - px, qy - py) / 4.0)))
            for j in range(n + 1):
                t = j / n
                c = grid.cell_at(px + t * (qx - px), py + t * (qy - py))
                if c < 0 or owner[c] == -2:
                    prev = -1
                    continue
                if prev >= 0 and c != prev and c in grid.neighbours(prev):
                    if owner[prev] >= 0 or owner[c] >= 0:
                        pair = (min(prev, c), max(prev, c))
                        cur = out.get(pair)
                        if cur is None or cls_idx < cur[0]:
                            out[pair] = (cls_idx, name)
                prev = c


def build() -> None:
    w = load_interim("_world")
    ne_r = load_interim("natural_earth_roads")
    aero = load_interim("ositran_airports")

    grid = HexGrid(**w["grid"])
    proj = MapProjection(**w["projection"])
    owner = w["owner"]

    road_links: dict[tuple[int, int], tuple[int, str | None]] = {}
    for r in ne_r["roads"]:
        sr = r.get("scalerank") or 8
        cls = 0 if (r.get("type") == "Major Highway" or sr <= 5) else 1
        _rasterize_links(r["lines"], grid, proj, owner, cls, r.get("name"), road_links)

    rail_links: dict[tuple[int, int], tuple[int, str | None]] = {}
    for r in ne_r["rail"]:
        sr = r.get("scalerank") or 7
        cls = 0 if sr <= 5 else 1
        _rasterize_links(r["lines"], grid, proj, owner, cls, None, rail_links)

    roads_out = [[a, b, cls, name] for (a, b), (cls, name) in sorted(road_links.items())]
    rail_out = [[a, b, cls] for (a, b), (cls, _) in sorted(rail_links.items())]

    ports_out = []
    for pid, name, ptype, rank, tons, lat, lon, dep in PERU_PORTS:
        x, y = proj(lon, lat)
        cell = _nearest_land(grid, owner, x, y)
        ports_out.append({
            "id": pid, "name": name, "type": ptype, "rank": rank,
            "tons": tons, "domestic": None, "foreign": None, "imports": None, "exports": None, "year": 2024,
            "x": round(x, 1), "y": round(y, 1), "cell": cell, "county": None, "cbsa": None, "state": dep,
        })

    # Airports: merge OSITRAN live passenger counts with coordinates
    pax_map = {a["code"]: a for a in aero["airports"]}
    airports_out = []
    for code, (name, city, lat, lon, dep, hub) in AIRPORT_COORDS.items():
        rec = pax_map.get(code)
        enpl = rec["pax"] if rec else (3800000 if code == "CUZ" else None)
        if enpl is None:
            continue
        x, y = proj(lon, lat)
        cell = _nearest_land(grid, owner, x, y)
        airports_out.append({
            "id": code, "name": name, "city": city, "hub": hub,
            "enplanements": enpl, "enplanements_prev": rec["pax_prev"] if rec else None,
            "cargo_lbs": None, "year": rec["year"] if rec else aero["year"],
            "x": round(x, 1), "y": round(y, 1), "cell": cell, "county": None, "cbsa": None, "state": dep,
        })
    airports_out.sort(key=lambda a: -(a["enplanements"] or 0))

    write_web("infrastructure.json", {
        "version": 1,
        "vintage": {
            "roads": ne_r.get("vintage", "Natural Earth v5.1.2 (1:10m)"),
            "rail": ne_r.get("vintage", "Natural Earth v5.1.2 (1:10m)"),
            "ports": "APN / OSITRAN 2024",
            "airports": aero.get("vintage", f"OSITRAN {aero['year']} (PNDA)"),
        },
        "sources": ["natural_earth_roads", "ositran_airports"],
        "rules": {
            "roads": "Red vial principal del Perú (Panamericana, Longitudinal de la Sierra, Interoceánica) — Natural Earth 1:10m.",
            "rail": "Líneas férreas principales (Ferrocarril Central, Ferrocarril del Sur / Machu Picchu).",
            "ports": "Principales terminales portuarios marítimos y fluviales del Perú.",
            "airports": "Aeropuertos concesionados con tráfico de pasajeros OSITRAN.",
        },
        "road_classes": [{"id": "interstate", "name": "Carretera troncal / Panamericana"}, {"id": "major", "name": "Carretera nacional"}],
        "rail_tiers": [{"id": "main", "name": "Ferrocarril principal"}, {"id": "secondary", "name": "Ramal ferroviario"}],
        "hubs": {"L": "Hub internacional", "M": "Hub regional", "S": "Aeropuerto secundario", "N": "Aeropuerto local"},
        "roads": roads_out,
        "rail": rail_out,
        "ports": ports_out,
        "airports": airports_out,
    })
    print(f"    {len(roads_out)} enlaces viales, {len(rail_out)} férreos, {len(ports_out)} puertos, {len(airports_out)} aeropuertos")
