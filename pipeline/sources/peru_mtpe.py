"""Formal private employment microdata from MTPE (Planilla Electrónica, Dec 2025) on datosabiertos.gob.pe.

Fetches a 24 MB HTTP Range sample (~62,000 worker records across all 25 Peruvian departments)
to compute industry specialization, salaries, occupational mix, age groups, and education levels.
"""

from __future__ import annotations

import csv
import io
from collections import defaultdict

from ..core.source import Source, SourceInfo

MTPE_URL = (
    "https://www.datosabiertos.gob.pe/sites/default/files/"
    "Empleo%20en%20el%20sector%20formal%20privado%20-%20202512%20"
    "%5BMinisterio%20de%20Trabajo%20y%20Promoci%C3%B3n%20del%20Empleo%20-%20MTPE%5D.csv"
)
RANGE_BYTES = 25_165_823  # 24 MB (~62k worker rows)

DEP_NAME_TO_FIPS = {
    "AMAZONAS": "01", "ANCASH": "02", "ÁNCASH": "02", "APURIMAC": "03", "APURÍMAC": "03",
    "AREQUIPA": "04", "AYACUCHO": "05", "CAJAMARCA": "06", "CALLAO": "07",
    "PROV. CONST. DEL CALLAO": "07", "CUSCO": "08", "HUANCAVELICA": "09",
    "HUANUCO": "10", "HUÁNUCO": "10", "ICA": "11", "JUNIN": "12", "JUNÍN": "12",
    "LA LIBERTAD": "13", "LAMBAYEQUE": "14", "LIMA": "15", "LORETO": "16",
    "MADRE DE DIOS": "17", "MOQUEGUA": "18", "PASCO": "19", "PIURA": "20",
    "PUNO": "21", "SAN MARTIN": "22", "SAN MARTÍN": "22", "TACNA": "23",
    "TUMBES": "24", "UCAYALI": "25",
}


def _map_sector(sec: str) -> str:
    s = sec.upper()
    if "MINAS" in s or "CANTERAS" in s:
        return "2122"  # Minería metálica e hidrocarburos
    if "PESCA" in s:
        return "1141"  # Pesca y acuicultura
    if "AGRICULTURA" in s or "GANADER" in s or "SILVICULTURA" in s:
        return "111"   # Agroindustria y agricultura
    if "MANUFACTUR" in s:
        return "31_33" # Manufactura
    if "ELECTRICIDAD" in s or "GAS" in s or "AGUA" in s:
        return "2211"  # Energía y agua
    if "CONSTRUCCI" in s:
        return "23"    # Construcción
    if "COMERCIO" in s:
        return "42_45" # Comercio mayorista y minorista
    if "HOTELES" in s or "RESTAURANTES" in s:
        return "721"   # Hotelería, gastronomía y turismo
    if "TRANSPORTE" in s or "ALMACENAMIENTO" in s or "COMUNICACIONES" in s:
        return "48_49" # Transporte, puertos y comunicaciones
    if "FINANCIERA" in s:
        return "52"    # Banca, finanzas y seguros
    if "INMOBILIARIAS" in s or "EMPRESARIALES" in s:
        return "54"    # Servicios profesionales, ingeniería y TI
    if "ENSEÑANZA" in s or "ENSENANZA" in s:
        return "6113"  # Educación superior y enseñanza
    if "SALUD" in s:
        return "62"    # Servicios de salud
    if "ADMINISTRACI" in s or "DEFENSA" in s:
        return "92"    # Administración pública
    return "71"        # Servicios culturales, comunitarios y personales


def _map_occupation(oc: str) -> str:
    o = oc.upper()
    if "DIRECTOR" in o or "GERENTE" in o or "PODER EJECUTIVO" in o:
        return "executive"
    if "CIENTIFICO" in o or "CIENTÍFICO" in o or "INTELECTUAL" in o:
        return "engineer"
    if "TÉCNICO" in o or "TECNICO" in o or "NIVEL MEDIO" in o:
        return "scholar"
    if "JEFES" in o or "OFICINA" in o or "ADMINISTRATIVO" in o:
        return "clerk"
    if "SERVICIOS" in o or "VENDEDOR" in o or "COMERCIO" in o:
        return "service"
    if "AGRICULTOR" in o or "AGROPECUARIO" in o or "PESQUERO" in o:
        return "farmer"
    if "CONSTRUCCI" in o or "ARTESANO" in o or "MECÁNICO" in o or "MECANICO" in o or "ELECTRIC" in o:
        return "builder"
    if "OPERADOR" in o or "CONDUCTOR" in o or "MAQUINARIA" in o or "INDUSTRIAL" in o:
        return "maker"
    return "service"


def _map_edu(ed: str) -> str:
    e = ed.upper()
    if "MAESTR" in e or "DOCTOR" in e or "POSTGRADO" in e or "POSGRADO" in e:
        return "graduate"
    if "UNIVERSITARIA COMPLETA" in e or "BACHILLER" in e or "TITULADO" in e:
        return "bachelors"
    if "SUPERIOR" in e or "UNIVERSITARIA INCOMPLETA" in e or "TÉCNICA" in e or "TECNICA" in e:
        return "some_college"
    if "SECUNDARIA COMPLETA" in e:
        return "high_school"
    return "less_than_hs"


def _map_age(ag: str) -> str:
    a = ag.upper()
    if any(x in a for x in ("MENOS DE", "15 A", "18 A", "20 A", "25 A", "30 A")):
        return "young"
    if "65" in a or "70" in a or "MÁS" in a or "MAS DE 65" in a:
        return "elder"
    return "midlife"


class MtpeEmployment(Source):
    info = SourceInfo(
        id="mtpe_employment",
        title="Puestos de Trabajo en el Sector Formal Privado (Planilla Electrónica 2025)",
        publisher="Ministerio de Trabajo y Promoción del Empleo (MTPE — PNDA)",
        homepage="https://www.datosabiertos.gob.pe/dataset/puestos-de-trabajo-registrados-en-el-sector-formal-asalariado-privado-periodo-primer-0",
        license="Datos Abiertos del Estado Peruano",
        description="Muestra representativa de la Planilla Electrónica formal privada (diciembre 2025): "
        "sector económico, remuneración mensual, grupo ocupacional, edad y nivel educativo por departamento.",
        used_for=["Distritos de especialización industrial (LQ) e insignias de ciudad", "Composición ocupacional y salarial"],
    )

    FILE = "mtpe_202512_prefix24mb.csv"

    def fetch(self, force=False):
        self.download(
            MTPE_URL,
            self.FILE,
            force=force,
            headers={"Range": f"bytes=0-{RANGE_BYTES}"},
        )

    def process(self):
        raw = (self.raw_dir / self.FILE).read_bytes().decode("utf-8-sig", errors="replace")
        # Drop trailing partial line from HTTP Range cut
        lines = raw.splitlines()
        if len(lines) > 2:
            lines = lines[:-1]

        dep_sec = defaultdict(lambda: defaultdict(lambda: [0, 0.0]))  # dep -> sector -> [count, sum_rem_pen]
        nat_sec = defaultdict(lambda: [0, 0.0])
        dep_occ = defaultdict(lambda: defaultdict(int))
        dep_edu = defaultdict(lambda: defaultdict(int))
        dep_age = defaultdict(lambda: defaultdict(int))
        total_rows = 0

        reader = csv.DictReader(io.StringIO("\n".join(lines)), delimiter=";")
        for row in reader:
            dep_raw = (row.get("DEPARTAMENTO") or "").strip().upper()
            fips = DEP_NAME_TO_FIPS.get(dep_raw)
            if not fips:
                continue
            try:
                rem = float((row.get("REMUNERACION") or "0").strip().replace(",", "."))
            except ValueError:
                rem = 0.0
            sec = _map_sector(row.get("SECTOR_ECONOMICO") or "")
            occ = _map_occupation(row.get("GRUPO_OCUPACION") or "")
            edu = _map_edu(row.get("NIVEL_EDUCATIVO") or "")
            age = _map_age(row.get("RANGO_EDAD") or "")

            total_rows += 1
            dep_sec[fips][sec][0] += 1
            dep_sec[fips][sec][1] += rem
            nat_sec[sec][0] += 1
            nat_sec[sec][1] += rem
            dep_occ[fips][occ] += 1
            dep_edu[fips][edu] += 1
            dep_age[fips][age] += 1

        print(f"    {total_rows:,} puestos formales MTPE procesados en {len(dep_sec)} departamentos")
        return {
            "vintage": "MTPE Planilla Electrónica (Dic. 2025, muestra PNDA)",
            "_files": [self.FILE],
            "year": 2025,
            "total_sample": total_rows,
            "dep_sector": {d: dict(s) for d, s in dep_sec.items()},
            "nat_sector": dict(nat_sec),
            "dep_occ": {d: dict(o) for d, o in dep_occ.items()},
            "dep_edu": {d: dict(e) for d, e in dep_edu.items()},
            "dep_age": {d: dict(a) for d, a in dep_age.items()},
        }
