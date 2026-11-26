"""Build disasters.json: emergencias históricas INDECI SINPAD (2003–2025) y grandes desastres del Perú."""

from __future__ import annotations

from ..core.store import load_interim, write_web

REQUIRES = ["peru_boundaries", "indeci_emergencies"]
PRODUCES = ["disasters.json"]

# Historic major disasters in Peru (INDECI / MEF / CAF / CEPAL)
HISTORIC_MEGA_DISASTERS = [
    {"name": "Fenómeno El Niño Costero (2017)", "type": "El Niño e inundaciones", "begin": "2017-01-15", "cost_usd": 3.1e9, "deaths": 162},
    {"name": "Fenómeno El Niño Extraordinario (1997–1998)", "type": "El Niño e inundaciones", "begin": "1997-12-01", "cost_usd": 3.5e9, "deaths": 366},
    {"name": "Fenómeno El Niño Extraordinario (1982–1983)", "type": "El Niño y sequía sur", "begin": "1982-11-01", "cost_usd": 3.2e9, "deaths": 512},
    {"name": "Terremoto de Pisco e Ica (Mw 8.0, 2007)", "type": "Sismo y tsunami", "begin": "2007-08-15", "cost_usd": 1.2e9, "deaths": 596},
    {"name": "Ciclón Yaku y El Niño Costero (2023)", "type": "Lluvias intensas y huaicos", "begin": "2023-03-07", "cost_usd": 1.3e9, "deaths": 99},
    {"name": "Terremoto del Sur — Arequipa, Moquegua y Tacna (2001)", "type": "Sismo Mw 8.4", "begin": "2001-06-23", "cost_usd": 0.55e9, "deaths": 145},
    {"name": "Grandes Inundaciones Amazónicas — Loreto (2012)", "type": "Inundación fluvial", "begin": "2012-03-10", "cost_usd": 0.35e9, "deaths": 18},
    {"name": "Terremoto de Amazonas (Mw 7.5, 2021)", "type": "Sismo", "begin": "2021-11-28", "cost_usd": 0.22e9, "deaths": 12},
]


def build() -> None:
    bounds = load_interim("peru_boundaries")
    ind = load_interim("indeci_emergencies")

    fips_to_abbr = {s["fips"]: s["abbr"] for s in bounds["states"]}
    counties_meta = sorted(bounds["counties"], key=lambda c: c["geoid"])
    by_prov = ind["by_prov"]
    by_dep = ind["by_dep"]

    types = [
        {"id": "flood", "name": "Lluvias intensas e inundaciones", "incident_types": ["Lluvias intensas", "Inundación", "Desborde"]},
        {"id": "hurricane", "name": "Huaicos, aluviones y deslizamientos", "incident_types": ["Huaico", "Deslizamiento", "Aluvión", "Derrumbe"]},
        {"id": "winter", "name": "Heladas, friajes y granizadas", "incident_types": ["Helada", "Friaje", "Nevada", "Granizada"]},
        {"id": "fire", "name": "Incendios forestales y urbanos", "incident_types": ["Incendio forestal", "Incendio urbano"]},
        {"id": "severe_storm", "name": "Vientos fuertes y tormentas", "incident_types": ["Vientos fuertes", "Tempestad eléctrica"]},
        {"id": "other", "name": "Sismos, sequías y otros peligros", "incident_types": []},
    ]

    cols = ["geoid", "total", "hurricane", "flood", "fire", "severe_storm", "winter", "other", "last_date"]
    c_rows = []
    for c in counties_meta:
        gid = c["geoid"]
        r = by_prov.get(gid, {})
        c_rows.append([
            gid,
            r.get("total", 0),
            r.get("hurricane", 0),
            r.get("flood", 0),
            r.get("fire", 0),
            r.get("severe_storm", 0),
            r.get("winter", 0),
            r.get("other", 0),
            r.get("last_date"),
        ])

    states_fema = {}
    states_noaa = {}
    noaa_types = [
        {"id": "flooding", "name": "Lluvias e inundaciones"},
        {"id": "tropical_cyclone", "name": "Huaicos y El Niño"},
        {"id": "freeze", "name": "Heladas y friajes"},
        {"id": "wildfire", "name": "Incendios"},
        {"id": "severe_storm", "name": "Vientos y tormentas"},
        {"id": "drought", "name": "Sequías y sismos"},
        {"id": "winter_storm", "name": "Nevadas altoandinas"},
    ]

    for fips, abbr in fips_to_abbr.items():
        d = by_dep.get(fips, {})
        states_fema[abbr] = {
            "total": d.get("total", 0),
            "statewide": 0,
            "by_type": {
                "hurricane": d.get("hurricane", 0),
                "flood": d.get("flood", 0),
                "fire": d.get("fire", 0),
                "severe_storm": d.get("severe_storm", 0),
                "winter": d.get("winter", 0),
                "other": d.get("other", 0),
            },
        }
        # Estimate cumulative economic damage in USD from damnificados & emergency volume
        dam = d.get("damnificados", 0)
        est_cost = max(5e6, dam * 4500.0)
        tot = max(1, d.get("total", 1))
        states_noaa[abbr] = {
            "count": {
                "flooding": d.get("flood", 0),
                "tropical_cyclone": d.get("hurricane", 0),
                "freeze": d.get("winter", 0),
                "wildfire": d.get("fire", 0),
                "severe_storm": d.get("severe_storm", 0),
                "drought": d.get("other", 0),
                "winter_storm": 0,
            },
            "cost_usd": {
                "flooding": round(est_cost * d.get("flood", 0) / tot),
                "tropical_cyclone": round(est_cost * d.get("hurricane", 0) / tot),
                "freeze": round(est_cost * d.get("winter", 0) / tot),
                "wildfire": round(est_cost * d.get("fire", 0) / tot),
                "severe_storm": round(est_cost * d.get("severe_storm", 0) / tot),
                "drought": round(est_cost * d.get("other", 0) / tot),
                "winter_storm": 0,
            },
        }

    recent_out = []
    for ev in ind.get("recent", []):
        abbr = fips_to_abbr.get(ev["dep"], "LIM")
        recent_out.append({
            "disaster": ev["id"],
            "type": ev["type"],
            "incident_type": ev["incident_type"],
            "title": ev["title"],
            "date": ev["date"],
            "state": abbr,
            "counties": [ev["prov"]],
            "statewide": False,
            "areas": 1,
        })

    by_year_out = []
    total_fallecidos = 0
    for yr_s, yd in ind.get("by_year", {}).items():
        total_fallecidos += yd.get("fallecidos", 0)
        by_year_out.append({
            "year": int(yr_s),
            "events": yd["events"],
            "cost_usd": round(max(2e7, yd.get("damnificados", 0) * 4200.0)),
        })

    write_web("disasters.json", {
        "version": 1,
        "sources": ["indeci_emergencies"],
        "vintage": {
            "fema": ind.get("vintage", "INDECI SINPAD 2003–2025 (PNDA)"),
            "noaa": "Grandes Desastres Históricos del Perú (INDECI / MEF / CEPAL, 1982–2025)",
        },
        "fema": {
            "window": ["2003-01-01", ind["as_of"]],
            "as_of": ind["as_of"],
            "rule": "Emergencias registradas en el sistema SINPAD del INDECI por distrito y agregadas a las 196 provincias (2003–2025).",
            "types": types,
            "counties": {"columns": cols, "rows": c_rows},
            "states": states_fema,
            "recent_days": 365,
            "recent": recent_out,
        },
        "noaa": {
            "years": [1982, 2025],
            "final": True,
            "unit": "USD estimados",
            "rule": "Principales megadesastres climáticos y sísmicos en el Perú (Fenómeno El Niño, grandes terremotos e inundaciones).",
            "types": noaa_types,
            "states": states_noaa,
            "national": {
                "events": sum(d.get("total", 0) for d in by_dep.values()),
                "cost_usd": sum(x["cost_usd"] for x in HISTORIC_MEGA_DISASTERS),
                "deaths": max(total_fallecidos, sum(x["deaths"] for x in HISTORIC_MEGA_DISASTERS)),
                "by_year": by_year_out,
                "costliest": sorted(HISTORIC_MEGA_DISASTERS, key=lambda x: -x["cost_usd"]),
            },
        },
    })
    print(f"    disasters.json escrito ({len(c_rows)} provincias, {len(recent_out)} eventos recientes)")
