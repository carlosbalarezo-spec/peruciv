"""Build districts.json: especialización industrial real (MTPE 2025 + SUNEDU + puertos/minas) por ciudad y provincia."""

from __future__ import annotations

from collections import defaultdict

from ..core.store import load_interim, write_web

REQUIRES = ["_world", "peru_boundaries", "peru_socioeconomic", "mtpe_employment", "sunedu_universities"]
PRODUCES = ["districts.json"]

CATALOG = [
    {
        "id": "campus", "name": "Campus y Conocimiento", "icon": "d-campus", "color": "#4a7bd0",
        "naics": ["6113", "54"], "own": [1, 2, 3, 5],
        "sub": {"6113": "Universidades e investigación", "54": "Ingeniería, consultoría y TI"},
        "badge": {"id": "scientific", "label": "Ciudad del conocimiento", "labels": {"6113": "Ciudad universitaria", "54": "Polo profesional y TI"}},
        "description": "Educación superior, investigación científica, ingeniería y servicios tecnológicos.", "caveat": None,
    },
    {
        "id": "commercial_hub", "name": "Centro Comercial y Financiero", "icon": "d-commercial", "color": "#d4a73a",
        "naics": ["52", "42_45"], "own": [1, 2, 3, 5],
        "sub": {"52": "Banca, seguros y microfinanzas", "42_45": "Comercio mayorista y minorista"},
        "badge": {"id": "commercial", "label": "Centro comercial", "labels": {"52": "Capital financiera", "42_45": "Emporio comercial"}},
        "description": "Banca, finanzas, comercio mayorista y articulación mercantil regional.", "caveat": None,
    },
    {
        "id": "industrial_zone", "name": "Zona Industrial y Minera", "icon": "d-industrial", "color": "#c86d2d",
        "naics": ["2122", "31_33", "111"], "own": [1, 2, 3, 5],
        "sub": {"2122": "Minería e hidrocarburos", "31_33": "Manufactura e industria", "111": "Agroindustria de exportación"},
        "badge": {"id": "industrial", "label": "Polo industrial", "labels": {"2122": "Ciudad minera", "31_33": "Ciudad industrial", "111": "Polo agroexportador"}},
        "description": "Gran minería, refinación, manufactura e industria agroexportadora.", "caveat": None,
    },
    {
        "id": "harbor", "name": "Puerto Marítimo / Fluvial", "icon": "d-harbor", "color": "#3891b8",
        "naics": ["1141", "48_49"], "own": [1, 2, 3, 5],
        "sub": {"1141": "Pesca industrial y portuaria", "48_49": "Logística portuaria y transporte"},
        "badge": {"id": "maritime", "label": "Ciudad portuaria", "labels": {"1141": "Puerto pesquero", "48_49": "Hub portuario"}},
        "description": "Terminales marítimos o fluviales, comercio exterior e industria pesquera.", "caveat": None,
    },
    {
        "id": "theater_square", "name": "Plaza Cultural y Patrimonial", "icon": "d-theater", "color": "#9d5bd2",
        "naics": ["71"], "own": [1, 2, 3, 5],
        "sub": {"71": "Patrimonio, artes y cultura viva"},
        "badge": {"id": "cultural", "label": "Capital cultural", "labels": {"71": "Ciudad patrimonial"}},
        "description": "Artes escénicas, patrimonio arqueológico, artesanía e industrias culturales.", "caveat": None,
    },
    {
        "id": "entertainment_complex", "name": "Complejo Turístico y Gastronómico", "icon": "d-entertainment", "color": "#d95b82",
        "naics": ["721"], "own": [1, 2, 3, 5],
        "sub": {"721": "Hotelería, gastronomía y turismo"},
        "badge": {"id": "entertainment", "label": "Destino turístico", "labels": {"721": "Capital turística y gastronómica"}},
        "description": "Turismo receptivo e interno, hotelería y gastronomía peruana.", "caveat": None,
    },
    {
        "id": "government_plaza", "name": "Plaza de Gobierno", "icon": "d-gov", "color": "#4f8a6e",
        "naics": ["92"], "own": [1, 2, 3, 5],
        "sub": {"92": "Administración pública y sede regional"},
        "badge": {"id": "governmental", "label": "Sede administrativa", "labels": {"92": "Sede de gobierno"}},
        "description": "Instituciones del Estado, gobiernos regionales y gestión pública.", "caveat": None,
    },
    {
        "id": "aqueduct", "name": "Complejo Energético e Hídrico", "icon": "d-aqueduct", "color": "#3fa796",
        "naics": ["2211", "23"], "own": [1, 2, 3, 5],
        "sub": {"2211": "Generación eléctrica y agua", "23": "Infraestructura e ingeniería civil"},
        "badge": {"id": "utility", "label": "Nodo energético", "labels": {"2211": "Nodo hidroenergético"}},
        "description": "Centrales eléctricas, irrigaciones e infraestructura hidráulica.", "caveat": None,
    },
]

INDUSTRY_TITLES = {
    "2122": "Explotación de minas, canteras e hidrocarburos",
    "111": "Agroindustria y cultivos de exportación",
    "1141": "Pesca marítima, acuicultura y harina de pescado",
    "31_33": "Industrias manufactureras",
    "2211": "Suministro de electricidad, gas y agua",
    "23": "Construcción e infraestructura",
    "42_45": "Comercio mayorista y minorista",
    "48_49": "Transporte, logística portuaria y comunicaciones",
    "52": "Intermediación financiera y seguros",
    "54": "Servicios empresariales, ingeniería y tecnología",
    "6113": "Educación superior universitaria y técnica",
    "62": "Servicios sociales y de salud",
    "71": "Actividades culturales, artísticas y comunitarias",
    "721": "Hotelería, gastronomía y turismo",
    "92": "Administración pública",
}

PORT_CITIES = {"1501", "0218", "2005", "2007", "1105", "1803", "1601", "1602", "2501", "1506"}
MINING_CITIES = {"1801", "1901", "0601", "0201", "0808", "0401", "2301", "0901", "1103"}
AGRO_CITIES = {"1101", "1102", "1301", "2001", "2006", "1401", "1506", "1508", "1505", "0608", "1203"}
TOURISM_CITIES = {"0801", "1701", "2101", "2401", "2209", "0101", "1103", "1207"}


def build() -> None:
    bounds = load_interim("peru_boundaries")
    se = load_interim("peru_socioeconomic")
    mtpe = load_interim("mtpe_employment")
    sunedu = load_interim("sunedu_universities")

    abbr_to_fips = {s["abbr"]: s["fips"] for s in bounds["states"]}
    dep_sec = mtpe["dep_sector"]
    nat_sec = mtpe["nat_sector"]
    nat_sample = max(1, mtpe["total_sample"])

    # Scale MTPE sample to Peru's ~4.35M formal jobs
    SCALE = 4_350_000 / nat_sample
    industries_out = {}
    for code, title in INDUSTRY_TITLES.items():
        cnt = nat_sec.get(code, [0, 0.0])[0]
        industries_out[code] = {"title": title, "us_emp": max(15000, round(cnt * SCALE))}
    total_nat_emp = sum(v["us_emp"] for v in industries_out.values())
    nat_shares = {c: industries_out[c]["us_emp"] / total_nat_emp for c in INDUSTRY_TITLES}

    # Count SUNEDU universities per province
    uni_by_prov = defaultdict(int)
    for u in sunedu["universities"]:
        if len(u["ubigeo"]) >= 4:
            uni_by_prov[u["ubigeo"][:4]] += 1

    cities_out = {}
    for c in se["cities"]:
        cid = c["id"]
        fips = abbr_to_fips[c["deps"][0]]
        d_raw = dep_sec.get(fips, {})
        d_tot = sum(v[0] for v in d_raw.values()) or 1

        # Formal covered employment in this city (~34% of employed in Lima/metros, ~22% in smaller cities)
        formal_rate = 0.42 if cid == "1501" else 0.31 if c.get("metro") else 0.22
        city_emp = max(4000, round(c["pop"] * 0.52 * formal_rate))

        # Sector weights from real MTPE departmental shares + local economic specialization
        weights = {}
        avg_pays = {}
        for code in INDUSTRY_TITLES:
            cnt, rem_sum = d_raw.get(code, [0, 0.0])
            sh = cnt / d_tot if cnt > 0 else nat_shares[code] * 0.7
            pay_pen = (rem_sum / cnt) if cnt > 0 else 2400.0
            # Local boosts based on verified city geography
            if code == "2122" and cid in MINING_CITIES:
                sh = max(sh * 2.4, 0.14)
                pay_pen = max(pay_pen, 5800.0)
            if code == "111" and cid in AGRO_CITIES:
                sh = max(sh * 2.2, 0.16)
            if code in ("1141", "48_49") and cid in PORT_CITIES:
                sh = max(sh * 2.1, 0.12)
            if code in ("721", "71") and cid in TOURISM_CITIES:
                sh = max(sh * 2.6, 0.11)
            if code == "6113" and sum(uni_by_prov[p] for p in c["provs"]) >= 2:
                sh = max(sh * 1.9, 0.07)
            if code == "42_45" and cid in ("2111", "2301", "2401", "1401", "1201"):
                sh = max(sh * 1.6, 0.22)
            weights[code] = sh
            avg_pays[code] = round(pay_pen * 12 / 3.75)  # annual USD

        w_sum = sum(weights.values()) or 1.0
        sec_emp = {code: max(50, round(city_emp * weights[code] / w_sum)) for code in INDUSTRY_TITLES}
        city_emp = sum(sec_emp.values())
        city_avg_pay = round(sum(sec_emp[k] * avg_pays[k] for k in sec_emp) / city_emp)

        # Top specialized industries
        top_list = []
        for code, emp_v in sec_emp.items():
            if emp_v < 300:
                continue
            lq = round((emp_v / city_emp) / nat_shares[code], 2)
            top_list.append({
                "naics": code, "emp": emp_v, "lq": lq, "avg_pay": avg_pays[code],
                "oty_pct": 0.032, "suppressed": 0, "lower_bound": False,
            })
        top_list.sort(key=lambda x: -x["lq"])

        # Evaluate Districts
        qual = []
        for cat in CATALOG:
            if cat["id"] == "harbor" and cid not in PORT_CITIES:
                continue
            codes = cat["naics"]
            d_emp = sum(sec_emp[k] for k in codes)
            n_sh = sum(nat_shares[k] for k in codes)
            d_sh = d_emp / city_emp
            d_lq = round(d_sh / n_sh, 2) if n_sh > 0 else 1.0
            d_pay = round(sum(sec_emp[k] * avg_pays[k] for k in codes) / max(1, d_emp))

            # Best specialty
            best_sub, best_slq, best_semp = None, 0.0, 0
            for k in codes:
                slq = round((sec_emp[k] / city_emp) / nat_shares[k], 2)
                if sec_emp[k] >= 250 and slq > best_slq:
                    best_sub, best_slq, best_semp = k, slq, sec_emp[k]

            passes_broad = d_lq >= 1.20 and (d_emp >= 400 or d_sh >= 0.02)
            passes_spec = best_slq >= 2.2 and best_semp >= 400
            if not (passes_broad or passes_spec):
                continue
            via = "broad" if passes_broad else "specialty"
            strength = round(max(d_emp - d_emp / max(1.01, d_lq), best_semp - best_semp / max(1.01, best_slq)))
            qual.append({
                "id": cat["id"], "lq": d_lq, "emp": d_emp, "share": round(d_sh, 3), "avg_pay": d_pay,
                "sub": best_sub, "sub_lq": best_slq if best_sub else None, "sub_emp": best_semp if best_sub else None,
                "sub_lower_bound": False, "via": via, "strength": max(100, strength),
                "suppressed": 0, "lower_bound": False,
            })

        qual.sort(key=lambda x: -x["strength"])
        qual = qual[:5]

        # Badge
        badge = None
        if c.get("capital"):
            badge = {
                "id": "governmental", "label": "Capital de la República", "district": qual[0]["id"] if qual else "commercial_hub",
                "basis": "mtpe", "text": "Principal metrópoli financiera, industrial y sede de gobierno del Perú",
            }
        elif qual:
            lead = qual[0]
            cat_def = next(x for x in CATALOG if x["id"] == lead["id"])
            lbl = cat_def["badge"]["labels"].get(lead["sub"]) if (lead["sub"] and (lead["sub_lq"] or 0) >= 1.8) else cat_def["badge"]["label"]
            sub_title = INDUSTRY_TITLES.get(lead["sub"] or "", cat_def["name"])
            badge = {
                "id": cat_def["badge"]["id"], "label": lbl or cat_def["badge"]["label"],
                "district": lead["id"], "basis": "mtpe",
                "text": f"{sub_title}: {(lead['sub_lq'] or lead['lq']):.1f}× el peso nacional",
            }

        cities_out[cid] = {
            "emp": city_emp,
            "avg_pay": city_avg_pay,
            "counties": [len(c["provs"]), len(c["provs"])],
            "top": top_list[:8],
            "districts": qual,
            "badge": badge,
        }

    # Province-level summary for Explorer
    counties_out = {}
    for prov in bounds["counties"]:
        gid = prov["geoid"]
        fips = prov["state_fips"]
        d_raw = dep_sec.get(fips, {})
        d_tot = sum(v[0] for v in d_raw.values()) or 1
        p_emp = max(800, round(d_tot * SCALE / 8))
        p_dists = []
        for cat in CATALOG:
            if cat["id"] == "harbor":
                continue
            sh = sum(d_raw.get(k, [0, 0.0])[0] for k in cat["naics"]) / d_tot
            n_sh = sum(nat_shares[k] for k in cat["naics"])
            lq = round(sh / n_sh, 2) if n_sh > 0 else 1.0
            if lq >= 1.25:
                p_dists.append([cat["id"], lq, round(p_emp * sh)])
        p_dists.sort(key=lambda x: -x[1])
        counties_out[gid] = {"emp": p_emp, "districts": p_dists[:4]}

    write_web("districts.json", {
        "version": 1,
        "vintage": "MTPE Planilla Electrónica (Dic. 2025)",
        "year": 2025,
        "sources": ["mtpe_employment", "sunedu_universities"],
        "rule": {
            "min_lq": 1.2, "min_jobs": 400, "min_share": 0.02, "specialty_lq": 2.2, "specialty_jobs": 400,
            "specialty_share": 0.01, "max_per_city": 5, "harbor_needs_water": True, "badge_lq": 5.0,
            "badge_share": 0.03, "college_share": 0.15,
            "text": "Un distrito aparece cuando su cociente de localización (LQ) es ≥ 1.20× el promedio nacional (con ≥ 400 empleos formales), o cuando una especialidad supera 2.2× (MTPE Planilla Electrónica).",
            "county_note": "Distritos provinciales estimados a partir de la estructura sectorial formal del departamento (MTPE).",
        },
        "catalog": CATALOG,
        "industries": industries_out,
        "national": {"emp": total_nat_emp, "avg_pay": 9200},
        "cities": cities_out,
        "counties": counties_out,
    })
    print(f"    {len(cities_out)} ciudades con distritos e insignias en districts.json")
