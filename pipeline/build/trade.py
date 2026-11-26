"""Build trade.json: grandes corredores logísticos, mineros, energéticos y agroexportadores del Perú."""

from __future__ import annotations

import heapq
import json
import math
from collections import defaultdict

from ..core.geo import MapProjection
from ..core.hexgrid import HexGrid
from ..core.paths import WEB_DATA
from ..core.store import load_interim, write_web

REQUIRES = ["_world", "peru_boundaries", "peru_socioeconomic", "infrastructure.json", "cities.json"]
PRODUCES = ["trade.json"]

MODES = [
    {"id": "truck", "name": "Carretera / Camión"},
    {"id": "rail", "name": "Ferrocarril"},
    {"id": "water", "name": "Marítimo / Fluvial"},
    {"id": "air", "name": "Aéreo"},
    {"id": "multiple", "name": "Multimodal"},
    {"id": "pipeline", "name": "Ducto (Gas / Petróleo)"},
    {"id": "other", "name": "Otro"},
]

COMMODITIES = {
    "26": "Concentrados de cobre y minerales",
    "03": "Frutas y agroexportación (arándano, uva, palta)",
    "04": "Productos pesqueros y harina de pescado",
    "17": "Gas natural y líquidos (Camisea / combustibles)",
    "16": "Petróleo crudo",
    "43": "Carga general, manufacturas y consumo",
    "35": "Maquinaria, insumos industriales y electrónicos",
    "02": "Granos, café, cacao y alimentos andinos",
}

# Major Peruvian freight & trade corridors:
# (dep_a, dep_b, value_musd, tons_k, top_mode, modes_dict, commodity_code)
CORRIDORS = [
    ("15", "04", 6850.0, 4900.0, "truck", {"truck": 0.86, "air": 0.08, "water": 0.06}, "43"),  # Lima ⇄ Arequipa (Panamericana Sur)
    ("15", "13", 6120.0, 5200.0, "truck", {"truck": 0.90, "water": 0.06, "air": 0.04}, "03"),  # Lima ⇄ La Libertad / Trujillo
    ("15", "20", 5480.0, 4600.0, "truck", {"truck": 0.78, "water": 0.16, "air": 0.06}, "03"),  # Lima ⇄ Piura / Paita
    ("15", "11", 5150.0, 5800.0, "truck", {"truck": 0.84, "pipeline": 0.12, "water": 0.04}, "03"),  # Lima ⇄ Ica / Pisco
    ("08", "11", 4650.0, 3900.0, "pipeline", {"pipeline": 0.88, "truck": 0.12}, "17"),          # Cusco (Camisea) ⇄ Pisco/Ica (Gasoducto)
    ("03", "04", 4420.0, 3100.0, "multiple", {"truck": 0.58, "rail": 0.42}, "26"),              # Apurímac (Las Bambas) ⇄ Arequipa/Matarani
    ("12", "15", 4280.0, 4850.0, "multiple", {"truck": 0.68, "rail": 0.32}, "26"),              # Junín (Huancayo/Toromocho) ⇄ Lima/Callao
    ("08", "04", 3890.0, 2950.0, "multiple", {"rail": 0.52, "truck": 0.48}, "26"),              # Cusco (Espinar/Constancia) ⇄ Matarani
    ("15", "14", 3740.0, 3400.0, "truck", {"truck": 0.92, "air": 0.08}, "43"),                  # Lima ⇄ Lambayeque (Chiclayo)
    ("15", "02", 3580.0, 4100.0, "truck", {"truck": 0.82, "water": 0.18}, "26"),                # Lima ⇄ Áncash (Chimbote / Antamina)
    ("18", "04", 3120.0, 2700.0, "multiple", {"truck": 0.64, "rail": 0.24, "water": 0.12}, "26"),  # Moquegua ⇄ Arequipa
    ("23", "18", 2680.0, 2200.0, "rail", {"rail": 0.62, "truck": 0.38}, "26"),                  # Tacna (Toquepala) ⇄ Ilo (Moquegua)
    ("19", "15", 2490.0, 2350.0, "multiple", {"truck": 0.60, "rail": 0.40}, "26"),              # Pasco ⇄ Lima/Callao
    ("15", "08", 2420.0, 1450.0, "multiple", {"truck": 0.58, "air": 0.42}, "43"),               # Lima ⇄ Cusco
    ("06", "13", 2250.0, 1950.0, "truck", {"truck": 0.96, "air": 0.04}, "26"),                  # Cajamarca ⇄ Trujillo/Pacasmayo
    ("04", "21", 2180.0, 2100.0, "multiple", {"truck": 0.78, "rail": 0.22}, "43"),              # Arequipa ⇄ Juliaca/Puno
    ("25", "15", 1920.0, 1850.0, "truck", {"truck": 0.93, "air": 0.07}, "02"),                  # Ucayali (Pucallpa) ⇄ Huánuco ⇄ Lima
    ("16", "20", 1780.0, 1650.0, "pipeline", {"pipeline": 0.55, "multiple": 0.45}, "16"),       # Loreto ⇄ Piura/Bayóvar (Oleoducto / Eje Norte)
    ("22", "20", 1690.0, 1720.0, "truck", {"truck": 0.96, "air": 0.04}, "02"),                  # San Martín (Tarapoto) ⇄ Piura/Paita (IIRSA Norte)
    ("16", "25", 1480.0, 1550.0, "water", {"water": 0.88, "air": 0.12}, "43"),                  # Iquitos ⇄ Pucallpa (Hidrovía Ucayali-Amazonas)
    ("16", "22", 1360.0, 1280.0, "multiple", {"water": 0.55, "truck": 0.45}, "43"),             # Iquitos ⇄ Yurimaguas ⇄ Tarapoto
    ("14", "06", 1310.0, 1220.0, "truck", {"truck": 0.98, "air": 0.02}, "02"),                  # Chiclayo ⇄ Jaén/Cajamarca
    ("10", "15", 1260.0, 1380.0, "truck", {"truck": 0.97, "air": 0.03}, "02"),                  # Huánuco ⇄ Lima
    ("08", "17", 1140.0, 890.0, "truck", {"truck": 0.92, "air": 0.08}, "43"),                   # Cusco ⇄ Madre de Dios (Interoceánica Sur)
    ("04", "23", 1090.0, 960.0, "truck", {"truck": 0.94, "air": 0.06}, "43"),                   # Arequipa ⇄ Tacna
    ("20", "24", 980.0, 910.0, "truck", {"truck": 0.96, "water": 0.04}, "04"),                  # Piura ⇄ Tumbes (Eje Fronterizo Norte)
    ("15", "05", 940.0, 820.0, "truck", {"truck": 0.91, "air": 0.09}, "02"),                    # Lima ⇄ Ayacucho (Vía Los Libertadores)
    ("12", "09", 780.0, 710.0, "truck", {"truck": 0.85, "rail": 0.15}, "26"),                   # Junín ⇄ Huancavelica
]


def _shortest_hex_path(grid: HexGrid, owner: list[int], start: int, goal: int, road_cost: dict[tuple[int, int], float]) -> list[int]:
    if start == goal:
        return [start]
    gx, gy = grid.center(*grid.col_row(goal))
    dist = {start: 0.0}
    prev: dict[int, int] = {}
    pq = [(0.0, start)]
    while pq:
        _, u = heapq.heappop(pq)
        if u == goal:
            break
        du = dist[u]
        for v in grid.neighbours(u):
            if owner[v] == -2:
                continue
            pair = (min(u, v), max(u, v))
            step = road_cost.get(pair, 2.6 if owner[v] >= 0 else 7.5)
            nd = du + step
            if nd < dist.get(v, 1e18):
                dist[v] = nd
                prev[v] = u
                vx, vy = grid.center(*grid.col_row(v))
                h = math.hypot(vx - gx, vy - gy) / (grid.radius * 2.2)
                heapq.heappush(pq, (nd + h, v))
    if goal not in prev:
        return [start, goal]
    path = [goal]
    cur = goal
    while cur in prev:
        cur = prev[cur]
        path.append(cur)
    path.reverse()
    return path


def build() -> None:
    w = load_interim("_world")
    bounds = load_interim("peru_boundaries")
    se = load_interim("peru_socioeconomic")

    grid = HexGrid(**w["grid"])
    proj = MapProjection(**w["projection"])
    owner = w["owner"]

    # Read built infrastructure.json + cities.json if present for road links & city cells
    infra_p = WEB_DATA / "infrastructure.json"
    cities_p = WEB_DATA / "cities.json"
    infra = json.loads(infra_p.read_text(encoding="utf-8")) if infra_p.exists() else {"roads": [], "rail": []}
    cities_built = json.loads(cities_p.read_text(encoding="utf-8")) if cities_p.exists() else []
    city_by_id = {c["id"]: c for c in cities_built}

    road_cost: dict[tuple[int, int], float] = {}
    for a, b, cls, _ in infra.get("roads", []):
        road_cost[(min(a, b), max(a, b))] = 0.65 if cls == 0 else 0.95
    for a, b, cls in infra.get("rail", []):
        pair = (min(a, b), max(a, b))
        road_cost[pair] = min(road_cost.get(pair, 9.0), 1.05)

    states_meta = {s["fips"]: s for s in bounds["states"]}
    prov_count_by_dep = defaultdict(int)
    for c in bounds["counties"]:
        prov_count_by_dep[c["state_fips"]] += 1

    cities_by_dep: dict[str, list[dict]] = defaultdict(list)
    for c in cities_built:
        for abbr in c["states"]:
            fips = next((f for f, s in states_meta.items() if s["abbr"] == abbr), None)
            if fips:
                cities_by_dep[fips].append(c)
    for fips in cities_by_dep:
        cities_by_dep[fips].sort(key=lambda x: -x["population"])

    # Zone per department (merging Callao "07" into Lima-Callao "15")
    zones_map = {}
    for fips, sm in sorted(states_meta.items()):
        if fips == "07":
            continue
        is_lima = fips == "15"
        c_list = cities_by_dep.get(fips, [])
        lead = c_list[0] if c_list else None
        if lead:
            anchor = {"cell": lead["cell"], "x": lead["x"], "y": lead["y"], "city": lead["id"]}
        else:
            idx = w["states"].index(fips)
            cell = next((i for i, o in enumerate(owner) if o == idx), 0)
            cx, cy = grid.center(*grid.col_row(cell))
            anchor = {"cell": cell, "x": round(cx, 1), "y": round(cy, 1), "city": None}
        gdp_m = se["departments"][fips]["gdp_musd"] + (se["departments"]["07"]["gdp_musd"] if is_lima else 0)
        zones_map[fips] = {
            "id": fips,
            "faf": [fips, "07"] if is_lima else [fips],
            "name": "Lima Metropolitana y Callao" if is_lima else f"Región {sm['name']}",
            "short": "Lima–Callao" if is_lima else sm["name"],
            "kind": "metro" if lead and lead.get("metro") else "rest_of_state",
            "states": ["LIM", "CAL"] if is_lima else [sm["abbr"]],
            "cities": [c["id"] for c in c_list],
            "counties": prov_count_by_dep[fips] + (prov_count_by_dep["07"] if is_lima else 0),
            "anchor": anchor,
            "partners": [],
            "totals_musd": {
                "within": round(gdp_m * 0.28, 1),
                "other_zones": 0.0,
                "import": round(gdp_m * (0.34 if is_lima else 0.12), 1),
                "export": round(gdp_m * (0.24 if is_lima else 0.38), 1),
            },
        }

    routes_out = []
    partner_acc = defaultdict(list)
    sorted_corr = sorted(CORRIDORS, key=lambda x: -x[2])
    for rank, (da, db, val_m, tons_k, top_m, m_dict, comm) in enumerate(sorted_corr, 1):
        za, zb = zones_map[da], zones_map[db]
        ca, cb = za["anchor"]["cell"], zb["anchor"]["cell"]
        path = _shortest_hex_path(grid, owner, ca, cb, road_cost)
        dist_km = max(80, round(math.hypot(za["anchor"]["x"] - zb["anchor"]["x"], za["anchor"]["y"] - zb["anchor"]["y"])))
        tmiles_m = round(tons_k * dist_km * 0.621371 / 1000.0, 1)
        full_modes = {m["id"]: round(m_dict.get(m["id"], 0.0), 4) for m in MODES}
        routes_out.append({
            "a": da, "b": db, "rank": rank,
            "value_musd": val_m, "tons_k": tons_k, "tmiles_m": tmiles_m,
            "modes": full_modes, "top_mode": top_m, "top_commodity": comm,
            "dist_km": dist_km, "path": path,
        })
        za["totals_musd"]["other_zones"] = round(za["totals_musd"]["other_zones"] + val_m, 1)
        zb["totals_musd"]["other_zones"] = round(zb["totals_musd"]["other_zones"] + val_m, 1)
        partner_acc[da].append([db, val_m, top_m])
        partner_acc[db].append([da, val_m, top_m])

    for fips, z in zones_map.items():
        pts = sorted(partner_acc.get(fips, []), key=lambda x: -x[1])[:5]
        z["partners"] = pts

    zones_list = sorted(zones_map.values(), key=lambda z: z["id"])
    write_web("trade.json", {
        "version": 1,
        "vintage": "MTC Corredores Logísticos / MINCETUR / APN 2024",
        "year": 2024,
        "sources": ["natural_earth_roads", "ositran_airports", "minem_hydrocarbons"],
        "rule": "Los 28 mayores corredores logísticos, mineros, energéticos y agroexportadores interregionales del Perú por valor estimado de carga.",
        "path_note": "Los trazos siguen la red vial, ferroviaria, fluvial o de ductos sobre la malla hexagonal (representación esquemática).",
        "units": {"value_musd": "millones de USD corrientes", "tons_k": "miles de toneladas", "tmiles_m": "millones de ton-milla"},
        "modes": MODES,
        "commodities": COMMODITIES,
        "national_musd": {
            "domestic": round(sum(r["value_musd"] for r in routes_out) * 1.45, 1),
            "import": 54200.0,
            "export": 74600.0,
        },
        "zones": zones_list,
        "routes": routes_out,
    })
    print(f"    {len(routes_out)} rutas comerciales en {len(zones_list)} zonas logísticas escritas")
