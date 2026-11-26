import csv
from collections import defaultdict

from ..core.source import Source, SourceInfo

SERNANP_URL = "https://www.datosabiertos.gob.pe/sites/default/files/SERNANPdataset_Turismo.csv"
MINCETUR_URL = "https://datosabiertos.mincetur.gob.pe/DGIETA/Visitantes_sitios_turisticos.csv"
SUNEDU_URL = "https://www.datosabiertos.gob.pe/sites/default/files/Licenciamiento%20Institucional_18.csv"


def _parse_int(s: str) -> int:
    try:
        return int(float((s or "0").strip().replace(",", "")))
    except ValueError:
        return 0


class SernanpVisits(Source):
    info = SourceInfo(
        id="sernanp_visits",
        title="Frecuencia de visitas turísticas en las Áreas Naturales Protegidas",
        publisher="Servicio Nacional de Áreas Naturales Protegidas por el Estado (SERNANP)",
        homepage="https://www.datosabiertos.gob.pe/dataset/frecuencia-de-visitas-tur%C3%ADsticas-en-las-%C3%A1reas-naturales-protegidas-por-el-estado-%E2%80%93-servicio",
        license="Datos Abiertos del Estado Peruano",
        description="Visitas turísticas registradas en Parques Nacionales, Reservas Nacionales y Santuarios del Perú.",
        used_for=["Maravillas naturales (Áreas Naturales Protegidas más visitadas)"],
    )

    def fetch(self, force=False):
        self.download(SERNANP_URL, "sernanp_turismo.csv", force=force)

    def process(self):
        by_year_anp: dict[tuple[int, str], dict] = {}
        with open(self.raw_dir / "sernanp_turismo.csv", encoding="utf-8-sig", errors="replace", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                norm = {k.strip().upper(): (v or "").strip() for k, v in row.items() if k}
                anp = norm.get("ANP", "")
                fecha = norm.get("FECHA", "")
                if not anp or len(fecha) < 4 or not fecha[:4].isdigit():
                    continue
                yr = int(fecha[:4])
                vis = (
                    _parse_int(norm.get("VISITAS_E1", "0"))
                    + _parse_int(norm.get("VISITAS_E2A3", "0"))
                    + _parse_int(norm.get("VISITAS_E3A30", "0"))
                )
                rec = by_year_anp.setdefault(
                    (yr, anp),
                    {"anp": anp, "year": yr, "visits": 0, "dep": norm.get("DEPARTAMENTO", ""), "ubigeo": norm.get("UBIGEO", "")},
                )
                rec["visits"] += vis
        if not by_year_anp:
            return {"vintage": "SERNANP", "_files": ["sernanp_turismo.csv"], "year": 2023, "parks": []}
        years = defaultdict(int)
        for (yr, _), rec in by_year_anp.items():
            years[yr] += rec["visits"]
        best_year = max(years, key=lambda y: years[y])
        parks = sorted([r for (yr, _), r in by_year_anp.items() if yr == best_year], key=lambda x: -x["visits"])
        print(f"    {len(parks)} ANP SERNANP ({best_year}, {sum(p['visits'] for p in parks):,} visitas)")
        return {
            "vintage": f"SERNANP Visitas ANP {best_year} (PNDA)",
            "_files": ["sernanp_turismo.csv"],
            "year": best_year,
            "parks": parks,
        }


class MinceturSites(Source):
    info = SourceInfo(
        id="mincetur_sites",
        title="Visitantes a sitios turísticos del Perú",
        publisher="Ministerio de Comercio Exterior y Turismo (MINCETUR)",
        homepage="https://www.datosabiertos.gob.pe/dataset/visitantes-sitios-tur%C3%ADsticos-del-per%C3%BA-ministerio-de-comercio-exterior-y-turismo-mincetur",
        license="Datos Abiertos del Estado Peruano",
        description="Número de visitantes nacionales y extranjeros a los principales sitios arqueológicos, "
        "museos y atractivos culturales del Perú (Machu Picchu, Sacsayhuamán, Chan Chan, Caral, Kuélap, etc.).",
        used_for=["Maravillas culturales y arqueológicas del Perú"],
    )

    def fetch(self, force=False):
        self.download(MINCETUR_URL, "mincetur_sitios.csv", force=force)

    def process(self):
        by_year_site: dict[tuple[int, str, str], int] = defaultdict(int)
        with open(self.raw_dir / "mincetur_sitios.csv", encoding="utf-8-sig", errors="replace", newline="") as f:
            reader = csv.DictReader(f, delimiter=";")
            for row in reader:
                norm = {k.strip().upper(): (v or "").strip() for k, v in row.items() if k}
                yr_s = norm.get("ANIO", "")
                site = norm.get("SITIO_TURISTICO", "")
                dep = norm.get("DEPARTAMENTO", "")
                if not site or not yr_s.isdigit():
                    continue
                yr = int(yr_s)
                vis = _parse_int(norm.get("NUMERO_VISITANTES", "0"))
                by_year_site[(yr, dep, site)] += vis
        years = defaultdict(int)
        for (yr, _, _), v in by_year_site.items():
            years[yr] += v
        # Pick the most recent full year (e.g. 2025 or 2024)
        sorted_yrs = sorted(years.keys(), reverse=True)
        best_year = sorted_yrs[0] if sorted_yrs else 2024
        if len(sorted_yrs) > 1 and years[sorted_yrs[0]] < years[sorted_yrs[1]] * 0.65:
            best_year = sorted_yrs[1]
        sites = [
            {"name": site, "dep": dep, "visits": vis, "year": best_year}
            for (yr, dep, site), vis in by_year_site.items()
            if yr == best_year and vis > 0
        ]
        sites.sort(key=lambda x: -x["visits"])
        print(f"    {len(sites)} sitios turísticos MINCETUR ({best_year}, top: {sites[0]['name'] if sites else '-'})")
        return {
            "vintage": f"MINCETUR Sitios Turísticos {best_year} (PNDA)",
            "_files": ["mincetur_sitios.csv"],
            "year": best_year,
            "sites": sites,
        }


class SuneduUniversities(Source):
    info = SourceInfo(
        id="sunedu_universities",
        title="Licenciamiento Institucional de Universidades",
        publisher="Superintendencia Nacional de Educación Superior Universitaria (SUNEDU)",
        homepage="https://www.datosabiertos.gob.pe/dataset/sunedu-licenciamiento-institucional",
        license="Datos Abiertos del Estado Peruano",
        description="Directorio georreferenciado de universidades licenciadas en el Perú (públicas y privadas), "
        "con periodo de licenciamiento (6, 8 o 10 años), ubicación y coordenadas exactas.",
        used_for=["Maravillas universitarias (Campus de excelencia)", "Indicadores de conocimiento"],
    )

    def fetch(self, force=False):
        self.download(SUNEDU_URL, "sunedu_licenciamiento.csv", force=force)

    def process(self):
        unis = []
        with open(self.raw_dir / "sunedu_licenciamiento.csv", encoding="latin-1", errors="replace", newline="") as f:
            reader = csv.DictReader(f, delimiter="|")
            for row in reader:
                norm = {k.strip().upper(): (v or "").strip() for k, v in row.items() if k}
                if "OTORGADA" not in norm.get("ESTADO_LICENCIAMIENTO", "").upper():
                    continue
                try:
                    lat = float(norm.get("LATITUD", ""))
                    lon = float(norm.get("LONGITUD", ""))
                except ValueError:
                    continue
                unis.append({
                    "code": norm.get("CODIGO_ENTIDAD", ""),
                    "name": norm.get("NOMBRE", ""),
                    "gestion": norm.get("TIPO_GESTION", ""),
                    "period": _parse_int(norm.get("PERIODO_LICENCIAMIENTO", "6")),
                    "dep": norm.get("DEPARTAMENTO", ""),
                    "prov": norm.get("PROVINCIA", ""),
                    "ubigeo": norm.get("UBIGEO", "").zfill(6),
                    "lat": lat,
                    "lon": lon,
                })
        unis.sort(key=lambda u: (-u["period"], u["name"]))
        print(f"    {len(unis)} universidades licenciadas SUNEDU")
        return {
            "vintage": "SUNEDU Licenciamiento Institucional 2024 (PNDA)",
            "_files": ["sunedu_licenciamiento.csv"],
            "universities": unis,
        }
