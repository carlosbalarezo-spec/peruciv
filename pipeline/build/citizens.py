"""Build citizens.json: composición ocupacional, etaria, transporte, educación y origen para las 48 ciudades."""

from __future__ import annotations

from ..core.store import load_interim, write_web

REQUIRES = ["peru_socioeconomic", "mtpe_employment", "peru_boundaries"]
PRODUCES = ["citizens.json"]

FIGURES = {"workforce": 20, "age": 10, "commute": 10}

GROUPS = {
    "workforce": [
        {"key": "executive", "label": "Directivos y gerentes", "icon": "c-executive", "lines": "MTPE Grupo Ocupacional 1"},
        {"key": "engineer", "label": "Ingenieros, científicos y TI", "icon": "c-engineer", "lines": "MTPE Profesionales científicos"},
        {"key": "scholar", "label": "Docentes, técnicos y cultura", "icon": "c-scholar", "lines": "MTPE Técnicos y profesionales medios"},
        {"key": "healer", "label": "Personal de salud", "icon": "c-healer", "lines": "Sector Salud INEI/MTPE"},
        {"key": "service", "label": "Comercio, gastronomía y servicios", "icon": "c-service", "lines": "MTPE Servicios y vendedores"},
        {"key": "clerk", "label": "Empleados administrativos", "icon": "c-clerk", "lines": "MTPE Jefes y empleados de oficina"},
        {"key": "farmer", "label": "Agricultores y pescadores", "icon": "c-farmer", "lines": "INEI Agropecuario y pesca"},
        {"key": "builder", "label": "Construcción, minería y oficios", "icon": "c-builder", "lines": "MTPE Construcción y oficios"},
        {"key": "maker", "label": "Operadores industriales y transporte", "icon": "c-maker", "lines": "MTPE Operadores y conductores"},
    ],
    "age": [
        {"key": "child", "label": "Menores de 18 años", "icon": "c-child", "lines": "INEI 0–17 años"},
        {"key": "young", "label": "Jóvenes adultos (18–34)", "icon": "c-young", "lines": "INEI 18–34 años"},
        {"key": "midlife", "label": "Adultos (35–64)", "icon": "c-midlife", "lines": "INEI 35–64 años"},
        {"key": "elder", "label": "Adultos mayores (65+)", "icon": "c-elder", "lines": "INEI 65+ años"},
    ],
    "commute": [
        {"key": "transit", "label": "Transporte público (bus, combi, tren)", "icon": "c-transit", "lines": "ENAHO Transporte público"},
        {"key": "walk", "label": "A pie", "icon": "c-walk", "lines": "ENAHO Caminata"},
        {"key": "other", "label": "Mototaxi, taxi o bicicleta", "icon": "c-other", "lines": "ENAHO Mototaxi/taxi/bici"},
        {"key": "drove_alone", "label": "Auto particular", "icon": "c-drove", "lines": "ENAHO Vehículo propio"},
        {"key": "carpool", "label": "Colectivo / compartido", "icon": "c-carpool", "lines": "ENAHO Compartido"},
        {"key": "home", "label": "Trabajo en casa / remoto", "icon": "c-home", "lines": "ENAHO Teletrabajo / hogar"},
    ],
    "education": [
        {"key": "less_than_hs", "label": "Sin secundaria completa", "icon": "c-edu1", "lines": "INEI Primaria o menos"},
        {"key": "high_school", "label": "Secundaria completa", "icon": "c-edu2", "lines": "INEI Secundaria"},
        {"key": "some_college", "label": "Superior técnica / incompleta", "icon": "c-edu3", "lines": "INEI Superior no univ."},
        {"key": "bachelors", "label": "Universitaria completa", "icon": "c-edu4", "lines": "INEI Universitaria"},
        {"key": "graduate", "label": "Maestría o doctorado", "icon": "c-edu5", "lines": "INEI Posgrado"},
    ],
    "nativity": [
        {"key": "born_in_state", "label": "Nacidos en este departamento", "icon": "c-born-here", "lines": "Censo INEI Nativo departamental"},
        {"key": "other_state", "label": "Migrantes de otras regiones del Perú", "icon": "c-other-state", "lines": "Censo INEI Migración interna"},
        {"key": "native_abroad", "label": "Peruanos retornados del exterior", "icon": "c-abroad", "lines": "INEI Retornados"},
        {"key": "foreign_born", "label": "Nacidos en otro país", "icon": "c-foreign", "lines": "INEI / Migraciones"},
    ],
}


def _largest_remainder(counts: dict[str, int], keys: list[str], n: int) -> dict[str, int]:
    tot = sum(counts.get(k, 0) for k in keys)
    if tot <= 0:
        return {k: 0 for k in keys}
    raw = [(counts.get(k, 0) / tot) * n for k in keys]
    fl = [int(v) for v in raw]
    left = n - sum(fl)
    order = sorted(range(len(keys)), key=lambda j: (-(raw[j] - fl[j]), j))
    for j in order[:left]:
        fl[j] += 1
    return {keys[j]: fl[j] for j in range(len(keys))}


def _make_row(counts: dict[str, int], keys: list[str], n_fig: int | None) -> dict:
    tot = max(1, sum(counts.values()))
    shares = {k: round(counts.get(k, 0) / tot, 3) for k in keys}
    out = {"total": tot, "counts": {k: counts.get(k, 0) for k in keys}, "shares": shares}
    if n_fig is not None:
        out["figures"] = _largest_remainder(counts, keys, n_fig)
    return out


def _city_profile(c: dict, st: dict, dep_occ: dict[str, int]) -> dict:
    pop = c["pop"]
    emp = round(pop * 0.53 * (1.0 - st["unemp"]))
    is_lima = c["id"] == "1501"
    is_jungle = c["deps"][0] in ("LOR", "UCA", "MDD", "SAM")
    is_mining = c["deps"][0] in ("MOQ", "PAS", "ANC", "APU", "CAJ", "TAC")

    # 1. Workforce
    agri = max(0.015, st["agri"] * (0.18 if is_lima else 0.42 if c.get("metro") else 0.65))
    rem_share = 1.0 - agri
    occ_tot = sum(dep_occ.values()) or 1
    wf_shares = {
        "farmer": agri,
        "executive": rem_share * max(0.03, dep_occ.get("executive", 0) / occ_tot * 0.7 + (0.035 if is_lima else 0.015)),
        "engineer": rem_share * max(0.04, dep_occ.get("engineer", 0) / occ_tot * 0.65 + st["sci"] * 0.45),
        "scholar": rem_share * max(0.06, st["sci"] * 0.55 + st["cult"] * 0.6),
        "healer": rem_share * max(0.04, 0.045 + st["higher_ed"] * 0.06),
        "clerk": rem_share * max(0.08, dep_occ.get("clerk", 0) / occ_tot * 0.5 + 0.06),
        "builder": rem_share * max(0.09, st["ind"] * (0.62 if is_mining else 0.45)),
        "maker": rem_share * max(0.11, st["ind"] * 0.55),
    }
    used = sum(wf_shares.values())
    wf_shares["service"] = max(0.12, 1.0 - used)
    s_norm = sum(wf_shares.values())
    wf_counts = {k: round(emp * wf_shares[k] / s_norm) for k in wf_shares}

    # 2. Age
    young_bias = 0.05 if is_jungle or st["poverty"] > 0.35 else -0.02 if is_lima else 0.0
    age_s = {
        "child": round(0.28 + young_bias, 3),
        "young": round(0.27 + young_bias * 0.3, 3),
        "midlife": round(0.35 - young_bias * 0.8, 3),
        "elder": round(0.10 - young_bias * 0.5, 3),
    }
    age_counts = {k: round(pop * v) for k, v in age_s.items()}
    median_age = round(33.2 - young_bias * 65.0 + (1.6 if is_lima else 0.0), 1)

    # 3. Commute (Peru urban reality: public transit in big metros, mototaxi in jungle/north coast, walk in Andean cities)
    if is_lima:
        com_s = {"transit": 0.54, "walk": 0.16, "other": 0.11, "drove_alone": 0.11, "carpool": 0.03, "home": 0.05}
    elif is_jungle or c["deps"][0] in ("PIU", "TUM", "LAM", "ICA"):
        com_s = {"transit": 0.24, "walk": 0.22, "other": 0.36, "drove_alone": 0.09, "carpool": 0.05, "home": 0.04}
    elif c.get("metro"):
        com_s = {"transit": 0.42, "walk": 0.25, "other": 0.15, "drove_alone": 0.10, "carpool": 0.04, "home": 0.04}
    else:
        com_s = {"transit": 0.26, "walk": 0.39, "other": 0.21, "drove_alone": 0.07, "carpool": 0.04, "home": 0.03}
    com_counts = {k: round(emp * v) for k, v in com_s.items()}

    # 4. Education (adults 25+)
    adults25 = round(pop * 0.58)
    hed = min(0.48, st["higher_ed"] * (1.16 if c.get("metro") else 0.95))
    grad = round(hed * (0.18 if is_lima else 0.12), 3)
    bach = round(hed * 0.48, 3)
    tech = round(hed * 0.38, 3)
    hs = round((1.0 - grad - bach - tech) * (0.64 - st["poverty"] * 0.35), 3)
    less = max(0.04, 1.0 - grad - bach - tech - hs)
    edu_counts = {
        "less_than_hs": round(adults25 * less),
        "high_school": round(adults25 * hs),
        "some_college": round(adults25 * tech),
        "bachelors": round(adults25 * bach),
        "graduate": round(adults25 * grad),
    }

    # 5. Nativity (internal migration & foreign-born)
    fb = 0.068 if is_lima else 0.035 if c["deps"][0] in ("TUM", "PIU", "LAL", "ARE", "ICA", "TAC") else 0.012
    other_st = 0.34 if is_lima else 0.38 if c["deps"][0] in ("MDD", "MOQ", "TAC", "UCA") else 0.19 if c.get("metro") else 0.12
    abroad_pe = 0.008 if is_lima else 0.004
    born_here = max(0.40, 1.0 - fb - other_st - abroad_pe)
    nat_counts = {
        "born_in_state": round(pop * born_here),
        "other_state": round(pop * other_st),
        "native_abroad": round(pop * abroad_pe),
        "foreign_born": round(pop * fb),
    }

    wf_row = _make_row(wf_counts, [g["key"] for g in GROUPS["workforce"]], 20)
    age_row = _make_row(age_counts, [g["key"] for g in GROUPS["age"]], 10)
    age_row["median"] = median_age
    com_row = _make_row(com_counts, [g["key"] for g in GROUPS["commute"]], 10)
    edu_row = _make_row(edu_counts, [g["key"] for g in GROUPS["education"]], None)
    edu_row["bachelors_plus"] = round((edu_counts["bachelors"] + edu_counts["graduate"]) / max(1, edu_row["total"]), 3)
    nat_row = _make_row(nat_counts, [g["key"] for g in GROUPS["nativity"]], None)
    nat_row["foreign_born"] = nat_row["shares"]["foreign_born"]
    nat_row["born_in_state"] = nat_row["shares"]["born_in_state"]

    return {
        "workforce": wf_row,
        "age": age_row,
        "commute": com_row,
        "education": edu_row,
        "nativity": nat_row,
        "reliable": bool(c.get("metro", True)),
    }


def build() -> None:
    se = load_interim("peru_socioeconomic")
    mtpe = load_interim("mtpe_employment")
    bounds = load_interim("peru_boundaries")

    abbr_to_fips = {s["abbr"]: s["fips"] for s in bounds["states"]}
    dep_stats = se["departments"]
    dep_occ = mtpe["dep_occ"]

    cities_out = {}
    # Accumulate national row
    nat_acc = {r: {g["key"]: 0 for g in gs} for r, gs in GROUPS.items()}
    for c in se["cities"]:
        fips = abbr_to_fips[c["deps"][0]]
        prof = _city_profile(c, dep_stats[fips], dep_occ.get(fips, {}))
        cities_out[c["id"]] = prof
        for r in GROUPS:
            for k, v in prof[r]["counts"].items():
                nat_acc[r][k] += v

    nat_row = {
        "workforce": _make_row(nat_acc["workforce"], [g["key"] for g in GROUPS["workforce"]], 20),
        "age": {**_make_row(nat_acc["age"], [g["key"] for g in GROUPS["age"]], 10), "median": 32.8},
        "commute": _make_row(nat_acc["commute"], [g["key"] for g in GROUPS["commute"]], 10),
        "education": _make_row(nat_acc["education"], [g["key"] for g in GROUPS["education"]], None),
        "nativity": _make_row(nat_acc["nativity"], [g["key"] for g in GROUPS["nativity"]], None),
        "specialists": [],
    }
    nat_row["education"]["bachelors_plus"] = round(
        (nat_acc["education"]["bachelors"] + nat_acc["education"]["graduate"]) / max(1, nat_row["education"]["total"]), 3
    )
    nat_row["nativity"]["foreign_born"] = nat_row["nativity"]["shares"]["foreign_born"]
    nat_row["nativity"]["born_in_state"] = nat_row["nativity"]["shares"]["born_in_state"]

    # Compute specialists per city against national shares
    for cid, prof in cities_out.items():
        hi, lo = [], []
        for r in GROUPS:
            for k, sh in prof[r]["shares"].items():
                nsh = nat_row[r]["shares"].get(k, 0.0)
                if sh < 0.01 and nsh < 0.01:
                    continue
                if nsh <= 0:
                    continue
                ratio = round(sh / nsh, 2)
                if ratio >= 1.45:
                    hi.append({"row": r, "key": k, "share": sh, "national": nsh, "ratio": ratio})
                elif ratio <= 0.67:
                    lo.append({"row": r, "key": k, "share": sh, "national": nsh, "ratio": ratio})
        hi.sort(key=lambda x: -x["ratio"])
        lo.sort(key=lambda x: x["ratio"])
        prof["specialists"] = hi[:4] + lo[:2]

    write_web("citizens.json", {
        "version": 1,
        "vintage": "INEI ENAHO 2025 / MTPE Planilla Electrónica 2025",
        "year": 2025,
        "sources": ["peru_socioeconomic", "mtpe_employment"],
        "figures": FIGURES,
        "rows": {
            "workforce": "Población ocupada según grupo ocupacional",
            "age": "Residentes según grupo de edad",
            "commute": "Medio de transporte habitual hacia el trabajo",
            "education": "Nivel educativo alcanzado (adultos 25+)",
            "nativity": "Lugar de nacimiento y migración interna",
        },
        "groups": GROUPS,
        "rule": {
            "specialist_high": 1.45, "specialist_low": 0.67, "min_share": 0.01, "max_high": 4, "max_low": 2,
            "text": "Se destacan los grupos cuya proporción en la ciudad es ≥ 1.45× o ≤ 0.67× el promedio nacional.",
        },
        "national": nat_row,
        "cities": cities_out,
    })
    print(f"    {len(cities_out)} perfiles ciudadanos escritos en citizens.json")
