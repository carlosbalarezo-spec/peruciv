"""Build nation.json, states.json (25 regiones) and cities.json (48 principales ciudades del Perú)."""

from __future__ import annotations

import math
from collections import defaultdict

from ..core.geo import MapProjection
from ..core.hexgrid import HexGrid
from ..core.store import load_interim, write_web

REQUIRES = ["_world", "_resources", "peru_boundaries", "peru_socioeconomic", "mincul_rentoca"]
PRODUCES = ["nation.json", "states.json", "cities.json"]

YIELDS_META = [
    {"key": "food", "icon": "y-food", "emoji": "🌾", "label": "Alimentos", "color": "#7fbf3f", "unit": "workers",
     "description": "Empleo en agricultura, ganadería, silvicultura y pesca (INEI)."},
    {"key": "production", "icon": "y-production", "emoji": "⚙️", "label": "Producción", "color": "#d9822b", "unit": "workers",
     "description": "Empleo en minería, manufactura, construcción, energía y transporte (INEI)."},
    {"key": "gold", "icon": "y-gold", "emoji": "🪙", "label": "Oro", "color": "#e5b83b", "unit": "usd",
     "description": "Producto Bruto Interno (PBI) anual en dólares corrientes (INEI PBI Departamental 2024)."},
    {"key": "science", "icon": "y-science", "emoji": "🔬", "label": "Ciencia", "color": "#4ea8de", "unit": "workers",
     "description": "Empleo en educación superior, salud, ingeniería y servicios profesionales (INEI)."},
    {"key": "culture", "icon": "y-culture", "emoji": "🎭", "label": "Cultura", "color": "#b565d9", "unit": "workers",
     "description": "Trabajadores en arte, cultura, gastronomía, turismo y patrimonio (INEI / RENTOCA)."},
]

INDUSTRIES = {
    "agriculture": "Agricultura, ganadería y pesca",
    "mining": "Minería e hidrocarburos",
    "manufacturing": "Manufactura e industria",
    "construction": "Construcción e infraestructura",
    "retail": "Comercio mayorista y minorista",
    "transportation": "Transporte, puertos y logística",
    "finance": "Banca, finanzas y seguros",
    "professional": "Servicios profesionales, ingeniería y TI",
    "education": "Educación superior y enseñanza",
    "health": "Salud y asistencia social",
    "accommodation": "Hotelería, gastronomía y turismo",
    "arts": "Arte, cultura y patrimonio",
    "public_admin": "Administración pública",
}


def _nearest_land_cell(grid: HexGrid, owner: list[int], x: float, y: float, taken: set[int] | None = None) -> int:
    c = grid.cell_at(x, y)
    if c >= 0 and owner[c] >= 0 and (taken is None or c not in taken):
        return c
    best, best_d = -1, 1e18
    for i, o in enumerate(owner):
        if o < 0 or (taken is not None and i in taken):
            continue
        cx, cy = grid.center(*grid.col_row(i))
        d = math.hypot(cx - x, cy - y)
        if d < best_d:
            best_d, best = d, i
    return best


def _rank_list(items: list[dict], key_fn, pop_fn) -> list[int | None]:
    indexed = [(i, key_fn(it), pop_fn(it)) for i, it in enumerate(items)]
    valid = [x for x in indexed if x[1] is not None]
    valid.sort(key=lambda x: (-x[1], -x[2]))
    ranks: list[int | None] = [None] * len(items)
    for r, (i, _, _) in enumerate(valid, 1):
        ranks[i] = r
    return ranks


def _econ_breakdowns(fips: str, st: dict, employed: int, gdp_usd: float, cult_bonus: int, is_urban: bool = False) -> tuple[dict, dict, dict]:
    is_mining_dep = fips in ("02", "03", "04", "06", "08", "11", "12", "18", "19", "21", "23")
    agri_sh = max(0.02, st["agri"] * (0.42 if is_urban else 1.0))
    ind_sh = st["ind"] * (1.08 if is_urban else 1.0)
    sci_sh = st["sci"] * (1.22 if is_urban else 1.0)
    cult_sh = st["cult"] * (1.25 if is_urban else 1.0)

    food = max(100, round(employed * agri_sh))
    prod = max(100, round(employed * ind_sh))
    sci = max(50, round(employed * sci_sh))
    cult = max(30, round(employed * cult_sh)) + cult_bonus

    min_w = 0.28 if is_mining_dep else 0.08
    jobs = {
        "agriculture": food,
        "mining": max(20, round(prod * min_w)),
        "manufacturing": max(50, round(prod * (0.42 - min_w * 0.4))),
        "construction": max(50, round(prod * 0.28)),
        "transportation": max(50, round(prod * 0.20)),
        "professional": max(30, round(sci * 0.34)),
        "education": max(40, round(sci * 0.38)),
        "health": max(30, round(sci * 0.28)),
        "arts": max(20, round(cult * 0.38)),
        "accommodation": max(30, round(cult * 0.62)),
    }
    rem = max(200, employed - sum(jobs.values()))
    jobs["retail"] = round(rem * 0.68)
    jobs["finance"] = round(rem * 0.14)
    jobs["public_admin"] = max(50, rem - jobs["retail"] - jobs["finance"])

    # GDP by industry (reflecting high capital intensity in mining & finance)
    gdp_weights = {
        "mining": jobs["mining"] * (6.5 if is_mining_dep else 2.5),
        "manufacturing": jobs["manufacturing"] * 1.65,
        "construction": jobs["construction"] * 1.35,
        "agriculture": jobs["agriculture"] * 0.55,
        "retail": jobs["retail"] * 0.95,
        "transportation": jobs["transportation"] * 1.25,
        "finance": jobs["finance"] * 2.8,
        "professional": jobs["professional"] * 1.9,
        "education": jobs["education"] * 0.95,
        "health": jobs["health"] * 1.05,
        "accommodation": jobs["accommodation"] * 0.90,
        "arts": jobs["arts"] * 0.75,
        "public_admin": jobs["public_admin"] * 1.15,
    }
    gw_sum = sum(gdp_weights.values()) or 1.0
    gdp_by_ind = {k: round(gdp_usd * v / gw_sum) for k, v in gdp_weights.items()}
    yields = {"food": food, "production": prod, "gold": gdp_usd, "science": sci, "culture": cult}
    return yields, jobs, gdp_by_ind


def build() -> None:
    w = load_interim("_world")
    res_doc = load_interim("_resources")
    bounds = load_interim("peru_boundaries")
    se = load_interim("peru_socioeconomic")
    rentoca = load_interim("mincul_rentoca")

    grid = HexGrid(**w["grid"])
    proj = MapProjection(**w["projection"])
    owner = w["owner"]
    county_samples = w["county_samples"]
    pct = w["pct"]
    state_fips_list = w["states"]
    county_geoids = w["counties"]
    geoid_to_idx = {g: i for i, g in enumerate(county_geoids)}

    dep_meta = {s["fips"]: s for s in bounds["states"]}
    dep_stats = se["departments"]

    mw_types = [t["id"] for t in res_doc["types"] if t["unit"] == "MW"]
    mw_by_state = defaultdict(lambda: {t: [0, 0] for t in mw_types})
    for it in res_doc["items"]:
        if it["type"] in mw_types and it.get("state"):
            rec = mw_by_state[it["state"]][it["type"]]
            rec[0] += it["value"] or 0
            rec[1] += 1

    state_cells: dict[int, list[int]] = defaultdict(list)
    for i, o in enumerate(owner):
        if o >= 0:
            state_cells[o].append(i)

    states_out = []
    nat_pop = nat_pop21 = nat_emp = 0
    nat_gdp = 0.0
    nat_yields = {"food": 0, "production": 0, "gold": 0.0, "science": 0, "culture": 0}
    nat_jobs = defaultdict(int)
    nat_gdp_ind = defaultdict(float)

    for idx, fips in enumerate(state_fips_list):
        st = dep_stats[fips]
        meta = dep_meta[fips]
        abbr = meta["abbr"]
        pop = st["pop"]
        pop21 = st["pop21"]
        employed = round(pop * 0.52 * (1.0 - st["unemp"]))
        gdp_usd = round(st["gdp_musd"] * 1e6)
        yields, jobs, gdp_by_ind = _econ_breakdowns(fips, st, employed, gdp_usd, rentoca["by_dep"].get(fips, 0), False)

        inc_usd = round(st["income"] * 12 / 3.75)
        rent_usd = round(inc_usd / 12 * (0.26 if fips in ("15", "07", "04") else 0.19))
        home_usd = round(inc_usd * (6.8 if fips in ("15", "07", "04") else 4.6))
        rent_burden = round((rent_usd * 12) / max(1, inc_usd), 3)

        nat_pop += pop; nat_pop21 += pop21; nat_emp += employed; nat_gdp += gdp_usd
        for k in ("food", "production", "science", "culture"):
            nat_yields[k] += yields[k]
        nat_yields["gold"] += gdp_usd
        for k, v in jobs.items():
            nat_jobs[k] += v
        for k, v in gdp_by_ind.items():
            nat_gdp_ind[k] += v

        cells = state_cells.get(idx, [])
        if cells:
            xs = [grid.center(*grid.col_row(c))[0] for c in cells]
            ys = [grid.center(*grid.col_row(c))[1] for c in cells]
            span = max(max(xs) - min(xs), max(ys) - min(ys), 30.0)
            label = {"x": round(sum(xs) / len(xs), 1), "y": round(sum(ys) / len(ys), 1), "angle": 0, "size": round(min(70.0, max(16.0, span * 0.14)), 1)}
            land = {k: round(sum(pct[k][c] for c in cells) / (100.0 * len(cells)), 3) for k in pct}
        else:
            label = None; land = None

        eb = mw_by_state[abbr]
        by_t = {t: eb[t][0] for t in mw_types}
        sites_t = {t: eb[t][1] for t in mw_types}
        energy_obj = {
            "unit": "MW",
            "total": sum(by_t.values()),
            "by_type": by_t,
            "sites": sites_t,
            "note": "Solo incluye las centrales principales mapeadas en resources.json (MINEM).",
        }

        states_out.append({
            "fips": fips, "abbr": abbr, "name": meta["name"],
            "population": pop, "employed": employed,
            "yields": yields, "jobs": jobs,
            "median_income": inc_usd, "median_rent": rent_usd, "home_value": home_usd,
            "unemployment": st["unemp"], "rent_burden": rent_burden,
            "gdp": gdp_usd, "gdp_year": se["gdp_year"], "gdp_by_industry": gdp_by_ind,
            "growth": round(pop / pop21 - 1.0, 4), "growth_years": [2021, 2025],
            "label": label, "land": land, "energy": energy_obj, "ranks": {},
        })

    for yk in ("food", "production", "gold", "science", "culture"):
        rk = _rank_list(states_out, lambda s, k=yk: s["yields"][k], lambda s: s["population"])
        for s, r in zip(states_out, rk):
            s["ranks"][yk] = r

    nat_inc = round(sum(s["median_income"] * s["population"] for s in states_out) / nat_pop)
    nat_rent = round(sum(s["median_rent"] * s["population"] for s in states_out) / nat_pop)
    nat_home = round(sum(s["home_value"] * s["population"] for s in states_out) / nat_pop)
    nation_obj = {
        "population": nat_pop, "employed": nat_emp,
        "yields": nat_yields, "jobs": dict(nat_jobs),
        "median_income": nat_inc, "median_rent": nat_rent, "home_value": nat_home,
        "unemployment": round(sum(s["unemployment"] * s["population"] for s in states_out) / nat_pop, 4),
        "rent_burden": round((nat_rent * 12) / nat_inc, 3),
        "gdp": nat_gdp, "gdp_year": se["gdp_year"],
        "gdp_by_industry": {k: round(v) for k, v in nat_gdp_ind.items()},
        "growth": round(nat_pop / nat_pop21 - 1.0, 4), "growth_years": [2021, 2025],
    }

    write_web("nation.json", {
        "vintage": "INEI Proyecciones 2025 / ENAHO 2025",
        "year": 2025,
        "gdp_vintage": "INEI PBI Departamental 2024",
        "nation": nation_obj,
        "yields": YIELDS_META,
        "industries": INDUSTRIES,
        "gdp_industries": INDUSTRIES,
    })
    write_web("states.json", states_out)

    abbr_to_fips = {s["abbr"]: s["fips"] for s in states_out}
    taken: set[int] = set()
    cities_out = []
    for c in sorted(se["cities"], key=lambda x: -x["pop"]):
        x, y = proj(c["lon"], c["lat"])
        cell = _nearest_land_cell(grid, owner, x, y, taken)
        taken.add(cell)

        primary_fips = abbr_to_fips[c["deps"][0]]
        st = dep_stats[primary_fips]
        dep_pop = sum(dep_stats[abbr_to_fips[a]]["pop"] for a in c["deps"])
        dep_gdp = sum(dep_stats[abbr_to_fips[a]]["gdp_musd"] for a in c["deps"]) * 1e6
        pop_share = min(1.0, c["pop"] / max(1, dep_pop))
        gdp_usd = round(dep_gdp * min(0.95, pop_share * 1.18))
        employed = round(c["pop"] * 0.53 * (1.0 - st["unemp"]))
        cult_b = sum(rentoca["by_prov"].get(p, 0) for p in c["provs"])
        yields, jobs, gdp_by_ind = _econ_breakdowns(primary_fips, st, employed, gdp_usd, cult_b, True)

        inc_usd = round(st["income"] * 12 / 3.75 * (1.14 if c.get("metro") else 1.03))
        rent_usd = round(inc_usd / 12 * (0.28 if c["id"] == "1501" else 0.23 if c.get("metro") else 0.18))
        home_usd = round(inc_usd * (7.4 if c["id"] == "1501" else 5.8 if c.get("metro") else 4.5))
        rent_burden = round((rent_usd * 12) / max(1, inc_usd), 3)

        member_idxs = {geoid_to_idx[p] for p in c["provs"] if p in geoid_to_idx}
        fp = [
            i for i, smp in enumerate(county_samples)
            if owner[i] >= 0 and smp and sum(1 for k in smp if k in member_idxs) >= 4
        ]
        if cell not in fp:
            fp.append(cell)
        fp.sort()

        cities_out.append({
            "id": c["id"], "name": c["name"], "full": c["full"],
            "states": c["deps"], "metro": bool(c.get("metro")), "capital": bool(c.get("capital", False)),
            "x": round(x, 1), "y": round(y, 1), "cell": cell,
            "population": c["pop"], "employed": employed,
            "yields": yields, "jobs": jobs,
            "median_income": inc_usd, "median_rent": rent_usd, "home_value": home_usd,
            "unemployment": st["unemp"], "rent_burden": rent_burden,
            "gdp": gdp_usd, "gdp_year": se["gdp_year"], "gdp_by_industry": gdp_by_ind,
            "growth": round(c["pop"] / c["pop21"] - 1.0, 4), "growth_years": [2021, 2025],
            "counties": sorted(c["provs"]), "footprint": fp,
            "pop_series": {"2021": c["pop21"], "2023": round((c["pop21"] + c["pop"]) / 2), "2025": c["pop"]},
            "ranks": {}, "peers": [],
        })

    for key, fn in (
        ("population", lambda c: c["population"]),
        ("gdp", lambda c: c["gdp"]),
        ("gdp_per_capita", lambda c: c["gdp"] / c["population"] if c["population"] else None),
        ("growth", lambda c: c["growth"]),
        ("food", lambda c: c["yields"]["food"]),
        ("production", lambda c: c["yields"]["production"]),
        ("gold", lambda c: c["yields"]["gold"]),
        ("science", lambda c: c["yields"]["science"]),
        ("culture", lambda c: c["yields"]["culture"]),
    ):
        rk = _rank_list(cities_out, fn, lambda c: c["population"])
        for c, r in zip(cities_out, rk):
            c["ranks"][key] = r

    for c in cities_out:
        peers = sorted(
            [o for o in cities_out if o["id"] != c["id"]],
            key=lambda o: abs(math.log(c["population"] / o["population"])),
        )[:5]
        c["peers"] = [o["id"] for o in peers]

    write_web("cities.json", cities_out)
    print(f"    {len(states_out)} regiones, {len(cities_out)} ciudades escritas con PBI sectorial")
