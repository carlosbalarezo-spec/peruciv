import csv
from collections import defaultdict

from ..core.source import Source, SourceInfo

INDECI_URL = "https://www.datosabiertos.gob.pe/sites/default/files/BD_2003-2025_EMERGENCIAS.csv"
ANEMIA_URL = "https://www.datosabiertos.gob.pe/sites/default/files/anemia_ninos_distrito.csv"
RENTOCA_URL = "https://www.datosabiertos.gob.pe/sites/default/files/BD_RENTOCA_4.csv"


def _parse_int(s: str) -> int:
    try:
        return int(float((s or "0").strip().replace(",", "")))
    except ValueError:
        return 0


def _iso_date(dmy: str, yr_fallback: str) -> str | None:
    parts = (dmy or "").strip().split("/")
    if len(parts) == 3 and len(parts[2]) == 4:
        dd, mm, yyyy = parts[0].zfill(2), parts[1].zfill(2), parts[2]
        if yyyy.isdigit() and mm.isdigit() and dd.isdigit():
            return f"{yyyy}-{mm}-{dd}"
    if yr_fallback and yr_fallback.isdigit() and len(yr_fallback) == 4:
        return f"{yr_fallback}-01-01"
    return None


class IndeciEmergencies(Source):
    info = SourceInfo(
        id="indeci_emergencies",
        title="Emergencias y daños a nivel nacional (2003–2025)",
        publisher="Instituto Nacional de Defensa Civil (INDECI — SINPAD)",
        homepage="https://www.datosabiertos.gob.pe/dataset/emergencias-y-da%C3%B1os-nivel-nacional-por-departamento",
        license="Datos Abiertos del Estado Peruano",
        description="Registro histórico SINPAD de emergencias y desastres por distrito (lluvias intensas, "
        "huaicos, inundaciones, heladas, sismos, incendios forestales y vientos fuertes) entre 2003 y 2025.",
        used_for=["Lente de emergencias y desastres por provincia", "Panel de peligros naturales (disasters.json)"],
    )

    def fetch(self, force=False):
        self.download(INDECI_URL, "indeci_emergencias_2003_2025.csv", force=force)

    def process(self):
        # Map INDECI hazard types into the 6 canonical contract keys:
        # hurricane (huaicos / deslizamientos / El Niño), flood (lluvias / inundaciones),
        # fire (incendios), severe_storm (vientos / tormentas), winter (heladas / friaje), other (sismos / sequías / otros)
        by_prov = defaultdict(lambda: {
            "total": 0, "hurricane": 0, "flood": 0, "fire": 0, "severe_storm": 0, "winter": 0, "other": 0,
            "damnificados": 0, "afectados": 0, "fallecidos": 0, "last_date": None,
        })
        by_dep = defaultdict(lambda: {
            "total": 0, "hurricane": 0, "flood": 0, "fire": 0, "severe_storm": 0, "winter": 0, "other": 0,
            "damnificados": 0, "afectados": 0, "fallecidos": 0,
        })
        by_year = defaultdict(lambda: {"events": 0, "damnificados": 0, "fallecidos": 0})
        recent = []
        total_rows = 0
        max_date = "2025-12-31"

        with open(self.raw_dir / "indeci_emergencias_2003_2025.csv", encoding="latin-1", errors="replace", newline="") as f:
            reader = csv.DictReader(f, delimiter=";")
            for row in reader:
                norm = {k.strip().upper(): (v or "").strip() for k, v in row.items() if k}
                ub = (norm.get("COD. DISTRITO") or "").zfill(6)
                if len(ub) != 6 or not ub.isdigit():
                    continue
                total_rows += 1
                prov = ub[:4]
                dep = ub[:2]
                pel = norm.get("PELIGRO", "").upper()
                yr_s = norm.get("AÑO") or norm.get("ANO") or ""
                dt = _iso_date(norm.get("FECHA  DE LA EMER") or norm.get("FECHA DE LA EMER") or "", yr_s)
                dam = _parse_int(norm.get("DAMNIFICADOS", "0"))
                afe = _parse_int(norm.get("AFECTADOS", "0"))
                fal = _parse_int(norm.get("FALLECIDOS", "0"))

                if any(w in pel for w in ("HUAICO", "HUAYCO", "DESLIZ", "ALUVI", "DERRUMB", "REPTAC")):
                    cat = "hurricane"
                elif any(w in pel for w in ("LLUVIA", "INUND", "DESBORD", "MAREJAD")):
                    cat = "flood"
                elif "INCEND" in pel:
                    cat = "fire"
                elif any(w in pel for w in ("VIENTO", "TEMPEST", "TORMENT", "RAYO")):
                    cat = "severe_storm"
                elif any(w in pel for w in ("HELADA", "FRIAJE", "GRANIZ", "NEVADA", "BAJA TEMP")):
                    cat = "winter"
                else:
                    cat = "other"

                rec = by_prov[prov]
                rec["total"] += 1
                rec[cat] += 1
                rec["damnificados"] += dam
                rec["afectados"] += afe
                rec["fallecidos"] += fal
                if dt and (rec["last_date"] is None or dt > rec["last_date"]):
                    rec["last_date"] = dt
                if dt and dt > max_date:
                    max_date = dt

                drec = by_dep[dep]
                drec["total"] += 1
                drec[cat] += 1
                drec["damnificados"] += dam
                drec["afectados"] += afe
                drec["fallecidos"] += fal

                if dt and dt[:4].isdigit():
                    yr = int(dt[:4])
                    if 2003 <= yr <= 2026:
                        by_year[yr]["events"] += 1
                        by_year[yr]["damnificados"] += dam
                        by_year[yr]["fallecidos"] += fal
                    if dt >= "2025-01-01" and (dam >= 20 or afe >= 100) and len(recent) < 60:
                        recent.append({
                            "id": _parse_int(norm.get("CODIGO DE EMERGENCIA-SINPAD", "0")) or total_rows,
                            "type": cat,
                            "incident_type": pel.title() or "Emergencia",
                            "title": f"{pel.title()} en {norm.get('DIST.', '').title()}",
                            "date": dt,
                            "dep": dep,
                            "prov": prov,
                            "dam": dam,
                        })

        recent.sort(key=lambda x: x["date"], reverse=True)
        print(f"    {total_rows:,} emergencias INDECI en {len(by_prov)} provincias")
        return {
            "vintage": "INDECI SINPAD 2003–2025 (PNDA)",
            "_files": ["indeci_emergencias_2003_2025.csv"],
            "as_of": max_date,
            "by_prov": dict(by_prov),
            "by_dep": dict(by_dep),
            "by_year": {str(k): v for k, v in sorted(by_year.items())},
            "recent": recent[:35],
        }


class MinsaAnemia(Source):
    info = SourceInfo(
        id="minsa_anemia",
        title="Anemia en Niñas y Niños Menores de 36 Meses por Distrito",
        publisher="Ministerio de Salud (MINSA)",
        homepage="https://www.datosabiertos.gob.pe/dataset/anemia-en-ni%C3%B1as-y-ni%C3%B1os-menores-de-36-meses-casos-tratamiento-y-recuperaci%C3%B3n-por-distrito",
        license="Datos Abiertos del Estado Peruano",
        description="Casos diagnosticados, tratamiento y recuperación de anemia infantil (<36 meses) por distrito.",
        used_for=["Indicadores de salud infantil"],
    )

    def fetch(self, force=False):
        self.download(ANEMIA_URL, "anemia_distrito.csv", force=force)

    def process(self):
        by_prov = defaultdict(lambda: {"casos": 0, "eval_6m": 0, "anemia_6m": 0, "recuperad": 0})
        with open(self.raw_dir / "anemia_distrito.csv", encoding="utf-8-sig", errors="replace", newline="") as f:
            reader = csv.DictReader(f, delimiter=";")
            for row in reader:
                norm = {k.strip().upper(): (v or "").strip() for k, v in row.items() if k}
                prov = (norm.get("COD_PROV") or "").zfill(4)
                if len(prov) != 4 or not prov.isdigit():
                    continue
                rec = by_prov[prov]
                rec["casos"] += _parse_int(norm.get("CASOS", "0"))
                rec["eval_6m"] += _parse_int(norm.get("EVAL_6M", "0"))
                rec["anemia_6m"] += _parse_int(norm.get("ANEMIA_6M", "0"))
                rec["recuperad"] += _parse_int(norm.get("RECUPERAD", "0"))
        out = {}
        for prov, r in by_prov.items():
            pct_recup = round(r["recuperad"] / r["casos"], 4) if r["casos"] > 0 else None
            pct_6m = round(r["anemia_6m"] / r["eval_6m"], 4) if r["eval_6m"] > 0 else None
            out[prov] = {**r, "recup_pct": pct_recup, "anem_6m_pct": pct_6m}
        return {
            "vintage": "MINSA Anemia Infantil 2024–2026 (PNDA)",
            "_files": ["anemia_distrito.csv"],
            "by_prov": out,
        }


class MinculRentoca(Source):
    info = SourceInfo(
        id="mincul_rentoca",
        title="Trabajadores y organizaciones de la cultura y las artes (RENTOCA)",
        publisher="Ministerio de Cultura",
        homepage="https://www.datosabiertos.gob.pe/dataset/trabajadores-y-organizaciones-de-la-cultura-y-las-artes-registrados-en-rentoca-%E2%80%93-ministerio",
        license="Datos Abiertos del Estado Peruano",
        description="Registro Nacional de Trabajadores y Organizaciones de la Cultura y las Artes por ubigeo.",
        used_for=["Rendimiento de Cultura por provincia y ciudad", "Lente cultural"],
    )

    def fetch(self, force=False):
        self.download(RENTOCA_URL, "rentoca.csv", force=force)

    def process(self):
        by_prov = defaultdict(int)
        by_dep = defaultdict(int)
        total = 0
        with open(self.raw_dir / "rentoca.csv", encoding="utf-8-sig", errors="replace", newline="") as f:
            reader = csv.DictReader(f, delimiter=";")
            for row in reader:
                norm = {k.strip().upper(): (v or "").strip() for k, v in row.items() if k}
                ub = (norm.get("UBIGEO") or "").zfill(6)
                if len(ub) == 6 and ub.isdigit():
                    by_prov[ub[:4]] += 1
                    by_dep[ub[:2]] += 1
                    total += 1
        print(f"    {total:,} registros culturales RENTOCA en {len(by_prov)} provincias")
        return {
            "vintage": "Ministerio de Cultura RENTOCA 2026 (PNDA)",
            "_files": ["rentoca.csv"],
            "total": total,
            "by_prov": dict(by_prov),
            "by_dep": dict(by_dep),
        }
