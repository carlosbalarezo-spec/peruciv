"""Build web/data/game.json (contrato v0.1) para los escenarios Ica–Pisco y Arequipa–Matarani."""

from __future__ import annotations

import json
from pathlib import Path

from ..core.paths import INTERIM, WEB_DATA
from ..core.store import write_web

REQUIRES = ["world.json", "states.json", "counties.json", "cities.json", "infrastructure.json"]
PRODUCES = ["game.json"]

LEVEL_MAP = {
    "15": 1, "07": 1, "04": 1, "11": 1, "18": 1,
    "23": 2, "08": 2, "02": 2, "13": 2, "20": 2, "14": 2,
    "12": 3, "22": 3, "24": 3, "17": 3,
    "06": 4, "21": 4, "03": 4, "05": 4, "19": 4, "10": 4,
    "16": 5, "25": 5, "09": 5, "01": 5,
}
LEVEL_LABELS = {
    1: "Nivel 1 · Consolidar",
    2: "Nivel 2 · Conectar",
    3: "Nivel 3 · Diversificar",
    4: "Nivel 4 · Cerrar brechas",
    5: "Nivel 5 · Integrar frontera",
}

SCHEMA_VERSION = "0.1"
RULES_VERSION = "0.1"
DATASET_ID = "peruciv-game-v0.1"
AS_OF = "2026-11-26"
PROVENANCES = {"oficial", "derivada", "supuesto"}


def _load_web(name: str) -> dict | list:
    return json.loads((WEB_DATA / name).read_text(encoding="utf-8"))


def _sources() -> list[dict]:
    return [
        {
            "id": "src-atlas-world",
            "entity": "INEI / PNDA / Natural Earth (Atlas peruciv)",
            "url": "https://www.datosabiertos.gob.pe/dataset/limites-departamentales",
            "table": "world.json + infrastructure.json + cities.json",
            "period": "2022–2025",
            "extractedAt": AS_OF,
            "coverage": "Nacional (25 regiones, 196 provincias, 3,460 hexágonos)",
        },
        {
            "id": "src-mef-ca",
            "entity": "MEF — Seguimiento de Proyectos de Inversión (Datos Abiertos)",
            "url": "https://fs.datosabiertos.mef.gob.pe/datastorefiles/2026-Seguimiento-PI.csv",
            "table": "2026-Seguimiento-PI.csv (Gobiernos Regionales, 17,835 filas)",
            "period": "2026",
            "extractedAt": AS_OF,
            "coverage": "Nacional (25 Gobiernos Regionales)",
        },
        {
            "id": "src-sunass-ana",
            "entity": "SUNASS / ANA (Plan Quilca–Chili)",
            "url": "https://www.gob.pe/66787-consultar-informacion-sobre-las-empresas-prestadoras-de-servicios-de-saneamiento",
            "table": "Benchmarking EPS / Plan de Cuenca",
            "period": "2023–2026",
            "extractedAt": AS_OF,
            "coverage": "SEDAPAR (Arequipa), EMAPICA/SEMAPACH (Ica)",
        },
        {
            "id": "src-mtc-sernanp",
            "entity": "MTC SINAC / SERNANP / APN PIEP",
            "url": "https://portal.mtc.gob.pe/transportes/concesiones/infraestructura_portuaria/portuario_san_martin.html",
            "table": "Red vial PE-1S / PE-28 / Matarani",
            "period": "2024–2026",
            "extractedAt": AS_OF,
            "coverage": "Corredores Arequipa–Matarani e Ica–Pisco",
        },
    ]


def _observations(counties: dict) -> list[dict]:
    cols = {c: i for i, c in enumerate(counties["columns"])}
    by_gid = {r[cols["geoid"]]: r for r in counties["rows"]}
    obs = [
        {
            "id": "obs-aqp-water-cap-official",
            "variable": "water_effective_capacity",
            "subjectId": "node-aqp-water",
            "period": "2026",
            "value": None,
            "unit": "mL/s",
            "provenance": "oficial",
            "sourceId": "src-sunass-ana",
            "note": "Saldo neto en mL/s no publicado en formato tabular; requiere supuesto explícito.",
        },
        {
            "id": "obs-aqp-water-cap-sim",
            "variable": "water_effective_capacity",
            "subjectId": "node-aqp-water",
            "period": "2026",
            "value": 100000,
            "unit": "mL/s",
            "provenance": "supuesto",
            "note": "Simulación Arequipa-Matarani (100 l/s = 100,000 mL/s).",
        },
        {
            "id": "obs-aqp-water-prot-sim",
            "variable": "water_protected_demand",
            "subjectId": "node-aqp-water",
            "period": "2026",
            "value": 82000,
            "unit": "mL/s",
            "provenance": "supuesto",
            "note": "Simulación: 82 l/s protegidos para consumo de hogares.",
        },
        {
            "id": "obs-aqp-water-comm-sim",
            "variable": "water_prior_commitments",
            "subjectId": "node-aqp-water",
            "period": "2026",
            "value": 16000,
            "unit": "mL/s",
            "provenance": "supuesto",
            "note": "Simulación: 16 l/s comprometidos; saldo inicial = 2 l/s.",
        },
        {
            "id": "obs-rival-water-sim",
            "variable": "water_effective_capacity",
            "subjectId": "node-rival-water",
            "period": "2026",
            "value": 110000,
            "unit": "mL/s",
            "provenance": "supuesto",
            "note": "Simulación: nodo hídrico de sede rival.",
        },
    ]
    for gid, label in [("0401", "Arequipa"), ("0407", "Islay"), ("1101", "Ica"), ("1105", "Pisco")]:
        row = by_gid[gid]
        obs.append({
            "id": f"obs-enaho-water-{gid}",
            "variable": "household_water_access_ratio",
            "subjectId": gid,
            "period": "2025",
            "value": round(float(row[cols["water_access"]]) * 1000),
            "unit": "permille",
            "provenance": "derivada",
            "sourceId": "src-atlas-world",
            "method": "ENAHO 2025 Módulo 01 con suavizado empírico bayesiano (lenses_counties.py)",
            "note": f"Cobertura hogares en {label}; contexto, no caudal industrial.",
        })
    return obs


def _territories_and_authorities() -> tuple[list[dict], list[dict]]:
    territories = [
        {"id": "04", "kind": "region", "name": "Arequipa", "parentId": "PE"},
        {"id": "0401", "kind": "province", "name": "Arequipa", "parentId": "04"},
        {"id": "0407", "kind": "province", "name": "Islay", "parentId": "04"},
        {"id": "11", "kind": "region", "name": "Ica", "parentId": "PE"},
        {"id": "1101", "kind": "province", "name": "Ica", "parentId": "11"},
        {"id": "1105", "kind": "province", "name": "Pisco", "parentId": "11"},
    ]
    authorities = [
        {"id": "gore-04", "name": "Gobierno Regional de Arequipa", "kind": "gore", "territoryId": "04"},
        {"id": "muni-0401", "name": "Municipalidad Provincial de Arequipa", "kind": "municipality", "territoryId": "0401"},
        {"id": "gore-11", "name": "Gobierno Regional de Ica", "kind": "gore", "territoryId": "11"},
        {"id": "apn-pisco", "name": "Autoridad Portuaria / Concesionario San Martín", "kind": "port_authority", "territoryId": "1105"},
    ]
    return territories, authorities


def _networks() -> dict:
    nodes = [
        {
            "id": "node-aqp-water",
            "service": "water",
            "territoryId": "0401",
            "capacityRef": "obs-aqp-water-cap-official",
            "protectedDemandRef": "obs-aqp-water-prot-sim",
            "priorCommitmentsRef": "obs-aqp-water-comm-sim",
        },
        {
            "id": "node-rival-water",
            "service": "water",
            "territoryId": "EXT",
            "capacityRef": "obs-rival-water-sim",
            "protectedDemand": 82000,
            "priorCommitments": 16000,
        },
    ]
    edges = [
        {
            "id": "edge-aqp-main",
            "from": "aqp-origin",
            "to": "matarani-port",
            "minutes": 205,
            "cells": [8996, 9077, 9158, 9239],
            "roadRef": "PE-34A / PE-1S",
            "provenance": "supuesto",
        },
        {
            "id": "edge-aqp-detour",
            "from": "aqp-origin",
            "to": "matarani-port",
            "minutes": 265,
            "cells": [8996, 9076, 9157, 9239],
            "roadRef": "Desvío regional alterno",
            "provenance": "supuesto",
        },
        {
            "id": "edge-ica-corridor",
            "from": "ica-origin",
            "to": "ica-access-node",
            "minutes": 65,
            "cells": [7826, 7745, 7744, 7743],
            "roadRef": "PE-1S (Atlas)",
            "provenance": "supuesto",
        },
        {
            "id": "edge-ica-access",
            "from": "ica-access-node",
            "to": "pisco-port",
            "minutes": 45,
            "cells": [7743, 7660],
            "roadRef": "PE-28 / Acceso San Martín",
            "provenance": "supuesto",
        },
    ]
    return {"nodes": nodes, "edges": edges}


def _catalog() -> dict:
    projects = [
        {
            "id": "aqp-water-work",
            "name": "Ampliación hídrica Arequipa (+8 l/s)",
            "actorId": "gore-04",
            "eligibleRubrics": ["capital"],
            "teamId": "files",
            "phases": [{"duration": 30, "cost": 4500}, {"duration": 65, "cost": 0}],
            "maintenance": {"amount": 400, "eligibleRubrics": ["capital"]},
            "effects": [{"type": "nodeCapacity", "nodeId": "node-aqp-water", "capacity": 108000, "protectedDemand": 84000}],
        },
        {
            "id": "aqp-road-work",
            "name": "Mejoramiento corredor Arequipa–Matarani",
            "actorId": "gore-04",
            "eligibleRubrics": ["capital"],
            "teamId": "files",
            "phases": [{"duration": 25, "cost": 4000}, {"duration": 55, "cost": 0}],
            "maintenance": {"amount": 300, "eligibleRubrics": ["capital"]},
            "effects": [
                {"type": "edgeMinutes", "edgeId": "edge-aqp-main", "minutes": 175},
                {"type": "edgeMinutes", "edgeId": "edge-aqp-detour", "minutes": 230},
            ],
        },
        {
            "id": "ica-repair-access",
            "name": "Reparación integral acceso San Martín (Pisco)",
            "actorId": "gore-11",
            "eligibleRubrics": ["capital"],
            "exclusiveGroup": "ica-access",
            "phases": [{"duration": 40, "cost": 2500}],
            "maintenance": {"amount": 200, "eligibleRubrics": ["capital"]},
            "effects": [{"type": "edgeMinutes", "edgeId": "edge-ica-access", "minutes": 15}],
        },
        {
            "id": "ica-schedule-access",
            "name": "Reordenamiento de ventanas de carga (APN)",
            "actorId": "gore-11",
            "eligibleRubrics": ["capital"],
            "exclusiveGroup": "ica-access",
            "phases": [{"duration": 70, "cost": 1000}],
            "effects": [{"type": "edgeMinutes", "edgeId": "edge-ica-access", "minutes": 30}],
        },
    ]
    offers = [
        {
            "id": "offer-aqp-agro",
            "name": "Planta agroindustrial de exportación",
            "date": "2026-05-01",
            "requirements": {"access": True, "maxMinutes": 240, "water": 7000},
            "scales": {
                "reduced": {
                    "virtualMinutes": 10,
                    "water": 2000,
                    "inspectionBefore": "2026-03-02",
                    "fundedBy": "2026-05-06",
                },
            },
            "candidates": [
                {"id": "aqp-full", "siteId": "site-aqp-local", "route": {"from": "aqp-origin", "to": "matarani-port"}, "waterNodeId": "node-aqp-water"},
                {"id": "aqp-staged", "siteId": "site-aqp-local", "route": {"from": "aqp-origin", "to": "matarani-port"}, "waterNodeId": "node-aqp-water", "scale": "reduced", "expansionId": "aqp-water-work"},
                {"id": "aqp-rival", "siteId": "site-aqp-rival", "minutes": 220, "waterNodeId": "node-rival-water"},
            ],
        },
        {
            "id": "offer-ica-cold",
            "name": "Planta logística con cadena de frío (Pisco)",
            "date": "2026-04-01",
            "requirements": {"access": True, "maxMinutes": 90},
            "candidates": [
                {"id": "ica-local", "siteId": "site-ica-local", "route": {"from": "ica-origin", "to": "pisco-port"}},
                {"id": "ica-rival", "siteId": "site-ica-rival", "minutes": 85},
            ],
        },
    ]
    return {"projects": projects, "offers": offers}


def _scenarios() -> list[dict]:
    aqp_agreement = {
        "id": "aqp-fast-access",
        "name": "Convenio prioritario de acceso (MPA)",
        "actorId": "gore-04",
        "counterpartyId": "muni-0401",
        "eligibleRubrics": ["capital"],
        "teamId": "files",
        "teamDays": 10,
        "phases": [{"duration": 10, "cost": 1500}, {"duration": 20, "cost": 0}],
        "maintenance": {"amount": 200, "eligibleRubrics": ["capital"], "actorId": "muni-0401", "fundId": "fund-muni-0401"},
        "effects": [{"type": "access", "siteId": "site-aqp-local"}],
    }
    return [
        {
            "id": "ica-pisco-tutorial",
            "name": "Tutorial · Corredor Ica–Pisco",
            "regionId": "11",
            "startDate": "2026-01-01",
            "endDate": "2026-04-30",
            "actors": ["gore-11", "apn-pisco"],
            "funds": [{"id": "fund-gore-11", "balance": 3000, "rubric": "capital", "actorId": "gore-11"}],
            "sites": [
                {"id": "site-ica-local", "actorId": "gore-11", "cell": 7826, "access": True},
                {"id": "site-ica-rival", "access": True},
            ],
            "projects": ["ica-repair-access", "ica-schedule-access"],
            "offers": ["offer-ica-cold"],
            "goals": [{"id": "investment", "offerId": "offer-ica-cold", "siteId": "site-ica-local"}],
        },
        {
            "id": "arequipa-matarani",
            "name": "Escenario · Arequipa–Matarani",
            "regionId": "04",
            "startDate": "2026-01-01",
            "endDate": "2026-05-31",
            "actors": ["gore-04", "muni-0401"],
            "observationOverrides": {"obs-aqp-water-cap-official": "obs-aqp-water-cap-sim"},
            "funds": [
                {"id": "fund-gore-04", "balance": 6500, "rubric": "capital", "actorId": "gore-04"},
                {"id": "fund-muni-0401", "balance": 200, "rubric": "capital", "actorId": "muni-0401"},
            ],
            "sites": [
                {"id": "site-aqp-local", "actorId": "gore-04", "cell": 8996, "access": False},
                {"id": "site-aqp-rival", "access": True},
            ],
            "projects": ["aqp-water-work", "aqp-road-work"],
            "agreements": [aqp_agreement],
            "offers": ["offer-aqp-agro"],
            "events": [
                {"id": "aqp-ordinary-access", "date": "2026-04-21", "sequence": 0, "effects": [{"type": "access", "siteId": "site-aqp-local"}]},
            ],
            "goals": [{"id": "investment", "offerId": "offer-aqp-agro", "siteId": "site-aqp-local"}],
        },
    ]


def _mef_interim() -> dict:
    p = INTERIM / "mef_projects.json"
    if not p.is_file():
        return {}
    return json.loads(p.read_text(encoding="utf-8")).get("data", {}).get("regions", {})


def _regions_profile(states: list[dict], mef: dict) -> list[dict]:
    out = []
    for st in sorted(states, key=lambda s: s["fips"]):
        fips = st["fips"]
        lvl = LEVEL_MAP.get(fips, 3)
        m = mef.get(fips) or {}
        out.append({
            "id": fips,
            "abbr": st["abbr"],
            "name": st["name"],
            "level": lvl,
            "levelLabel": LEVEL_LABELS[lvl],
            "playableScenario": "arequipa-matarani" if fips == "04" else "ica-pisco-tutorial" if fips == "11" else None,
            "mef2026": {
                "pia": m.get("pia"),
                "pim": m.get("pim"),
                "dev": m.get("dev"),
                "rubros": m.get("rubros", {}),
                "topCui": m.get("top_cui", []),
                "provenance": "oficial" if m else "supuesto",
            },
            "atlas": {
                "population": st.get("population"),
                "energyMw": (st.get("energy") or {}).get("total", 0),
                "yields": st.get("yields", {}),
            },
        })
    return out


def build() -> None:
    world = _load_web("world.json")
    states = _load_web("states.json")
    counties = _load_web("counties.json")
    mef = _mef_interim()
    grid = world["grid"]
    world_ref = f"peruciv-grid-v{world.get('version', 2)}-{grid['cols']}x{grid['rows']}"
    territories, authorities = _territories_and_authorities()
    doc = {
        "schemaVersion": SCHEMA_VERSION,
        "rulesVersion": RULES_VERSION,
        "datasetId": DATASET_ID,
        "asOf": AS_OF,
        "worldRef": world_ref,
        "currency": "PEN_CENTIMOS",
        "units": {"money": "centimos", "water": "mL/s", "energy": "kW", "route": "minutes"},
        "sources": _sources(),
        "observations": _observations(counties),
        "territories": territories,
        "authorities": authorities,
        "regions": _regions_profile(states, mef),
        "networks": _networks(),
        "catalog": _catalog(),
        "scenarios": _scenarios(),
    }
    write_web("game.json", doc)
    print(f"    {len(doc['scenarios'])} escenarios, {len(doc['regions'])} regiones MEF, {len(doc['observations'])} observaciones escritos en game.json")


def check(web_dir: Path) -> list[tuple[str, str]]:
    """Validación de contrato v0.1 para web/data/game.json (descubierta por pipeline.check)."""
    path = web_dir / "game.json"
    if not path.is_file():
        return [("NOTE", "game.json aún no generado")]
    doc = json.loads(path.read_text(encoding="utf-8"))
    out: list[tuple[str, str]] = []
    if doc.get("schemaVersion") != SCHEMA_VERSION or doc.get("rulesVersion") != RULES_VERSION:
        out.append(("FAIL", "game.json: versión de esquema o reglas incompatible"))
    obs = doc.get("observations", [])
    bad_prov = [o.get("id") for o in obs if o.get("provenance") not in PROVENANCES]
    if bad_prov:
        out.append(("FAIL", f"game.json: observaciones sin procedencia válida: {bad_prov}"))
    sids = {s.get("id") for s in doc.get("scenarios", [])}
    if not {"ica-pisco-tutorial", "arequipa-matarani"} <= sids:
        out.append(("FAIL", f"game.json: faltan escenarios base en {sorted(sids)}"))
    if not out:
        out.append(("PASS", f"game.json: v{SCHEMA_VERSION}, {len(obs)} observaciones con procedencia, {len(sids)} escenarios"))
    return out
