from ..core.geo import bbox_intersects, geojson_lines, geojson_rings, load_geojson
from ..core.source import Source, SourceInfo

TAG = "v5.1.2"
BASE = f"https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{TAG}/geojson"
BBOX = (-84.0, -21.0, -66.0, 3.0)  # Peru + neighboring countries & ocean margin


class NaturalEarth(Source):
    info = SourceInfo(
        id="natural_earth",
        title="Natural Earth 1:50m (países vecinos, lagos y ríos)",
        publisher="Natural Earth",
        homepage="https://www.naturalearthdata.com/",
        license="Dominio público",
        description="Países vecinos (Ecuador, Colombia, Brasil, Bolivia y Chile, mostrados con niebla), "
        f"Lago Titicaca y ríos principales (Amazonas, Ucayali, Marañón, Huallaga, Madre de Dios). Versión {TAG}.",
        used_for=["Países vecinos", "Lago Titicaca y lagos", "Ríos principales"],
    )

    FILES = ["ne_50m_admin_0_countries", "ne_50m_lakes", "ne_50m_rivers_lake_centerlines"]

    def _path(self, name):
        return f"{TAG}/{name}.geojson"

    def fetch(self, force=False):
        for name in self.FILES:
            self.download(f"{BASE}/{name}.geojson", self._path(name), force=force)

    def _features(self, name):
        return load_geojson(self.raw_dir / self._path(name))

    def process(self):
        countries = []
        for f in self._features("ne_50m_admin_0_countries"):
            if f["properties"].get("ADM0_A3") == "PER":
                continue
            rings = [r for r in geojson_rings(f["geometry"]) if bbox_intersects(r, BBOX)]
            if rings:
                countries.append({"name": f["properties"]["ADMIN"], "rings": rings})
        lakes = []
        for f in self._features("ne_50m_lakes"):
            rings = geojson_rings(f["geometry"])
            if rings and bbox_intersects(rings[0], BBOX):
                lakes.append({"name": f["properties"].get("name"), "rings": rings})
        rivers = []
        for f in self._features("ne_50m_rivers_lake_centerlines"):
            p = f["properties"]
            for line in geojson_lines(f["geometry"]):
                if bbox_intersects(line, BBOX):
                    rivers.append({
                        "name": p.get("name"),
                        "rank": p.get("scalerank", 10),
                        "featurecla": p.get("featurecla"),
                        "line": line,
                    })
        return {
            "vintage": f"Natural Earth {TAG} (1:50m)",
            "_files": [self._path(n) for n in self.FILES],
            "countries": countries,
            "lakes": lakes,
            "rivers": rivers,
        }


class NaturalEarthRoads(Source):
    info = SourceInfo(
        id="natural_earth_roads",
        title="Natural Earth 1:10m (red vial y ferrocarriles)",
        publisher="Natural Earth",
        homepage="https://www.naturalearthdata.com/",
        license="Dominio público",
        description="Carreteras principales (Panamericana, Longitudinal de la Sierra, Interoceánica, Carretera Central) "
        f"y líneas férreas del Perú (Ferrocarril Central, Ferrocarril del Sur) a escala 1:10m. Versión {TAG}.",
        used_for=["Carreteras principales en el mapa", "Ferrocarriles en el mapa"],
    )

    FILES = ["ne_10m_roads", "ne_10m_railroads"]

    def _path(self, name):
        return f"{TAG}/{name}.geojson"

    def fetch(self, force=False):
        for name in self.FILES:
            self.download(f"{BASE}/{name}.geojson", self._path(name), force=force)

    def process(self):
        roads, rail = [], []
        for f in load_geojson(self.raw_dir / self._path("ne_10m_roads")):
            p = f["properties"]
            if p.get("featurecla") == "Ferry" or p.get("type") == "Ferry Route":
                continue
            if p.get("sov_a3") not in (None, "", "PER"):
                continue
            lines = [ln for ln in geojson_lines(f["geometry"]) if bbox_intersects(ln, BBOX)]
            if not lines:
                continue
            roads.append({
                "level": p.get("level") or None,
                "type": p.get("type") or None,
                "name": (str(p.get("name")).strip() or None) if p.get("name") not in (None, "") else None,
                "expressway": 1 if p.get("expressway") == 1 else 0,
                "scalerank": p.get("scalerank"),
                "lines": [[(round(x, 4), round(y, 4)) for x, y in ln] for ln in lines],
            })
        for f in load_geojson(self.raw_dir / self._path("ne_10m_railroads")):
            p = f["properties"]
            lines = [ln for ln in geojson_lines(f["geometry"]) if bbox_intersects(ln, BBOX)]
            if lines:
                rail.append({
                    "scalerank": p.get("scalerank"),
                    "category": p.get("category"),
                    "lines": [[(round(x, 4), round(y, 4)) for x, y in ln] for ln in lines],
                })
        print(f"    {len(roads)} tramos viales de Perú, {len(rail)} tramos ferroviarios en la ventana")
        return {
            "vintage": f"Natural Earth {TAG} (1:10m)",
            "_files": [self._path(n) for n in self.FILES],
            "roads": roads,
            "rail": rail,
        }
