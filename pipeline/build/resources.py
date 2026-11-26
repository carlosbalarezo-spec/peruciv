"""Build resources.json: centrales eléctricas (MINEM), hidrocarburos (Camisea/Talara/Loreto) y grandes minas del Perú."""

from __future__ import annotations

import math
from collections import defaultdict

from ..core.geo import MapProjection
from ..core.hexgrid import HexGrid
from ..core.store import load_interim, save_interim, write_web

REQUIRES = ["_world", "peru_boundaries", "peru_socioeconomic", "minem_generation", "minem_hydrocarbons"]
PRODUCES = ["_resources", "resources.json"]

PLANT_COORDS: list[tuple[str, str, float, float, str]] = [
    ("ANTUNEZ DE MAYOLO", "C.H. Santiago Antúnez de Mayolo (Mantaro)", -12.346, -74.685, "HUV"),
    ("MANTARO", "C.H. Santiago Antúnez de Mayolo (Mantaro)", -12.346, -74.685, "HUV"),
    ("RESTITUCION", "C.H. Restitución", -12.310, -74.665, "HUV"),
    ("EL PLATANAL", "C.H. El Platanal", -12.956, -75.955, "LIM"),
    ("CHILCA", "C.T. Chilca Uno", -12.512, -76.736, "LIM"),
    ("OLLEROS", "C.T. Santo Domingo de los Olleros", -12.505, -76.720, "LIM"),
    ("KALLPA", "C.T. Kallpa (Chilca)", -12.502, -76.742, "LIM"),
    ("FENIX", "C.T. Fénix Power (Chilca)", -12.525, -76.725, "LIM"),
    ("LAS FLORES", "C.T. Las Flores (Chilca)", -12.518, -76.730, "LIM"),
    ("VENTANILLA", "C.T. Ventanilla", -11.883, -77.129, "CAL"),
    ("SANTA ROSA", "C.T. Santa Rosa", -12.043, -77.018, "LIM"),
    ("ETÉN", "C.T. Reserva Fría Eten", -6.912, -79.865, "LAM"),
    ("ETEN", "C.T. Reserva Fría Eten", -6.912, -79.865, "LAM"),
    ("AGUAYTÍA", "C.T. Aguaytía", -9.035, -75.505, "UCA"),
    ("AGUAYTIA", "C.T. Aguaytía", -9.035, -75.505, "UCA"),
    ("CERRO DEL AGUILA", "C.H. Cerro del Águila", -12.238, -74.590, "HUV"),
    ("CHAGLLA", "C.H. Chaglla", -9.715, -75.875, "HUC"),
    ("HUINCO", "C.H. Huinco", -11.763, -76.617, "LIM"),
    ("MATUCANA", "C.H. Matucana", -11.845, -76.385, "LIM"),
    ("CAÑON DEL PATO", "C.H. Cañón del Pato", -8.811, -77.844, "ANC"),
    ("CANON DEL PATO", "C.H. Cañón del Pato", -8.811, -77.844, "ANC"),
    ("SAN GABAN", "C.H. San Gabán II", -13.452, -70.405, "PUN"),
    ("MACHUPICCHU", "C.H. Machupicchu", -13.164, -72.559, "CUS"),
    ("CHARCANI", "C.H. Charcani V", -16.256, -71.483, "ARE"),
    ("CARHUAQUERO", "C.H. Carhuaquero", -6.620, -79.260, "CAJ"),
    ("CHEVES", "C.H. Cheves", -10.895, -76.968, "LIM"),
    ("ILO", "C.T. Ilo (Nodo Energético)", -17.710, -71.345, "MOQ"),
    ("PUERTO BRAVO", "C.T. Puerto Bravo (Mollendo)", -17.012, -72.012, "ARE"),
    ("INDEPENDENCIA", "C.T. Independencia (Pisco)", -13.715, -76.140, "ICA"),
    ("MALACAS", "C.T. Malacas (Talara)", -4.555, -81.235, "PIU"),
    ("IQUITOS", "C.T. Iquitos Nueva", -3.735, -73.245, "LOR"),
    ("RUBI", "C.S. Rubí (Solar)", -17.272, -71.094, "MOQ"),
    ("INTIPAMPA", "C.S. Intipampa (Solar)", -17.320, -71.050, "MOQ"),
    ("CLEMESI", "C.S. Clemesí (Solar)", -17.290, -71.130, "MOQ"),
    ("MAJES", "C.S. Majes Solar", -16.352, -72.204, "ARE"),
    ("MARCONA", "Parque Eólico Marcona", -15.435, -75.055, "ICA"),
    ("WAYRA", "Parque Eólico Wayra I", -15.455, -75.025, "ICA"),
    ("PUNTA LOMITAS", "Parque Eólico Punta Lomitas", -14.700, -75.815, "ICA"),
    ("CUPISNIQUE", "Parque Eólico Cupisnique", -7.516, -79.485, "LAL"),
    ("TALARA", "Parque Eólico Talara", -4.620, -81.230, "PIU"),
    ("HUAMBOS", "Parque Eólico Duna y Huambos", -6.450, -78.960, "CAJ"),
]

MAJOR_MINES = [
    ("Antamina", "copper", -9.541, -77.058, "ANC", 435000, "Cobre y zinc — Huari, Áncash"),
    ("Cerro Verde", "copper", -16.533, -71.601, "ARE", 445000, "Cobre y molibdeno — Arequipa"),
    ("Quellaveco", "copper", -17.098, -70.616, "MOQ", 319000, "Cobre — Mariscal Nieto, Moquegua"),
    ("Las Bambas", "copper", -14.087, -72.323, "APU", 302000, "Cobre — Cotabambas, Apurímac"),
    ("Toquepala", "copper", -17.246, -70.611, "TAC", 230000, "Cobre — Jorge Basadre, Tacna"),
    ("Cuajone", "copper", -17.046, -70.706, "MOQ", 165000, "Cobre — Mariscal Nieto, Moquegua"),
    ("Toromocho", "copper", -11.617, -76.140, "JUN", 205000, "Cobre — Yauli, Junín"),
    ("Antapaccay", "copper", -14.888, -71.318, "CUS", 172000, "Cobre — Espinar, Cusco"),
    ("Constancia", "copper", -14.442, -71.787, "CUS", 110000, "Cobre — Chumbivilcas, Cusco"),
    ("Mina Justa", "copper", -15.174, -75.118, "ICA", 142000, "Cobre — Nasca, Ica"),
    ("Yanacocha", "gold", -6.993, -78.523, "CAJ", 9800, "Oro — Cajamarca"),
    ("Poderosa", "gold", -7.767, -77.610, "LAL", 9200, "Oro — Pataz, La Libertad"),
    ("Horizonte / Retamas", "gold", -8.040, -77.490, "LAL", 5600, "Oro — Pataz, La Libertad"),
    ("Inmaculada", "gold", -14.956, -73.241, "AYA", 6100, "Oro y plata — Páucar del Sara Sara, Ayacucho"),
    ("San Rafael", "lead_zinc", -14.233, -70.317, "PUN", 28000, "Estaño — Melgar, Puno (Minsur)"),
    ("Marcona (Shougang)", "iron", -15.206, -75.134, "ICA", 14000000, "Hierro — Nasca, Ica (principal productor de hierro)"),
    ("Cerro Lindo", "lead_zinc", -13.076, -75.990, "ICA", 95000, "Zinc, cobre y plomo — Chincha, Ica"),
    ("Yauliyacu / Chungar", "lead_zinc", -11.015, -76.410, "PAS", 82000, "Zinc, plata y plomo — Pasco / Lima"),
]

HIDRO_ZONES = [
    ("Camisea (Lotes 88 y 56)", "gas", -11.860, -72.815, "CUS", 4200, "Gas natural y LGN — Megantoni, Cusco"),
    ("Lote 57 (Kinteroni / Sagari)", "gas", -11.450, -73.120, "CUS", 2600, "Gas natural — Selva Sur"),
    ("Talara / Noroeste (Lotes X, Z-2B)", "oil", -4.580, -81.200, "PIU", 3100, "Petróleo crudo y gas — Talara, Piura"),
    ("Lote 95 (Bretaña Norte)", "oil", -5.260, -74.350, "LOR", 2800, "Petróleo crudo — Requena, Loreto"),
    ("Lote 192 / 8 (Selva Norte)", "oil", -2.950, -75.950, "LOR", 4800, "Petróleo crudo — Cuenca del Marañón, Loreto"),
    ("Lote 31-C (Aguaytía)", "gas", -9.035, -75.505, "UCA", 1400, "Gas natural — Padre Abad, Ucayali"),
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
    se = load_interim("peru_socioeconomic")
    gen = load_interim("minem_generation")

    grid = HexGrid(**w["grid"])
    proj = MapProjection(**w["projection"])
    owner = w["owner"]
    county_arr = w["county"]
    county_geoids = w["counties"]

    prov_to_city = {}
    for c in se["cities"]:
        for p in c["provs"]:
            prov_to_city[p] = c["id"]

    def city_of_cell(cell: int) -> str | None:
        ci = county_arr[cell]
        if ci >= 0 and ci < len(county_geoids):
            return prov_to_city.get(county_geoids[ci])
        return None

    types = [
        {"id": "hydro", "name": "Central hidroeléctrica", "category": "energy", "emoji": "💧", "icon": "r-hydro", "color": "#38bdf8",
         "unit": "MW", "description": "Centrales hidroeléctricas principales del SEIN (MINEM).", "source": "minem_generation"},
        {"id": "gas_plant", "name": "Central térmica / gas", "category": "energy", "emoji": "🔥", "icon": "r-gas", "color": "#fb923c",
         "unit": "MW", "description": "Centrales termoeléctricas de gas natural y ciclo combinado (MINEM).", "source": "minem_generation"},
        {"id": "solar", "name": "Central solar", "category": "energy", "emoji": "☀️", "icon": "r-solar", "color": "#facc15",
         "unit": "MW", "description": "Centrales solares fotovoltaicas del sur peruano (MINEM).", "source": "minem_generation"},
        {"id": "wind", "name": "Parque eólico", "category": "energy", "emoji": "🌬️", "icon": "r-wind", "color": "#60a5fa",
         "unit": "MW", "description": "Centrales eólicas en Ica, La Libertad, Piura y Cajamarca (MINEM).", "source": "minem_generation"},
        {"id": "gas", "name": "Yacimiento de gas natural", "category": "energy", "emoji": "⛽", "icon": "r-gas", "color": "#34d399",
         "unit": "km² lote", "description": "Lotes de producción fiscalizada de gas natural (Camisea, Aguaytía) — MINEM.", "source": "minem_hydrocarbons"},
        {"id": "oil", "name": "Lote petrolero", "category": "energy", "emoji": "🛢️", "icon": "r-oil", "color": "#94a3b8",
         "unit": "km² lote", "description": "Lotes de producción fiscalizada de petróleo crudo (Talara, Loreto) — MINEM.", "source": "minem_hydrocarbons"},
        {"id": "copper", "name": "Gran mina de cobre", "category": "mineral", "emoji": "⛏️", "icon": "r-metal", "color": "#d97706",
         "unit": "tons", "description": "Principales unidades mineras de cobre del Perú en toneladas finas/año (MINEM).", "source": "minem_generation"},
        {"id": "gold", "name": "Mina de oro", "category": "mineral", "emoji": "✨", "icon": "r-gold", "color": "#eab308",
         "unit": "kg", "description": "Principales operaciones auríferas del Perú (MINEM).", "source": "minem_generation"},
        {"id": "iron", "name": "Mina de hierro", "category": "mineral", "emoji": "🪨", "icon": "r-metal", "color": "#a8a29e",
         "unit": "tons", "description": "Producción de mineral de hierro en Marcona (MINEM).", "source": "minem_generation"},
        {"id": "lead_zinc", "name": "Mina polimetálica (zinc / estaño / plata)", "category": "mineral", "emoji": "⚙️", "icon": "r-metal", "color": "#cbd5e1",
         "unit": "tons", "description": "Unidades polimetálicas de zinc, estaño, plomo y plata (MINEM).", "source": "minem_generation"},
    ]

    items = []
    matched_mw: dict[str, float] = defaultdict(float)
    matched_info: dict[str, tuple[str, float, float, str, str, str]] = {}
    for p in gen["plants"]:
        uname = p["name"].upper()
        orig = p["origin"].upper()
        ptype = "hydro" if ("HIDRO" in orig or "HIDRA" in orig) else "solar" if "SOLAR" in orig else "wind" if ("EOLIC" in orig or "EÓLIC" in orig) else "gas_plant"
        for sub, disp, lat, lon, dep in PLANT_COORDS:
            if sub in uname:
                matched_mw[disp] += p["mw"]
                matched_info[disp] = (ptype, lat, lon, dep, p["company"], p["origin"])
                break

    for disp, mw in sorted(matched_mw.items(), key=lambda x: -x[1]):
        if mw < 15:
            continue
        ptype, lat, lon, dep, comp, orig = matched_info[disp]
        x, y = proj(lon, lat)
        cell = _nearest_land(grid, owner, x, y)
        items.append({
            "type": ptype, "name": disp, "x": round(x, 1), "y": round(y, 1), "cell": cell,
            "value": round(mw), "detail": f"{orig} — {comp}", "state": dep, "cbsa": city_of_cell(cell),
        })

    for name, rtype, lat, lon, dep, area_km2, detail in HIDRO_ZONES:
        x, y = proj(lon, lat)
        cell = _nearest_land(grid, owner, x, y)
        items.append({
            "type": rtype, "name": name, "x": round(x, 1), "y": round(y, 1), "cell": cell,
            "value": area_km2, "detail": detail, "state": dep, "cbsa": city_of_cell(cell),
        })

    for name, rtype, lat, lon, dep, val, detail in MAJOR_MINES:
        x, y = proj(lon, lat)
        cell = _nearest_land(grid, owner, x, y)
        items.append({
            "type": rtype, "name": name, "x": round(x, 1), "y": round(y, 1), "cell": cell,
            "value": val, "detail": detail, "state": dep, "cbsa": city_of_cell(cell),
        })

    not_add = {"oil", "gas"}
    nat_sum = {t["id"]: {"count": 0, "value": None if t["id"] in not_add else 0, "unit": t["unit"]} for t in types}
    st_sum: dict[str, dict] = defaultdict(dict)
    for it in items:
        t = it["type"]
        unit = nat_sum[t]["unit"]
        nat_sum[t]["count"] += 1
        if t not in not_add and it["value"] is not None:
            nat_sum[t]["value"] += it["value"]
        srec = st_sum[it["state"]].setdefault(t, {"count": 0, "value": None if t in not_add else 0, "unit": unit})
        srec["count"] += 1
        if t not in not_add and it["value"] is not None:
            srec["value"] += it["value"]

    doc = {
        "types": types,
        "items": items,
        "summary": {
            "note": "Totales correspondientes a las centrales, lotes y unidades mineras principales mapeadas (MINEM).",
            "national": nat_sum,
            "states": dict(st_sum),
        },
    }
    write_web("resources.json", doc)
    save_interim("_resources", doc)
    print(f"    {len(items)} recursos energéticos y mineros mapeados")
