"""Seguimiento de Proyectos de Inversión MEF (Datos Abiertos) para Gobiernos Regionales.

Extrae de `2026-Seguimiento-PI.csv` las filas de Gobiernos Regionales (`NIVEL_GOBIERNO = R`,
ejercicios 2025–2026) y calcula por departamento (`01..25`): PIA, PIM, Devengado, rubros de
financiamiento y cartera principal de proyectos por CUI para el Día 1 de Etapa 3A.
"""

from __future__ import annotations

import csv
import gzip
import hashlib
import io
import urllib.request
from collections import defaultdict
from pathlib import Path

from ..core import fetch
from ..core.source import Source, SourceInfo

MEF_PI_URL = "https://fs.datosabiertos.mef.gob.pe/datastorefiles/2026-Seguimiento-PI.csv"
RAW_REL = "mef_projects/gore_seguimiento_pi.csv.gz"


def _num(val: str | None) -> float:
    s = (val or "").strip().replace(",", ".")
    try:
        return float(s) if s else 0.0
    except ValueError:
        return 0.0


def _stream_gore_rows(tmp: Path) -> tuple[str, int]:
    req = urllib.request.Request(MEF_PI_URL, headers={"User-Agent": fetch.USER_AGENT})
    kept = 0
    with urllib.request.urlopen(req, timeout=240) as resp, gzip.open(tmp, "wt", encoding="utf-8", newline="") as gz:
        text_stream = io.TextIOWrapper(resp, encoding="utf-8", errors="replace", newline="")
        header_line = text_stream.readline()
        if not header_line:
            raise RuntimeError("Empty MEF Seguimiento-PI CSV")
        gz.write(header_line)
        cols = next(csv.reader([header_line]))
        idx_ano = cols.index("ANO_EJE")
        idx_niv = cols.index("NIVEL_GOBIERNO")
        for line in text_stream:
            parts = line.split(",", idx_niv + 2)
            if len(parts) > idx_niv and parts[idx_niv].strip('"') == "R" and parts[idx_ano].strip('"') in ("2025", "2026"):
                gz.write(line)
                kept += 1
    data = tmp.read_bytes()
    print(f"    MEF stream filtrado: {kept:,} filas GORE 2025–2026 ({len(data) / 1e6:.2f} MB gzip)")
    return hashlib.sha256(data).hexdigest(), len(data)


def _dep_code(row: dict[str, str]) -> str | None:
    dep = (row.get("DEPARTAMENTO_META") or "").strip().zfill(2)
    if dep.isdigit() and 1 <= int(dep) <= 25:
        return dep
    pliego = (row.get("PLIEGO_NOMBRE") or "").upper()
    if "CALLAO" in pliego:
        return "07"
    if "LIMA" in pliego:
        return "15"
    return None


class MefProjects(Source):
    info = SourceInfo(
        id="mef_projects",
        title="Seguimiento de Proyectos de Inversión Pública (MEF — Gobiernos Regionales)",
        publisher="Ministerio de Economía y Finanzas (MEF — Datos Abiertos)",
        homepage="https://www.datosabiertos.gob.pe/dataset/seguimiento-de-proyectos-de-inversi%C3%B3n/resource/edc1964f-a124-475a-9cf7-dc4d952b30b5",
        license="Datos Abiertos del Estado Peruano",
        description="PIA, PIM, Devengado, rubros de financiamiento y cartera por CUI de los 25 Gobiernos Regionales.",
        used_for=["Herencia fiscal Día 1 (PIA/PIM/Devengado/CUI) en game.json", "Clasificación presupuestal por región"],
    )

    def fetch(self, force: bool = False) -> None:
        raw_path = self.raw_dir / "gore_seguimiento_pi.csv.gz"
        if not force and raw_path.exists():
            return
        if self.offline:
            raise fetch.OfflineError("--offline: missing mef_projects/gore_seguimiento_pi.csv.gz")
        fetch._download_with(
            self.id,
            MEF_PI_URL,
            "gore_seguimiento_pi.csv.gz",
            _stream_gore_rows,
            force=force,
            note=" [filtrado GORE 2025–2026]",
            extra={"filter": "NIVEL_GOBIERNO=R, ANO_EJE in (2025,2026)"},
        )

    def process(self) -> dict:
        raw_path = self.raw_dir / "gore_seguimiento_pi.csv.gz"
        by_year: dict[str, dict[str, dict]] = defaultdict(dict)
        cui_map: dict[tuple[str, str, str], dict] = {}
        with gzip.open(raw_path, "rt", encoding="utf-8", errors="replace", newline="") as f:
            for row in csv.DictReader(f):
                yr = (row.get("ANO_EJE") or "").strip()
                dep = _dep_code(row)
                if not dep or yr not in ("2025", "2026"):
                    continue
                reg = by_year[yr].setdefault(dep, {"pia": 0.0, "pim": 0.0, "dev": 0.0, "rubros": defaultdict(lambda: [0.0, 0.0, 0.0])})
                pia, pim, dev = _num(row.get("MONTO_PIA")), _num(row.get("MONTO_PIM")), _num(row.get("MONTO_DEVENGADO_ANO_EJE"))
                reg["pia"] += pia
                reg["pim"] += pim
                reg["dev"] += dev
                rub = (row.get("RUBRO_NOMBRE") or "OTROS").strip()
                rb = reg["rubros"][rub]
                rb[0] += pia
                rb[1] += pim
                rb[2] += dev
                cui = (row.get("PRODUCTO_PROYECTO") or "").strip()
                if cui and pim > 0:
                    c_rec = cui_map.setdefault((yr, dep, cui), {
                        "cui": cui,
                        "name": (row.get("PRODUCTO_PROYECTO_NOMBRE") or "").strip(),
                        "func": (row.get("FUNCION_NOMBRE") or "").strip(),
                        "cost": 0.0, "pim": 0.0, "dev": 0.0, "acum": 0.0,
                    })
                    c_rec["cost"] = max(c_rec["cost"], _num(row.get("COSTO_ACTUAL")))
                    c_rec["pim"] += pim
                    c_rec["dev"] += dev
                    c_rec["acum"] = max(c_rec["acum"], _num(row.get("MONTO_EJECUCION_TOTAL")))

        target_yr = "2026" if sum(v["pim"] for v in by_year.get("2026", {}).values()) > 0 else "2025"
        regions: dict[str, dict] = {}
        for dep, r in sorted(by_year[target_yr].items()):
            top_cui = sorted(
                [v for (y, d, _), v in cui_map.items() if y == target_yr and d == dep],
                key=lambda x: -x["pim"],
            )[:8]
            regions[dep] = {
                "pia": round(r["pia"]),
                "pim": round(r["pim"]),
                "dev": round(r["dev"]),
                "rubros": {k: [round(a), round(b), round(c)] for k, (a, b, c) in sorted(r["rubros"].items()) if b > 0 or a > 0},
                "top_cui": [{**x, "cost": round(x["cost"]), "pim": round(x["pim"]), "dev": round(x["dev"]), "acum": round(x["acum"])} for x in top_cui],
            }
        print(f"    MEF {target_yr}: {len(regions)} regiones GORE, PIM total S/ {sum(v['pim'] for v in regions.values()):,.0f}")
        return {
            "vintage": f"MEF Seguimiento de Proyectos {target_yr} (Datos Abiertos)",
            "_files": ["gore_seguimiento_pi.csv.gz"],
            "year": int(target_yr),
            "regions": regions,
        }
