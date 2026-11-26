import csv
from collections import defaultdict

from ..core.source import Source, SourceInfo

GEN_URL = "https://www.datosabiertos.gob.pe/sites/default/files/9_Capacidad_Instalada_de_Generaci%C3%B3n_El%C3%A9ctrica.csv"
HIDRO_URL = "https://www.datosabiertos.gob.pe/sites/default/files/6_Producci%C3%B3n_Fiscalizada_de_Hidrocarburos.csv"


def _parse_float(s: str) -> float | None:
    s = (s or "").strip().replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


class MinemGeneration(Source):
    info = SourceInfo(
        id="minem_generation",
        title="Capacidad Instalada de Generación Eléctrica",
        publisher="Ministerio de Energía y Minas (MINEM)",
        homepage="https://www.datosabiertos.gob.pe/dataset/minem-capacidad-instalada-de-generaci%C3%B3n-el%C3%A9ctrica",
        license="Datos Abiertos del Estado Peruano",
        description="Potencia instalada (MW) de las centrales eléctricas del Perú por tipo de origen "
        "(Hidroeléctrica, Térmica/Gas, Solar, Eólica, Biomasa) y sistema (SEIN / Aislado).",
        used_for=["Centrales eléctricas en el mapa (recursos de energía)", "Resumen energético por departamento"],
    )

    def fetch(self, force=False):
        self.download(GEN_URL, "capacidad_instalada.csv", force=force)

    def process(self):
        plants = []
        with open(self.raw_dir / "capacidad_instalada.csv", encoding="latin-1", errors="replace", newline="") as f:
            reader = csv.DictReader(f, delimiter=";")
            for row in reader:
                norm = {k.strip().upper(): (v or "").strip() for k, v in row.items() if k}
                name = norm.get("NOMBRE_DE_CENTRAL") or ""
                mw = _parse_float(norm.get("POTENCIA_INSTALADA", ""))
                if not name or mw is None or mw <= 0:
                    continue
                plants.append({
                    "name": name,
                    "company": norm.get("NOMBRE_DE_EMPRESA", ""),
                    "origin": norm.get("ORIGEN", ""),
                    "system": norm.get("TIPO_DE_SISTEMA", ""),
                    "market": norm.get("TIPO_DE_MERCADO", ""),
                    "mw": round(mw, 2),
                })
        plants.sort(key=lambda p: -p["mw"])
        print(f"    {len(plants)} centrales eléctricas MINEM ({sum(p['mw'] for p in plants):,.0f} MW total)")
        return {
            "vintage": "MINEM Capacidad Instalada (PNDA)",
            "_files": ["capacidad_instalada.csv"],
            "plants": plants,
        }


class MinemHydrocarbons(Source):
    info = SourceInfo(
        id="minem_hydrocarbons",
        title="Producción Fiscalizada de Hidrocarburos",
        publisher="Ministerio de Energía y Minas (MINEM)",
        homepage="https://www.datosabiertos.gob.pe/dataset/minem-producci%C3%B3n-fiscalizada-de-hidrocarburos",
        license="Datos Abiertos del Estado Peruano",
        description="Producción fiscalizada diaria de petróleo crudo, gas natural y líquidos de gas natural "
        "por lote y zona (Noroeste, Zócalo, Selva Norte, Selva Central, Camisea/Selva Sur).",
        used_for=["Lotes petroleros y gasíferos (Camisea, Talara, Loreto) en el mapa"],
    )

    def fetch(self, force=False):
        self.download(HIDRO_URL, "produccion_hidrocarburos.csv", force=force)

    def process(self):
        # Aggregate latest available year per (zone, lote, hydrocarbon)
        by_year_lote: dict[tuple[int, str, str, str, str], float] = defaultdict(float)
        by_year_company: dict[tuple[int, str, str], str] = {}
        max_year = 0
        with open(self.raw_dir / "produccion_hidrocarburos.csv", encoding="latin-1", errors="replace", newline="") as f:
            reader = csv.DictReader(f, delimiter=";")
            for row in reader:
                norm = {k.strip().upper(): (v or "").strip() for k, v in row.items() if k}
                fecha = norm.get("FECHA", "")
                if len(fecha) < 4 or not fecha[:4].isdigit():
                    continue
                yr = int(fecha[:4])
                val = _parse_float(norm.get("VALOR", ""))
                if val is None or val <= 0:
                    continue
                if yr > max_year:
                    max_year = yr
                zona = norm.get("ZONA", "")
                lote = norm.get("LOTE", "")
                hidro = norm.get("HIDROCARBURO_PRODUCIDO", "")
                unit = norm.get("UNIDAD_DE_MEDIDA", "")
                by_year_lote[(yr, zona, lote, hidro, unit)] += val
                by_year_company[(yr, zona, lote)] = norm.get("EMPRESA", "")

        # Keep latest year (or latest-1 if latest has very few rows)
        yr_counts = defaultdict(int)
        for (yr, *_), _ in by_year_lote.items():
            yr_counts[yr] += 1
        target_year = max_year
        if yr_counts.get(max_year, 0) < 5 and (max_year - 1) in yr_counts:
            target_year = max_year - 1

        lots = []
        for (yr, zona, lote, hidro, unit), total in by_year_lote.items():
            if yr != target_year:
                continue
            lots.append({
                "zona": zona,
                "lote": lote,
                "hidrocarburo": hidro,
                "unidad": unit,
                "empresa": by_year_company.get((yr, zona, lote), ""),
                "total": round(total, 1),
                "year": target_year,
            })
        lots.sort(key=lambda x: -x["total"])
        print(f"    {len(lots)} lotes de hidrocarburos MINEM ({target_year})")
        return {
            "vintage": f"MINEM Producción Fiscalizada {target_year} (PNDA)",
            "_files": ["produccion_hidrocarburos.csv"],
            "year": target_year,
            "lots": lots,
        }
