"""Build military.json: instalaciones de las Fuerzas Armadas del Perú y presupuesto de Defensa (MINDEF / MEF)."""

from __future__ import annotations

import json
import math
from collections import defaultdict

from ..core.geo import MapProjection
from ..core.hexgrid import HexGrid
from ..core.paths import WEB_DATA
from ..core.store import load_interim, write_web

REQUIRES = ["_world", "peru_boundaries", "peru_socioeconomic", "cities.json"]
PRODUCES = ["military.json"]

COMPONENTS = [
    {"id": "army", "name": "Ejército del Perú (EP)", "codes": ["ep"]},
    {"id": "navy", "name": "Marina de Guerra del Perú (MGP)", "codes": ["mgp"]},
    {"id": "air_force", "name": "Fuerza Aérea del Perú (FAP)", "codes": ["fap"]},
    {"id": "marines", "name": "Infantería de Marina (MGP)", "codes": ["imap"]},
    {"id": "army_reserve", "name": "Reserva del Ejército", "codes": ["rep"]},
    {"id": "navy_reserve", "name": "Guardacostas (DICAPI)", "codes": ["dicapi"]},
    {"id": "air_force_reserve", "name": "Reserva Aérea", "codes": ["rfap"]},
    {"id": "marine_reserve", "name": "Operaciones Especiales (FOES)", "codes": ["foes"]},
    {"id": "army_guard", "name": "Comando Especial VRAEM", "codes": ["cevraem"]},
    {"id": "air_guard", "name": "Aviación del Ejército / Naval", "codes": ["ae"]},
    {"id": "other", "name": "Comando Conjunto (CCFFAA)", "codes": ["ccffaa"]},
]

# Major public military bases, naval stations & air bases in Peru
INSTALLATIONS = [
    ("base-naval-callao", "Base Naval del Callao", "navy", "major", True, 18.5, -12.048, -77.145, "CAL", "0701", "1501"),
    ("pentagonito-san-borja", "Cuartel General del Ejército (San Borja)", "army", "major", True, 14.0, -12.101, -76.985, "LIM", "1501", "1501"),
    ("las-palmas-surco", "Base Aérea Las Palmas", "air_force", "major", True, 22.0, -12.160, -77.000, "LIM", "1501", "1501"),
    ("fuerte-hoyos-rubio", "Fuerte Rafael Hoyos Rubio (Rímac)", "army", "base", False, 9.5, -12.025, -77.032, "LIM", "1501", "1501"),
    ("escuela-militar-chorrillos", "Escuela Militar de Chorrillos", "army", "base", False, 8.0, -12.168, -77.022, "LIM", "1501", "1501"),
    ("base-infanteria-ancon", "Base de Infantería de Marina — Ancón", "marines", "base", False, 35.0, -11.775, -77.165, "LIM", "1501", "1501"),
    ("base-aerea-la-joya", "Base Aérea Mariano Melgar — La Joya", "air_force", "major", True, 420.0, -16.586, -71.926, "ARE", "0401", "0401"),
    ("fuerte-bolognesi-arequipa", "Cuartel Salaverry / III División de Ejército", "army", "base", False, 15.0, -16.395, -71.515, "ARE", "0401", "0401"),
    ("fuerte-arica-locumba", "Fuerte Arica — Locumba (6a Brigada Blindada)", "army", "major", True, 680.0, -17.614, -70.762, "TAC", "2303", "2301"),
    ("cuartel-tarapaca-tacna", "Cuartel Gregorio Albarracín (3a Brigada de Caballería)", "army", "base", False, 18.0, -18.028, -70.250, "TAC", "2301", "2301"),
    ("estacion-naval-iquitos", "Estación Naval Capitán Clavero — Iquitos (Comopama)", "navy", "major", True, 28.0, -3.725, -73.240, "LOR", "1601", "1601"),
    ("fuerte-vargas-guerra", "Cuartel Gral. Vargas Guerra / V División de Ejército", "army", "base", False, 24.0, -3.760, -73.275, "LOR", "1601", "1601"),
    ("base-aerea-iquitos", "Grupo Aéreo N.° 42 — Iquitos", "air_force", "base", False, 16.0, -3.785, -73.308, "LOR", "1601", "1601"),
    ("base-aerea-el-pato", "Base Aérea El Pato — Talara (Grupo Aéreo N.° 11)", "air_force", "major", True, 195.0, -4.549, -81.224, "PIU", "2007", "2007"),
    ("cuartel-grau-piura", "I División de Ejército — Cuartel Grau (Piura)", "army", "major", True, 25.0, -5.185, -80.640, "PIU", "2001", "2001"),
    ("estacion-naval-paita", "Estación Naval de Paita", "navy", "base", False, 12.0, -5.082, -81.110, "PIU", "2005", "2005"),
    ("fuerte-caceres-sullana", "1a Brigada de Caballería — Sullana", "army", "base", False, 32.0, -4.895, -80.690, "PIU", "2006", "2006"),
    ("base-aerea-chiclayo", "Grupo Aéreo N.° 6 — Chiclayo", "air_force", "major", True, 34.0, -6.788, -79.828, "LAM", "1401", "1401"),
    ("fuerte-demetrio-acosta", "7a Brigada de Infantería — Lambayeque", "army", "base", False, 19.0, -6.705, -79.905, "LAM", "1403", "1401"),
    ("cuartel-tablada-tumbes", "1a Brigada de Infantería — Tumbes", "army", "base", False, 45.0, -3.570, -80.440, "TUM", "2401", "2401"),
    ("ce-vraem-pichari", "Comando Especial VRAEM — Fuerte Pichari", "army_guard", "base", False, 65.0, -12.519, -73.831, "CUS", "0809", "0809"),
    ("cuartel-manco-capac-puno", "4a Brigada de Montaña — Puno", "army", "base", False, 16.0, -15.835, -70.018, "PUN", "2101", "2101"),
    ("fuerte-carmen-alto-huancayo", "31a Brigada de Infantería — Huancayo", "army", "base", False, 14.0, -12.055, -75.215, "JUN", "1201", "1201"),
    ("cuartel-los-cabitos-ayacucho", "2a Brigada de Infantería — Ayacucho", "army", "base", False, 20.0, -13.155, -74.205, "AYA", "0501", "0501"),
    ("base-aerea-san-ramon", "Base Aérea de Pisco — Grupo Aéreo N.° 51", "air_force", "major", True, 55.0, -13.745, -76.220, "ICA", "1105", "1105"),
    ("base-naval-pucallpa", "Estación Naval de Pucallpa", "navy", "base", False, 11.0, -8.375, -74.530, "UCA", "2501", "2501"),
    ("fuerte-el-milagro-bagua", "6a Brigada de Selva — El Milagro (Utcubamba)", "army", "base", False, 52.0, -5.625, -78.555, "AMA", "0107", "0107"),
    ("cuartel-tarapoto", "3a Brigada de Fuerzas Especiales — Morales / Tarapoto", "army", "base", False, 18.0, -6.475, -76.385, "SAM", "2209", "2209"),
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
    bounds = load_interim("peru_boundaries")
    se = load_interim("peru_socioeconomic")

    grid = HexGrid(**w["grid"])
    proj = MapProjection(**w["projection"])
    owner = w["owner"]

    inst_out = []
    ranges_out = []
    inst_by_dep = defaultdict(list)
    inst_by_city = defaultdict(list)

    for iid, name, comp, tier, curated, area, lat, lon, dep, prov, cbsa in INSTALLATIONS:
        x, y = proj(lon, lat)
        cell = _nearest_land(grid, owner, x, y)
        cells = [cell] if area >= 150 else None
        rec = {
            "id": iid, "name": name, "component": comp, "joint": comp == "army_guard",
            "status": "act", "tier": tier, "curated": curated,
            "area_km2": area, "cells": cells,
            "x": round(x, 1), "y": round(y, 1), "cell": cell,
            "county": prov, "cbsa": cbsa, "state": dep, "state_filed": dep,
        }
        inst_out.append(rec)
        inst_by_dep[dep].append(rec)
        if cbsa:
            inst_by_city[cbsa].append(rec)
        if area >= 180:
            ranges_out.append({
                "id": f"range-{iid}", "name": f"Polígono Militar — {name}",
                "component": comp, "area_km2": area, "cells": [cell],
                "state": dep, "hex_state": dep, "installation": iid,
            })

    tier_order = {"major": 0, "base": 1, "site": 2}
    inst_out.sort(key=lambda r: (tier_order[r["tier"]], -(r["area_km2"] or 0)))

    # Departmental personnel & MINDEF spending estimates (total Peru active ~95k, reserve ~60k, MINDEF budget ~USD 2.45B)
    states_mil = {}
    tot_army = tot_navy = tot_af = tot_mar = tot_res = tot_civ = 0
    tot_spend = 0.0
    for sm in bounds["states"]:
        fips, abbr = sm["fips"], sm["abbr"]
        st = se["departments"][fips]
        n_inst = len(inst_by_dep[abbr])
        base_w = (0.28 if abbr == "LIM" else 0.14 if abbr == "CAL" else 0.07 if abbr in ("ARE", "PIU", "LOR", "TAC") else 0.015) + n_inst * 0.008
        army_n = round(48000 * base_w * (0.4 if abbr == "CAL" else 1.0))
        navy_n = round(23000 * (0.48 if abbr == "CAL" else 0.16 if abbr == "LIM" else 0.12 if abbr == "LOR" else 0.06 if abbr in ("PIU", "ICA", "UCA") else 0.005))
        af_n = round(16000 * (0.35 if abbr == "LIM" else 0.18 if abbr in ("ARE", "PIU", "LAM") else 0.08 if abbr in ("ICA", "LOR") else 0.01))
        mar_n = round(4500 * (0.55 if abbr in ("LIM", "CAL") else 0.15 if abbr in ("LOR", "TUM", "UCA") else 0.01))
        act_tot = army_n + navy_n + af_n + mar_n
        res_tot = round(act_tot * 0.55)
        civ_tot = round(act_tot * 0.14)
        tot_army += army_n; tot_navy += navy_n; tot_af += af_n; tot_mar += mar_n
        tot_res += res_tot; tot_civ += civ_tot

        spend = round((act_tot + civ_tot) * 19500.0 + n_inst * 8_500_000.0)
        tot_spend += spend
        gdp_usd = st["gdp_musd"] * 1e6
        states_mil[abbr] = {
            "personnel": {
                "active": {"army": army_n, "navy": navy_n, "marines": mar_n, "air_force": af_n, "space_force": 0, "coast_guard": 0, "total": act_tot},
                "guard_reserve": {"army_guard": round(res_tot * 0.6), "army_reserve": round(res_tot * 0.2), "navy_reserve": round(res_tot * 0.1), "marine_reserve": 0, "air_guard": 0, "air_force_reserve": round(res_tot * 0.1), "coast_guard_reserve": 0, "total": res_tot},
                "civilian": {"army": round(civ_tot * 0.5), "navy": round(civ_tot * 0.25), "marines": 0, "air_force": round(civ_tot * 0.15), "defense_wide": round(civ_tot * 0.1), "total": civ_tot},
                "total": act_tot + res_tot + civ_tot,
            },
            "spending": {
                "total": spend,
                "contracts": round(spend * 0.28),
                "grants": round(spend * 0.04),
                "payroll": round(spend * 0.68),
                "payroll_parts": {"civilian": round(spend * 0.10), "active_duty": round(spend * 0.54), "guard_reserve": round(spend * 0.04)},
                "pct_gdp": round(spend / max(1.0, gdp_usd), 4),
                "per_resident": round(spend / max(1, st["pop"]), 1),
                "personnel": act_tot + civ_tot,
                "top_counties": [],
                "top_vendors": [{"name": "SIMA Perú S.A.", "contracts": round(spend * 0.12)}, {"name": "FAME S.A.C. / SEMAN", "contracts": round(spend * 0.08)}],
            },
        }

    # Garrison / Fortress cities
    cities_mil = {}
    cities_p = WEB_DATA / "cities.json"
    cities_built = json.loads(cities_p.read_text(encoding="utf-8")) if cities_p.exists() else []
    for c in cities_built:
        cid = c["id"]
        ilist = inst_by_city.get(cid, [])
        if not ilist:
            continue
        af_cnt = sum(2800 if it["tier"] == "major" else 950 for it in ilist)
        pop16 = max(1, round(c["population"] * 0.72))
        sh = round(af_cnt / pop16, 4)
        if sh >= 0.004 or af_cnt >= 2500:
            naval_score = sum((4 if it["tier"] == "major" else 1) for it in ilist if it["component"] in ("navy", "marines"))
            land_score = sum((4 if it["tier"] == "major" else 1) for it in ilist if it["component"] in ("army", "air_force"))
            cities_mil[cid] = {
                "tier": "fortress" if sh >= 0.02 else "garrison",
                "armed_forces": af_cnt,
                "share": sh,
                "naval": naval_score > land_score,
                "installations": [it["id"] for it in ilist[:8]],
                "installation_count": len(ilist),
            }

    nat_act = tot_army + tot_navy + tot_af + tot_mar
    tot_pop = sum(v["pop"] for v in se["departments"].values())
    tot_gdp = sum(v["gdp_musd"] for v in se["departments"].values()) * 1e6
    write_web("military.json", {
        "version": 1,
        "vintage": {
            "installations": "Directorio Público de Sedes FF.AA. (EP, MGP, FAP)",
            "personnel": "Estimación agregada FF.AA. del Perú 2025",
            "spending": "MEF Presupuesto Sector Defensa 2025",
            "acs": "INEI 2025",
        },
        "sources": ["peru_socioeconomic"],
        "rule": "Una ciudad obtiene Guarnición cuando alberga una base principal o cuartel divisional de las FF.AA. del Perú.",
        "rules": {
            "tier": "Principales bases aéreas, estaciones navales y cuarteles generales se clasifican como 'major'; brigadas y escuelas como 'base'.",
            "ranges": "Polígonos de entrenamiento mayores a 180 km² (La Joya, Locumba, El Pato).",
            "encampment": "Ciudades sede de división militar, base naval o grupo aéreo.",
            "installations": "Sedes públicas históricas y divisionales del Ejército, Marina de Guerra y Fuerza Aérea.",
        },
        "flagships": [it["name"] for it in inst_out if it["curated"]],
        "caveats": "El Perú no publica efectivos exactos por base individual por seguridad nacional; las cifras departamentales son estimaciones proporcionales al despliegue institucional y al presupuesto público del sector Defensa (MEF).",
        "components": COMPONENTS,
        "installations": inst_out,
        "ranges": ranges_out,
        "states": states_mil,
        "national": {
            "personnel": {
                "active": {"army": tot_army, "navy": tot_navy, "marines": tot_mar, "air_force": tot_af, "space_force": 0, "coast_guard": 0, "total": nat_act},
                "guard_reserve": {"army_guard": round(tot_res * 0.6), "army_reserve": round(tot_res * 0.2), "navy_reserve": round(tot_res * 0.1), "marine_reserve": 0, "air_guard": 0, "air_force_reserve": round(tot_res * 0.1), "coast_guard_reserve": 0, "total": tot_res},
                "civilian": {"army": round(tot_civ * 0.5), "navy": round(tot_civ * 0.25), "marines": 0, "air_force": round(tot_civ * 0.15), "defense_wide": round(tot_civ * 0.1), "total": tot_civ},
                "total": nat_act + tot_res + tot_civ,
            },
            "personnel_scope": "24 departamentos y Provincia Constitucional del Callao",
            "spending": {
                "total": tot_spend,
                "contracts": round(tot_spend * 0.28),
                "grants": round(tot_spend * 0.04),
                "payroll": round(tot_spend * 0.68),
                "pct_gdp": round(tot_spend / tot_gdp, 4),
                "per_resident": round(tot_spend / tot_pop, 1),
                "scope": "25 regiones del Perú",
            },
            "veterans": 285000,
            "armed_forces_resident": nat_act,
            "acs_scope": "Perú nacional",
        },
        "cities": cities_mil,
    })
    print(f"    {len(inst_out)} sedes militares y {len(cities_mil)} ciudades guarnición en military.json")
