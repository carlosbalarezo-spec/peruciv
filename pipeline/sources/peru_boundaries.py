import csv
import io
import math
import zipfile
from collections import defaultdict

from ..core.geo import read_shapefile_zip
from ..core.source import Source, SourceInfo

DEP_URL = "https://www.datosabiertos.gob.pe/sites/default/files/DEPARTAMENTOS_LIMITES.zip"
DIST_URL = "https://www.datosabiertos.gob.pe/sites/default/files/DISTRITOS_LIMITES.zip"
UBIGEO_URL = "https://www.inei.gob.pe/media/DATOS_ABIERTOS/UBIGEOS/UBIGEOS_2022_1891_distritos.zip"

DEP_ABBR = {
    "01": "AMA", "02": "ANC", "03": "APU", "04": "ARE", "05": "AYA",
    "06": "CAJ", "07": "CAL", "08": "CUS", "09": "HUV", "10": "HUC",
    "11": "ICA", "12": "JUN", "13": "LAL", "14": "LAM", "15": "LIM",
    "16": "LOR", "17": "MDD", "18": "MOQ", "19": "PAS", "20": "PIU",
    "21": "PUN", "22": "SAM", "23": "TAC", "24": "TUM", "25": "UCA",
}

DEP_TITLE = {
    "01": "Amazonas", "02": "Áncash", "03": "Apurímac", "04": "Arequipa",
    "05": "Ayacucho", "06": "Cajamarca", "07": "Callao", "08": "Cusco",
    "09": "Huancavelica", "10": "Huánuco", "11": "Ica", "12": "Junín",
    "13": "La Libertad", "14": "Lambayeque", "15": "Lima", "16": "Loreto",
    "17": "Madre de Dios", "18": "Moquegua", "19": "Pasco", "20": "Piura",
    "21": "Puno", "22": "San Martín", "23": "Tacna", "24": "Tumbes",
    "25": "Ucayali",
}


def _title_es(name: str) -> str:
    minor = {"de", "del", "la", "las", "los", "y", "el", "en"}
    words = name.strip().lower().split()
    out = []
    for i, w in enumerate(words):
        if i > 0 and w in minor:
            out.append(w)
        else:
            out.append(w.capitalize())
    return " ".join(out)


def _ring_area_km2(ring: list[tuple[float, float]]) -> float:
    if len(ring) < 3:
        return 0.0
    lat0 = sum(p[1] for p in ring) / len(ring)
    kx = 111.32 * math.cos(math.radians(lat0))
    ky = 110.57
    area = 0.0
    j = len(ring) - 1
    for i in range(len(ring)):
        area += (ring[j][0] * kx) * (ring[i][1] * ky) - (ring[i][0] * kx) * (ring[j][1] * ky)
        j = i
    return abs(area) * 0.5


def _ring_centroid(rings: list[list[tuple[float, float]]]) -> tuple[float, float]:
    best = max(rings, key=_ring_area_km2)
    lon = sum(p[0] for p in best) / len(best)
    lat = sum(p[1] for p in best) / len(best)
    return round(lon, 5), round(lat, 5)


class PeruBoundaries(Source):
    info = SourceInfo(
        id="peru_boundaries",
        title="Límites Departamentales, Distritales y Códigos de Ubigeo",
        publisher="Plataforma Nacional de Datos Abiertos (PCM) e INEI",
        homepage="https://www.datosabiertos.gob.pe/dataset/limites-departamentales",
        license="Datos Abiertos del Estado Peruano (uso libre)",
        description="Polígonos oficiales de los 24 departamentos y la Provincia Constitucional del Callao, "
        "y polígonos distritales agrupados en las 196 provincias del Perú junto con sus códigos UBIGEO (INEI).",
        used_for=["Tierra vs. agua", "Límites departamentales (25 regiones)", "196 provincias y áreas"],
    )

    def fetch(self, force=False):
        self.download(DEP_URL, "DEPARTAMENTOS_LIMITES.zip", force=force)
        self.download(DIST_URL, "DISTRITOS_LIMITES.zip", force=force)
        self.download(UBIGEO_URL, "UBIGEOS_2022_1891_distritos.zip", force=force)

    def process(self):
        # 1. Read ubigeo lookup from INEI zip
        prov_meta: dict[str, dict] = {}
        with zipfile.ZipFile(self.raw_dir / "UBIGEOS_2022_1891_distritos.zip") as zf:
            csv_name = next((n for n in zf.namelist() if n.lower().endswith(".csv")), None)
            if csv_name:
                raw_text = zf.read(csv_name).decode("utf-8-sig", errors="replace")
                delim = ";" if raw_text.splitlines()[0].count(";") > raw_text.splitlines()[0].count(",") else ","
                for row in csv.DictReader(io.StringIO(raw_text), delimiter=delim):
                    norm = {k.strip().upper(): (v or "").strip() for k, v in row.items() if k}
                    ub = (norm.get("UBIGEO") or norm.get("IDDIST") or "").zfill(6)
                    if len(ub) == 6 and ub.isdigit():
                        pid = ub[:4]
                        if pid not in prov_meta:
                            prov_meta[pid] = {
                                "geoid": pid,
                                "state_fips": ub[:2],
                                "name": _title_es(norm.get("PROVINCIA") or norm.get("NOMBPROV") or pid),
                                "dep_name": DEP_TITLE.get(ub[:2], _title_es(norm.get("DEPARTAMENTO") or "")),
                            }

        # 2. Read department polygons
        dep_rings: dict[str, list[list[tuple[float, float]]]] = defaultdict(list)
        for props, rings in read_shapefile_zip(self.raw_dir / "DEPARTAMENTOS_LIMITES.zip", simplify_deg=0.008):
            p = {k.upper(): v for k, v in props.items()}
            code = (p.get("CODDEP") or p.get("IDDPTO") or p.get("CCDD") or p.get("COD_DEP") or "").zfill(2)
            if code in DEP_ABBR and rings:
                dep_rings[code].extend(rings)

        states = []
        for code in sorted(dep_rings.keys()):
            states.append({
                "fips": code,
                "abbr": DEP_ABBR[code],
                "name": DEP_TITLE[code],
                "rings": dep_rings[code],
            })

        # 3. Read district polygons and group by 4-digit province code (196 provinces)
        prov_rings: dict[str, list[list[tuple[float, float]]]] = defaultdict(list)
        prov_names: dict[str, str] = {}
        prov_area: dict[str, float] = defaultdict(float)
        for props, rings in read_shapefile_zip(self.raw_dir / "DISTRITOS_LIMITES.zip", simplify_deg=0.008):
            p = {k.upper(): v for k, v in props.items()}
            ub = (p.get("IDDIST") or p.get("UBIGEO") or "").zfill(6)
            pid = (p.get("IDPROV") or ub[:4]).zfill(4)
            if len(pid) != 4 or not pid.isdigit() or pid[:2] not in DEP_ABBR or not rings:
                continue
            prov_rings[pid].extend(rings)
            for r in rings:
                prov_area[pid] += _ring_area_km2(r)
            if pid not in prov_names:
                raw_name = p.get("NOMBPROV") or p.get("PROVINCIA") or ""
                if raw_name:
                    prov_names[pid] = _title_es(raw_name)

        counties = []
        for pid in sorted(prov_rings.keys()):
            rings = prov_rings[pid]
            clon, clat = _ring_centroid(rings)
            name = prov_meta.get(pid, {}).get("name") or prov_names.get(pid) or pid
            counties.append({
                "geoid": pid,
                "state_fips": pid[:2],
                "name": name,
                "land_km2": round(prov_area[pid], 1),
                "lon": clon,
                "lat": clat,
                "rings": rings,
            })

        print(f"    {len(states)} departamentos, {len(counties)} provincias cargadas")
        return {
            "vintage": "Límites PNDA / INEI Ubigeos 2022",
            "_files": [
                "DEPARTAMENTOS_LIMITES.zip",
                "DISTRITOS_LIMITES.zip",
                "UBIGEOS_2022_1891_distritos.zip",
            ],
            "states": states,
            "counties": counties,
        }
