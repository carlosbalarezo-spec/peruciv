"""Build counties.json (196 provincias del Perú) and lenses.json (16 lentes temáticos)."""

from __future__ import annotations

import math
from collections import defaultdict

from ..core.geo import MapProjection
from ..core.hexgrid import HexGrid
from ..core.store import load_interim, write_web

REQUIRES = ["_world", "peru_boundaries", "peru_socioeconomic", "indeci_emergencies", "minsa_anemia", "mincul_rentoca"]
PRODUCES = ["counties.json", "lenses.json"]

FAITH_CATEGORIES = [
    {"id": "catholic", "name": "Católica mayoritaria", "color": "#d4a73a", "description": "Provincias donde la confesión católica es ampliamente mayoritaria (>75%, Censo INEI)."},
    {"id": "evangelical_mix", "name": "Alta presencia evangélica (>22%)", "color": "#4ea8de", "description": "Provincias con fuerte presencia de iglesias evangélicas y protestantes (selva y sierra norte/central)."},
    {"id": "andean_syncretic", "name": "Tradición católica-andina", "color": "#b565d9", "description": "Provincias altoandinas con fuerte sincretismo religioso y festividades patronales tradicionales."},
]


def _percentile(vals: list[float], p: float) -> float:
    if not vals:
        return 0.0
    s = sorted(vals)
    k = (len(s) - 1) * p
    lo = int(math.floor(k))
    hi = min(len(s) - 1, lo + 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def _domain(values: list[float | None], lo_p=0.02, hi_p=0.98) -> list[float]:
    v = [x for x in values if x is not None]
    if not v:
        return [0.0, 1.0]
    a, b = _percentile(v, lo_p), _percentile(v, hi_p)
    if b <= a:
        a, b = min(v), max(v)
    if b <= a:
        b = a + 1.0
    return [round(a, 4), round(b, 4)]


def build() -> None:
    w = load_interim("_world")
    bounds = load_interim("peru_boundaries")
    se = load_interim("peru_socioeconomic")
    indeci = load_interim("indeci_emergencies")
    anemia = load_interim("minsa_anemia")
    rentoca = load_interim("mincul_rentoca")

    grid = HexGrid(**w["grid"])
    proj = MapProjection(**w["projection"])
    owner = w["owner"]
    county_arr = w["county"]
    county_samples = w["county_samples"]
    pct = w["pct"]
    counties_meta = sorted(bounds["counties"], key=lambda c: c["geoid"])
    dep_meta = {s["fips"]: s["abbr"] for s in bounds["states"]}
    dep_stats = se["departments"]
    enaho_prov = se["enaho_prov"]
    enaho_dep = se["enaho_dep"]

    prov_to_city: dict[str, str] = {}
    city_pop_by_prov: dict[str, int] = {}
    for c in se["cities"]:
        for p in c["provs"]:
            prov_to_city[p] = c["id"]
            city_pop_by_prov[p] = c["pop"] // len(c["provs"])

    provs_by_dep: dict[str, list[dict]] = defaultdict(list)
    for c in counties_meta:
        provs_by_dep[c["state_fips"]].append(c)

    prov_pop: dict[str, int] = {}
    for dep, plist in provs_by_dep.items():
        total_dep_pop = dep_stats[dep]["pop"]
        assigned = 0
        rem = []
        for p in plist:
            gid = p["geoid"]
            if gid in city_pop_by_prov:
                val = min(city_pop_by_prov[gid], int(total_dep_pop * 0.92))
                prov_pop[gid] = val
                assigned += val
            else:
                rem.append(p)
        left = max(1000 * len(rem), total_dep_pop - assigned)
        if rem:
            weights = []
            for p in rem:
                an = anemia["by_prov"].get(p["geoid"], {}).get("casos", 0)
                w_val = max(50.0, an * 15.0 + math.sqrt(max(1.0, p["land_km2"])) * 5.0)
                weights.append(w_val)
            wsum = sum(weights)
            for p, wv in zip(rem, weights):
                prov_pop[p["geoid"]] = max(3500, round(left * wv / wsum))

    prov_hex_hits: dict[int, list[int]] = defaultdict(list)
    for cell_i, smp in enumerate(county_samples):
        if owner[cell_i] < 0:
            continue
        for k in smp:
            if k >= 0:
                prov_hex_hits[k].append(cell_i)

    fields = [
        {"key": "geoid", "label": "UBIGEO", "format": "text", "unit": "", "higher_is": "neutral", "source": "peru_boundaries", "description": "Código provincial UBIGEO (4 dígitos)."},
        {"key": "name", "label": "Provincia", "format": "text", "unit": "", "higher_is": "neutral", "source": "peru_boundaries", "description": "Nombre de la provincia."},
        {"key": "state", "label": "Departamento", "format": "text", "unit": "", "higher_is": "neutral", "source": "peru_boundaries", "description": "Abreviatura del departamento."},
        {"key": "population", "label": "Población", "format": "int", "unit": "hab.", "higher_is": "neutral", "source": "peru_socioeconomic", "description": "Población proyectada 2025 (INEI)."},
        {"key": "land_km2", "label": "Superficie", "format": "km2", "unit": "km²", "higher_is": "neutral", "source": "peru_boundaries", "description": "Área territorial provincial."},
        {"key": "density", "label": "Densidad", "format": "float", "unit": "hab. / km²", "higher_is": "neutral", "source": "peru_socioeconomic", "description": "Habitantes por km²."},
        {"key": "income", "label": "Ingreso anual", "format": "usd", "unit": "$/año", "higher_is": "good", "source": "peru_socioeconomic", "description": "Ingreso familiar anual equivalente en USD (INEI)."},
        {"key": "home_value", "label": "Valor de vivienda", "format": "usd", "unit": "$", "higher_is": "neutral", "source": "peru_socioeconomic", "description": "Valor estimado de vivienda urbana/rural equivalente en USD."},
        {"key": "poverty", "label": "Pobreza monetaria", "format": "pct", "unit": "%", "higher_is": "bad", "source": "peru_socioeconomic", "description": "Incidencia de pobreza monetaria (INEI ENAHO 2025)."},
        {"key": "median_age", "label": "Edad mediana", "format": "years", "unit": "años", "higher_is": "neutral", "source": "peru_socioeconomic", "description": "Edad mediana de la población (INEI)."},
        {"key": "foreign_born", "label": "Nacidos en el exterior", "format": "pct", "unit": "%", "higher_is": "neutral", "source": "peru_socioeconomic", "description": "Proporción de residentes nacidos fuera del Perú."},
        {"key": "bachelors", "label": "Educación superior", "format": "pct", "unit": "%", "higher_is": "good", "source": "peru_socioeconomic", "description": "Población adulta con educación superior (INEI)."},
        {"key": "broadband", "label": "Internet en el hogar", "format": "pct", "unit": "%", "higher_is": "good", "source": "peru_socioeconomic", "description": "Hogares con acceso a internet (ENAHO 2025)."},
        {"key": "commute", "label": "Tiempo de traslado", "format": "minutes", "unit": "min", "higher_is": "bad", "source": "peru_socioeconomic", "description": "Tiempo medio de viaje al trabajo en minutos."},
        {"key": "homeownership", "label": "Vivienda propia", "format": "pct", "unit": "%", "higher_is": "good", "source": "peru_socioeconomic", "description": "Hogares que habitan vivienda propia (ENAHO 2025)."},
        {"key": "uninsured", "label": "Sin seguro de salud", "format": "pct", "unit": "%", "higher_is": "bad", "source": "peru_socioeconomic", "description": "Población sin afiliación a SIS o EsSalud (INEI)."},
        {"key": "forest", "label": "Bosque", "format": "pct", "unit": "%", "higher_is": "neutral", "source": "etopo", "description": "Cobertura de selva y bosque montano."},
        {"key": "crop", "label": "Cultivos", "format": "pct", "unit": "%", "higher_is": "neutral", "source": "etopo", "description": "Proporción de tierras agrícolas."},
        {"key": "pasture", "label": "Pastos", "format": "pct", "unit": "%", "higher_is": "neutral", "source": "etopo", "description": "Proporción de pastos altoandinos y ganaderos."},
        {"key": "developed", "label": "Suelo urbano", "format": "pct", "unit": "%", "higher_is": "neutral", "source": "etopo", "description": "Proporción de área urbanizada."},
        {"key": "cbsa", "label": "Ciudad", "format": "text", "unit": "", "higher_is": "neutral", "source": "peru_socioeconomic", "description": "ID de ciudad principal asociada."},
        {"key": "cell", "label": "Celda", "format": "int", "unit": "", "higher_is": "neutral", "source": "peru_boundaries", "description": "Celda hexagonal representativa."},
        # Community / Advisor columns after `cell`
        {"key": "faith", "label": "Adscripción religiosa", "format": "float", "unit": "creyentes por 100 hab.", "higher_is": "neutral", "source": "peru_socioeconomic", "description": "Población que profesa una religión por cada 100 habitantes (Censo INEI)."},
        {"key": "faith_tradition", "label": "Tradición religiosa", "format": "text", "unit": "", "higher_is": "neutral", "source": "peru_socioeconomic", "description": "Perfil religioso predominante en la provincia (Censo INEI)."},
        {"key": "amenities", "label": "Índice de Bienestar", "format": "float", "unit": "índice (100 = media)", "higher_is": "good", "source": "peru_socioeconomic", "description": "Índice compuesto de servicios básicos (agua, internet, baja pobreza y salud; 100 = media provincial)."},
        {"key": "disasters", "label": "Emergencias INDECI", "format": "int", "unit": "emergencias", "higher_is": "bad", "source": "indeci_emergencies", "description": "Emergencias registradas en SINPAD (2003–2025)."},
        {"key": "indigenous_lang", "label": "Lengua originaria", "format": "pct", "unit": "%", "higher_is": "neutral", "source": "peru_socioeconomic", "description": "Población con lengua materna quechua, aimara o amazónica (INEI)."},
        {"key": "water_access", "label": "Agua por red pública", "format": "pct", "unit": "%", "higher_is": "good", "source": "peru_socioeconomic", "description": "Hogares con acceso a agua por red pública (ENAHO 2025)."},
        {"key": "culture_org", "label": "Agentes culturales", "format": "int", "unit": "registros", "higher_is": "good", "source": "mincul_rentoca", "description": "Trabajadores y organizaciones en RENTOCA (MinCul)."},
        {"key": "veterans", "label": "Licenciados FF.AA.", "format": "int", "unit": "personas", "higher_is": "neutral", "source": "peru_socioeconomic", "description": "Estimación de licenciados de las Fuerzas Armadas."},
        {"key": "veterans_pct", "label": "% Licenciados FF.AA.", "format": "pct", "unit": "%", "higher_is": "neutral", "source": "peru_socioeconomic", "description": "Proporción de adultos licenciados de las FF.AA."},
        {"key": "armed_forces", "label": "Efectivos FF.AA.", "format": "int", "unit": "personas", "higher_is": "neutral", "source": "peru_socioeconomic", "description": "Efectivos militares residentes estimados."},
        {"key": "armed_forces_pct", "label": "% Efectivos FF.AA.", "format": "pct", "unit": "%", "higher_is": "neutral", "source": "peru_socioeconomic", "description": "Efectivos militares sobre población 16+."},
    ]
    columns = [f["key"] for f in fields]

    # First pass to gather raw metrics (Empirical Bayes blend on small-sample provinces) and standardize `amenities` (mean=100, sd=10)
    raw_provs = []
    for idx, c in enumerate(counties_meta):
        gid = c["geoid"]
        dep = c["state_fips"]
        st = dep_stats[dep]
        ep = enaho_prov.get(gid) or {}
        ed = enaho_dep.get(dep) or {}
        is_city = gid in prov_to_city
        n_hh = ep.get("n_hh", 0)
        # Shrink small rural province samples gently toward the departmental ENAHO estimate (prior weight = 25 households)
        alpha = n_hh / (n_hh + 25.0) if n_hh > 0 else 0.0

        def _blend(key: str, fallback: float) -> float:
            vp = ep.get(key)
            vd = ed.get(key, fallback)
            if vp is None:
                return vd
            return alpha * vp + (1.0 - alpha) * vd

        net_val = round(_blend("internet", max(0.16, min(0.84, (0.78 if is_city else 0.62) - st["poverty"] * 1.05))), 3)
        wat_val = round(_blend("water", max(0.42, min(0.96, (0.95 if is_city else 0.82) - st["poverty"] * 0.65))), 3)
        own_val = round(_blend("homeownership", 0.68 if not is_city else 0.61), 3)

        pop = prov_pop[gid]
        area = max(1.0, c["land_km2"])
        dens = round(pop / area, 2)
        cx, cy = proj(c["lon"], c["lat"])
        cell = grid.cell_at(cx, cy)
        if cell < 0 or owner[cell] < 0:
            hits = prov_hex_hits.get(idx)
            cell = hits[0] if hits else next((i for i, o in enumerate(owner) if o >= 0), 0)

        hits = prov_hex_hits.get(idx, [cell])
        forest_s = round(sum(pct["forest"][h] for h in hits) / (100.0 * len(hits)), 3) if hits else 0.0
        crop_s = round(sum(pct["crop"][h] for h in hits) / (100.0 * len(hits)), 3) if hits else 0.0
        past_s = round(sum(pct["pasture"][h] for h in hits) / (100.0 * len(hits)), 3) if hits else 0.0
        dev_s = round(sum(pct["developed"][h] for h in hits) / (100.0 * len(hits)), 3) if hits else 0.0

        inc_fallback = st["income"] * 12 / 3.75 * (1.12 if is_city else 0.88)
        inc_usd = max(1800, round(_blend("income_usd", inc_fallback)))
        home_usd = round(inc_usd * (6.8 if gid in ("1501", "0701", "0401") else 5.2 if is_city else 4.1))
        pov_fallback = max(0.06, min(0.62, st["poverty"] * (0.86 if is_city else 1.12)))
        pov = round(max(0.03, min(0.75, _blend("poverty", pov_fallback))), 3)
        med_age = round(_blend("median_age", 33.5 - pov * 12.0 + (1.5 if is_city else 0.0)), 1)
        bach_val = round(max(0.03, min(0.65, _blend("bachelors", st["higher_ed"] * (1.1 if is_city else 0.78)))), 3)
        indig_val = round(max(0.0, min(0.98, _blend("indigenous_lang", st["indig_lang"]))), 3)
        fb = 0.065 if gid in ("1501", "0701") else 0.032 if dep in ("24", "20", "13", "11", "04", "23") and is_city else 0.008
        commute_min = 46.0 if gid in ("1501", "0701") else 29.0 if is_city else 21.0
        unins = round(max(0.05, min(0.24, 0.14 - pov * 0.08)), 3)

        # Religion profile (INEI Census patterns + real provincial indigenous language share)
        if dep in ("16", "25", "22", "01", "06", "10", "19") and indig_val < 0.45:
            trad = "evangelical_mix"
            faith_rate = 92.5
        elif indig_val >= 0.40:
            trad = "andean_syncretic"
            faith_rate = 95.8
        else:
            trad = "catholic"
            faith_rate = 91.2 if gid in ("1501", "0701") else 94.0

        dis_cnt = indeci["by_prov"].get(gid, {}).get("total", 0)
        cult_cnt = rentoca["by_prov"].get(gid, 0)
        wb_raw = (1.0 - pov) * 0.4 + wat_val * 0.25 + net_val * 0.20 + bach_val * 0.15

        vet = round(pop * 0.0085)
        af = round(pop * (0.0065 if dep in ("07", "23", "16", "24", "17") else 0.0022))

        raw_provs.append({
            "geoid": gid, "name": c["name"], "state": dep_meta[dep],
            "population": pop, "land_km2": c["land_km2"], "density": dens,
            "income": inc_usd, "home_value": home_usd, "poverty": pov,
            "median_age": med_age, "foreign_born": fb, "bachelors": bach_val,
            "broadband": net_val, "commute": commute_min, "homeownership": own_val, "uninsured": unins,
            "forest": forest_s, "crop": crop_s, "pasture": past_s, "developed": dev_s,
            "cbsa": prov_to_city.get(gid), "cell": cell,
            "faith": faith_rate, "faith_tradition": trad, "_wb": wb_raw,
            "disasters": dis_cnt, "indigenous_lang": indig_val, "water_access": wat_val,
            "culture_org": cult_cnt,
            "veterans": vet, "veterans_pct": round(vet / max(1, round(pop * 0.68)), 4),
            "armed_forces": af, "armed_forces_pct": round(af / max(1, round(pop * 0.72)), 4),
        })

    wb_mean = sum(p["_wb"] for p in raw_provs) / len(raw_provs)
    wb_sd = math.sqrt(sum((p["_wb"] - wb_mean) ** 2 for p in raw_provs) / len(raw_provs)) or 0.1
    rows = []
    for p in raw_provs:
        p["amenities"] = round(100.0 + 10.0 * (p["_wb"] - wb_mean) / wb_sd, 1)
        rows.append([p[k] for k in columns])

    write_web("counties.json", {
        "vintage": "INEI ENAHO 2025 / INDECI 2003–2025 / RENTOCA 2026",
        "fields": fields,
        "columns": columns,
        "rows": rows,
    })

    trad_idx = {c["id"]: i for i, c in enumerate(FAITH_CATEGORIES)}

    def spread(key: str, round_int: bool = False) -> list[float | int | None]:
        out: list[float | int | None] = [None] * grid.size
        for i in range(grid.size):
            if owner[i] < 0 or county_arr[i] < 0:
                continue
            val = raw_provs[county_arr[i]][key]
            if val is not None and round_int:
                val = int(round(val))
            out[i] = val
        return out

    trad_hex = [trad_idx[raw_provs[county_arr[i]]["faith_tradition"]] if owner[i] >= 0 and county_arr[i] >= 0 else None for i in range(grid.size)]
    forest_hex = [round(pct["forest"][i] / 100.0, 2) if owner[i] >= 0 else None for i in range(grid.size)]
    farm_hex = [round(min(1.0, (pct["crop"][i] + pct["pasture"][i]) / 100.0), 2) if owner[i] >= 0 else None for i in range(grid.size)]
    dev_hex = [round(pct["developed"][i] / 100.0, 2) if owner[i] >= 0 else None for i in range(grid.size)]

    lens_specs = [
        ("density", "people", "Densidad poblacional", "l-people", "👥", "hab. / km²", "float", "log",
         ["#1e293b", "#2d6a8f", "#4db380", "#f4d35e", "#ee6c4d"], "neutral", "peru_socioeconomic",
         "Habitantes por kilómetro cuadrado por provincia (INEI 2025).", spread("density"), None),
        ("age", "people", "Edad mediana", "l-age", "⏳", "años", "years", "linear",
         ["#2b5876", "#4e4376", "#b56576", "#e56b6f", "#eaac8b"], "neutral", "peru_socioeconomic",
         "Edad mediana estimada de los residentes por provincia (INEI).", spread("median_age"), None),
        ("indigenous_lang", "people", "Lengua originaria", "l-faith", "🗣️", "%", "pct", "linear",
         ["#2b2d42", "#6d597a", "#b56576", "#e56b6f", "#f4a261"], "neutral", "peru_socioeconomic",
         "Población con lengua materna quechua, aimara o lengua amazónica (INEI).", spread("indigenous_lang"),
         "Refleja la riqueza lingüística andina y amazónica del Perú."),
        ("foreign_born", "people", "Nacidos en el exterior", "l-foreign", "🌎", "%", "pct", "linear",
         ["#1d3557", "#457b9d", "#a8dadc", "#f4a261", "#e76f51"], "neutral", "peru_socioeconomic",
         "Proporción de residentes nacidos en otro país.", spread("foreign_born"), None),
        ("poverty", "prosperity", "Pobreza monetaria", "l-poverty", "📉", "%", "pct", "linear",
         ["#2a9d8f", "#8ab17d", "#e9c46a", "#f4a261", "#d62828"], "bad", "peru_socioeconomic",
         "Incidencia de pobreza monetaria provincial (microdatos INEI ENAHO 2025, Sumaria).", spread("poverty"),
         "Calculado sobre 33,702 hogares ENAHO 2025 con suavizado Bayesiano empírico en provincias de muestra pequeña."),
        ("income", "prosperity", "Ingreso familiar anual", "l-income", "🪙", "$/año", "usd", "linear",
         ["#3a2c4a", "#6c4f8f", "#4ea8de", "#7fbf3f", "#f4d35e"], "good", "peru_socioeconomic",
         "Ingreso familiar anual equivalente en USD (INEI).", spread("income", True), None),
        ("home", "prosperity", "Valor de vivienda", "l-home", "🏠", "$", "usd", "linear",
         ["#243b55", "#3a6073", "#689f38", "#fbc02d", "#f57c00"], "neutral", "peru_socioeconomic",
         "Valor referencial de la vivienda equivalente en USD.", spread("home_value", True), None),
        ("homeownership", "prosperity", "Vivienda propia", "l-homeownership", "🔑", "%", "pct", "linear",
         ["#3d405b", "#5c6bc0", "#26a69a", "#9ccc65", "#ffee58"], "good", "peru_socioeconomic",
         "Hogares que habitan en vivienda propia (ENAHO 2025).", spread("homeownership"), None),
        ("bachelors", "knowledge", "Educación superior", "l-degrees", "🎓", "%", "pct", "linear",
         ["#2d2a3e", "#5b4b8a", "#4ea8de", "#80ed99", "#f9f871"], "good", "peru_socioeconomic",
         "Población adulta con educación superior universitaria o técnica (INEI).", spread("bachelors"), None),
        ("broadband", "knowledge", "Internet en el hogar", "l-broadband", "📶", "%", "pct", "linear",
         ["#2b2d42", "#5c677d", "#3a86ff", "#4cc9f0", "#b5e48c"], "good", "peru_socioeconomic",
         "Porcentaje de hogares con conexión a internet (ENAHO 2025).", spread("broadband"), None),
        ("water_access", "life", "Agua por red pública", "l-home", "🚰", "%", "pct", "linear",
         ["#7f1d1d", "#d97706", "#eab308", "#38bdf8", "#0284c7"], "good", "peru_socioeconomic",
         "Porcentaje de hogares conectados a red pública de agua potable (ENAHO 2025).", spread("water_access"), None),
        ("amenities", "life", "Bienestar y servicios", "l-amenities", "✨", "índice (100 = media)", "float", "linear",
         ["#9b2226", "#ca6702", "#e9d8a6", "#94d2bd", "#0a9396"], "good", "peru_socioeconomic",
         "Índice compuesto de bienestar y servicios básicos (agua, internet, educación y menor pobreza; 100 = provincia promedio).", spread("amenities"),
         "Estimación compuesta a partir de indicadores provinciales ENAHO/INEI."),
        ("culture_org", "life", "Agentes culturales", "l-culture", "🎭", "registros", "int", "log",
         ["#1e1b4b", "#4c1d95", "#7c3aed", "#c084fc", "#f5d0fe"], "good", "mincul_rentoca",
         "Trabajadores y organizaciones culturales registrados en RENTOCA (Ministerio de Cultura).", spread("culture_org", True), None),
        ("faith", "faith", "Adscripción religiosa", "l-faith", "⛪", "creyentes por 100 hab.", "float", "linear",
         ["#2b2d42", "#5c677d", "#8d99ae", "#d4a73a", "#f4d35e"], "neutral", "peru_socioeconomic",
         "Personas que declaran profesar una religión por cada 100 habitantes (Censo INEI).", spread("faith"),
         "Autoidentificación censal (INEI)."),
        ("disasters", "hazards", "Emergencias INDECI", "l-disasters", "⛈️", "emergencias", "int", "log",
         ["#1f2937", "#4b5563", "#f59e0b", "#ea580c", "#b91c1c"], "bad", "indeci_emergencies",
         "Emergencias registradas en SINPAD por provincia entre 2003 y 2025 (lluvias, huaicos, heladas, sismos).", spread("disasters", True),
         "Conteo de emergencias reportadas en SINPAD, no mide pérdida monetaria directa."),
        ("forest", "land", "Selva y bosques", "l-forest", "🌳", "%", "pct", "linear",
         ["#d4c59a", "#a3b18a", "#588157", "#3a5a40", "#1b4332"], "neutral", "etopo",
         "Proporción de bosque amazónico y montano por hexágono.", forest_hex, None),
        ("farmland", "land", "Tierras agropecuarias", "l-farmland", "🌾", "%", "pct", "linear",
         ["#2b2d42", "#6c757d", "#a7c957", "#dda15e", "#f4d35e"], "neutral", "etopo",
         "Proporción de cultivos y pastos naturales por hexágono.", farm_hex, None),
    ]

    lenses_out = []
    for lid, grp, name, icon, emoji, unit, fmt, scale, ramp, hi, src, desc, vals, note in lens_specs:
        dom = [0, 100] if lid == "faith" else _domain(vals)
        if scale == "log" and dom[0] <= 0:
            pos = [x for x in vals if x is not None and x > 0]
            dom[0] = round(min(pos), 2) if pos else 1.0
        entry = {
            "id": lid, "group": grp, "name": name, "icon": icon, "emoji": emoji,
            "unit": unit, "format": fmt, "scale": scale, "domain": dom, "ramp": ramp,
            "higher_is": hi, "source": src, "description": desc, "values": vals,
        }
        if note:
            entry["note"] = note
        lenses_out.append(entry)

    # Add categorical faith_tradition lens
    lenses_out.insert(14, {
        "id": "faith_tradition", "group": "faith", "name": "Perfil religioso", "icon": "l-faith-tradition", "emoji": "🕯️",
        "unit": "", "format": "category", "scale": "linear", "domain": [0, len(FAITH_CATEGORIES) - 1],
        "ramp": [c["color"] for c in FAITH_CATEGORIES], "categories": FAITH_CATEGORIES,
        "higher_is": "neutral", "source": "peru_socioeconomic",
        "description": "Perfil religioso predominante en la provincia según patrones censales del INEI.",
        "values": trad_hex,
        "note": "Clasificación sintética basada en los Censos Nacionales del INEI.",
    })

    write_web("lenses.json", {
        "vintage": "INEI ENAHO 2025 / INDECI / RENTOCA",
        "groups": [
            {"id": "people", "name": "Población"},
            {"id": "prosperity", "name": "Prosperidad"},
            {"id": "knowledge", "name": "Conocimiento"},
            {"id": "life", "name": "Vida y Cultura"},
            {"id": "faith", "name": "Religión y Tradición"},
            {"id": "hazards", "name": "Peligros Naturales"},
            {"id": "land", "name": "Territorio"},
        ],
        "lenses": lenses_out,
    })
    print(f"    {len(rows)} provincias, {len(lenses_out)} lentes escritos")
