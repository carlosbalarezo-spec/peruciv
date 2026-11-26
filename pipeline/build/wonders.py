"""Build wonders.json: Maravillas naturales (SERNANP), arqueológicas/culturales (MINCETUR) y universidades (SUNEDU)."""

from __future__ import annotations

import math

from ..core.geo import MapProjection
from ..core.hexgrid import HexGrid
from ..core.store import load_interim, write_web

REQUIRES = ["_world", "sernanp_visits", "mincetur_sites", "sunedu_universities"]
PRODUCES = ["wonders.json"]

# Curated coordinates for top SERNANP ANPs & MINCETUR archaeological wonders
ANP_COORDS = {
    "PARACAS": ("Reserva Nacional de Paracas", "Paracas", "coastal", -13.916, -76.265, "ICA"),
    "HUASCARAN": ("Parque Nacional Huascarán", "Huascarán", "natural", -9.122, -77.604, "ANC"),
    "TITICACA": ("Reserva Nacional del Titicaca", "Lago Titicaca", "natural", -15.833, -69.933, "PUN"),
    "TAMBOPATA": ("Reserva Nacional Tambopata", "Tambopata", "natural", -12.920, -69.285, "MDD"),
    "MANU": ("Parque Nacional del Manu", "Manu", "natural", -12.150, -71.500, "MDD"),
    "PACAYA": ("Reserva Nacional Pacaya Samiria", "Pacaya Samiria", "natural", -5.250, -74.667, "LOR"),
    "TINGO MARIA": ("Parque Nacional Tingo María", "Tingo María", "natural", -9.342, -76.020, "HUC"),
    "LACHAY": ("Reserva Nacional de Lachay", "Lomas de Lachay", "natural", -11.360, -77.372, "LIM"),
    "SALINAS": ("R.N. Salinas y Aguada Blanca", "Salinas y Aguada Blanca", "natural", -16.083, -71.217, "ARE"),
    "NOR YAUYOS": ("Reserva Paisajística Nor Yauyos-Cochas", "Nor Yauyos-Cochas", "natural", -12.220, -75.790, "LIM"),
    "ISLAS": ("R.N. Sistema de Islas, Islotes y Puntas Guaneras", "Islas Ballestas", "coastal", -13.733, -76.397, "ICA"),
}

ARCH_SITES = [
    ("MACHU PICCHU", "Santuario Histórico de Machu Picchu", "Machu Picchu", -13.1631, -72.5450, "CUS"),
    ("SACSAYHUAM", "Parque Arqueológico de Sacsayhuamán", "Sacsayhuamán", -13.5096, -71.9817, "CUS"),
    ("OLLANTAYTAMBO", "Fortaleza de Ollantaytambo", "Ollantaytambo", -13.2583, -72.2636, "CUS"),
    ("MORAY", "Andenes de Moray", "Moray", -13.3298, -72.1959, "CUS"),
    ("CHAN CHAN", "Ciudadela de Chan Chan", "Chan Chan", -8.1060, -79.0750, "LAL"),
    ("CARAL", "Ciudad Sagrada de Caral-Supe", "Caral", -10.8936, -77.5206, "LIM"),
    ("KUELAP", "Fortaleza de Kuélap", "Kuélap", -6.4192, -77.9234, "AMA"),
    ("NASCA", "Líneas y Geoglifos de Nasca", "Líneas de Nasca", -14.7390, -75.1300, "ICA"),
    ("CHAVIN", "Monumento Arqueológico Chavín de Huántar", "Chavín de Huántar", -9.5934, -77.1774, "ANC"),
    ("PACHACAMAC", "Santuario Arqueológico de Pachacámac", "Pachacámac", -12.2564, -76.9006, "LIM"),
    ("SIPAN", "Museo Tumbas Reales de Sipán", "Sipán", -6.7069, -79.9036, "LAM"),
    ("COLCA", "Valle del Colca", "Cañón del Colca", -15.6100, -71.8800, "ARE"),
]

TOP_UNIS_SUB = [
    ("SAN MARCOS", "UNMSM (Decana de América)"),
    ("PONTIFICIA UNIVERSIDAD CAT", "PUCP"),
    ("CAYETANO HEREDIA", "UPCH"),
    ("NACIONAL DE INGENIER", "UNI"),
    ("AGRARIA LA MOLINA", "UNALM"),
    ("SAN AGUST", "UNSA (Arequipa)"),
    ("SAN ANTONIO ABAD", "UNSAAC (Cusco)"),
    ("NACIONAL DE TRUJILLO", "UNT (Trujillo)"),
    ("NACIONAL DE PIURA", "UNP (Piura)"),
    ("AMAZONIA PERUANA", "UNAP (Iquitos)"),
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


def build() -> None:
    w = load_interim("_world")
    sernanp = load_interim("sernanp_visits")
    mincetur = load_interim("mincetur_sites")
    sunedu = load_interim("sunedu_universities")

    grid = HexGrid(**w["grid"])
    proj = MapProjection(**w["projection"])
    owner = w["owner"]

    wonders = []

    # 1. Natural wonders from SERNANP visits
    anp_vis: dict[str, int] = {}
    for p in sernanp["parks"]:
        up = p["anp"].upper().replace("Á", "A").replace("Í", "I").replace("Ó", "O")
        for key in ANP_COORDS:
            if key in up:
                anp_vis[key] = anp_vis.get(key, 0) + p["visits"]

    nat_list = sorted(ANP_COORDS.items(), key=lambda kv: -anp_vis.get(kv[0], 0))
    for rank, (key, (full, short, kind, lat, lon, dep)) in enumerate(nat_list[:9], 1):
        x, y = proj(lon, lat)
        cell = _nearest_land(grid, owner, x, y)
        wonders.append({
            "id": f"sernanp-{key.lower().replace(' ', '-')}",
            "name": full, "short": short, "kind": kind, "rule": "national_park", "rank": rank,
            "metrics": {"visits": anp_vis.get(key) or None, "year": sernanp["year"], "unit_type": "Área Natural Protegida"},
            "x": round(x, 1), "y": round(y, 1), "cell": cell, "cells": None,
            "county": None, "cbsa": None, "state": dep, "curated": False,
        })

    # 2. Cultural / Archaeological wonders from MINCETUR visits
    site_vis: dict[str, int] = {}
    for s in mincetur["sites"]:
        up = s["name"].upper().replace("Á", "A").replace("É", "E").replace("Í", "I").replace("Ó", "O").replace("Ú", "U")
        for key, *_ in ARCH_SITES:
            if key in up:
                site_vis[key] = max(site_vis.get(key, 0), s["visits"])

    arch_sorted = sorted(ARCH_SITES, key=lambda x: -site_vis.get(x[0], 0))
    for rank, (key, full, short, lat, lon, dep) in enumerate(arch_sorted, 1):
        x, y = proj(lon, lat)
        cell = _nearest_land(grid, owner, x, y)
        wonders.append({
            "id": f"mincetur-{key.lower().replace(' ', '-')}",
            "name": full, "short": short, "kind": "landmark", "rule": "landmark", "rank": rank,
            "metrics": {"visits": site_vis.get(key) or None, "year": mincetur["year"], "unit_type": "Patrimonio Cultural / Arqueológico"},
            "x": round(x, 1), "y": round(y, 1), "cell": cell, "cells": None,
            "county": None, "cbsa": None, "state": dep, "curated": False,
        })

    # 3. Top Universities from SUNEDU (exact lat/lon)
    uni_rank = 0
    seen_u = set()
    for sub, short in TOP_UNIS_SUB:
        for u in sunedu["universities"]:
            up = u["name"].upper().replace("Á", "A").replace("É", "E").replace("Í", "I").replace("Ó", "O").replace("Ú", "U")
            if sub in up and short not in seen_u:
                seen_u.add(short)
                uni_rank += 1
                x, y = proj(u["lon"], u["lat"])
                cell = _nearest_land(grid, owner, x, y)
                wonders.append({
                    "id": f"sunedu-{u['code']}",
                    "name": u["name"].title(), "short": short, "kind": "university",
                    "rule": "research_university", "rank": uni_rank,
                    "metrics": {"licencia_anos": u["period"], "gestion": u["gestion"]},
                    "x": round(x, 1), "y": round(y, 1), "cell": cell, "cells": None,
                    "county": u["ubigeo"][:4] if len(u["ubigeo"]) >= 4 else None,
                    "cbsa": None, "state": u["dep"][:3].upper(), "curated": False,
                })
                break

    write_web("wonders.json", {
        "version": 1,
        "vintage": {
            "parks": sernanp.get("vintage", f"SERNANP {sernanp['year']} (PNDA)"),
            "landmarks": mincetur.get("vintage", f"MINCETUR {mincetur['year']} (PNDA)"),
            "universities": sunedu.get("vintage", "SUNEDU 2024 (PNDA)"),
        },
        "sources": ["sernanp_visits", "mincetur_sites", "sunedu_universities"],
        "rules": [
            {"id": "national_park", "kind": "natural", "kinds": ["natural", "coastal"], "year": sernanp["year"],
             "text": "Áreas Naturales Protegidas del Perú más visitadas según SERNANP."},
            {"id": "landmark", "kind": "landmark", "kinds": ["landmark"], "year": mincetur["year"],
             "text": "Principales complejos arqueológicos y monumentos patrimoniales del Perú (MINCETUR)."},
            {"id": "research_university", "kind": "university", "kinds": ["university"], "year": 2024,
             "text": "Universidades peruanas referentes con licenciamiento institucional SUNEDU."},
        ],
        "national": {"park_visits": sum(p["visits"] for p in sernanp["parks"]), "park_visits_year": sernanp["year"], "r1_universities": len(sunedu["universities"])},
        "wonders": wonders,
    })
    print(f"    {len(wonders)} maravillas del Perú escritas")
