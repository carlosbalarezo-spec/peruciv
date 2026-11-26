import csv
from collections import defaultdict

from ..core.source import Source, SourceInfo

AERO_URL = "https://www.datosabiertos.gob.pe/sites/default/files/202608-PDE-REP-00101_0.csv"


def _parse_int(s: str) -> int:
    try:
        return int(float((s or "0").strip().replace(",", "")))
    except ValueError:
        return 0


class OsitranAirports(Source):
    info = SourceInfo(
        id="ositran_airports",
        title="Tráfico de Pasajeros en Aeropuertos Concesionados",
        publisher="Organismo Supervisor de la Inversión en Infraestructura de Transporte de Uso Público (OSITRAN)",
        homepage="https://www.datosabiertos.gob.pe/dataset/tr%C3%A1fico-de-pasajeros-aeropuertos-organismo-supervisor-de-la-inversi%C3%B3n-en-infraestructura-de",
        license="Datos Abiertos del Estado Peruano",
        description="Movimiento mensual de pasajeros nacionales e internacionales en los aeropuertos concesionados del Perú "
        "(LAP Jorge Chávez, ADP, AAP).",
        used_for=["Aeropuertos en el mapa (mejoras de casilla)", "Infraestructura de transporte"],
    )

    def fetch(self, force=False):
        self.download(AERO_URL, "ositran_aeropuertos.csv", force=force)

    def process(self):
        by_yr_code: dict[tuple[int, str], dict] = {}
        with open(self.raw_dir / "ositran_aeropuertos.csv", encoding="utf-8-sig", errors="replace", newline="") as f:
            reader = csv.DictReader(f, delimiter=";")
            for row in reader:
                norm = {k.strip().upper(): (v or "").strip() for k, v in row.items() if k}
                yr_s = norm.get("ANIO", "")
                code = norm.get("SIGLAS_AEROPUERTO", "").upper()
                if not yr_s.isdigit() or not code:
                    continue
                yr = int(yr_s)
                pax = _parse_int(norm.get("CANTIDAD PASAJERO", "0"))
                rec = by_yr_code.setdefault(
                    (yr, code),
                    {"code": code, "name": norm.get("AEROPUERTO", code), "concession": norm.get("CONCESION", ""), "pax": 0},
                )
                rec["pax"] += pax

        years = defaultdict(int)
        for (yr, _), r in by_yr_code.items():
            years[yr] += r["pax"]
        sorted_yrs = sorted(years.keys(), reverse=True)
        best_yr = sorted_yrs[0] if sorted_yrs else 2025
        if len(sorted_yrs) > 1 and years[sorted_yrs[0]] < years[sorted_yrs[1]] * 0.7:
            best_yr = sorted_yrs[1]
        prev_yr = best_yr - 1

        airports = []
        for (yr, code), r in by_yr_code.items():
            if yr != best_yr or r["pax"] <= 0:
                continue
            prev = by_yr_code.get((prev_yr, code), {}).get("pax")
            airports.append({
                "code": code,
                "name": r["name"],
                "pax": r["pax"],
                "pax_prev": prev,
                "year": best_yr,
            })
        airports.sort(key=lambda a: -a["pax"])
        print(f"    {len(airports)} aeropuertos OSITRAN ({best_yr}, total {sum(a['pax'] for a in airports):,} pax)")
        return {
            "vintage": f"OSITRAN Tráfico de Pasajeros {best_yr} (PNDA)",
            "_files": ["ositran_aeropuertos.csv"],
            "year": best_yr,
            "airports": airports,
        }
