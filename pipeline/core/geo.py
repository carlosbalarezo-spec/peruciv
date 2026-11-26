"""Small, dependency-free geometry helpers for Peru.

Everything on the map lives in "map km": an Albers equal-area conic projection
centered on Peru (lat1=-4°, lat2=-15°, lat0=-9.5°, lon0=-75°), shifted so the
top-left of the map is (0, 0) and y points *down* (like screen coordinates).
Both the hex grid and the browser use this space.
"""

from __future__ import annotations

import json
import math
import struct
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable, Iterator

R_EARTH_KM = 6371.0088


class Albers:
    """Albers equal-area conic, centered on Peru (Southern Hemisphere safe)."""

    def __init__(self, lat1=-4.0, lat2=-15.0, lat0=-9.5, lon0=-75.0):
        p1, p2, p0 = map(math.radians, (lat1, lat2, lat0))
        self.lon0 = math.radians(lon0)
        self.n = (math.sin(p1) + math.sin(p2)) / 2
        self.c = math.cos(p1) ** 2 + 2 * self.n * math.sin(p1)
        self.rho0 = R_EARTH_KM * math.sqrt(self.c - 2 * self.n * math.sin(p0)) / self.n

    def __call__(self, lon: float, lat: float) -> tuple[float, float]:
        rho = R_EARTH_KM * math.sqrt(max(0.0, self.c - 2 * self.n * math.sin(math.radians(lat)))) / self.n
        theta = self.n * (math.radians(lon) - self.lon0)
        return rho * math.sin(theta), self.rho0 - rho * math.cos(theta)

    def inverse(self, x: float, y: float) -> tuple[float, float]:
        """Albers km → (lon, lat)."""
        dy = self.rho0 - y
        if self.n < 0:
            rho = -math.hypot(x, dy)
            theta = math.atan2(-x, -dy)
        else:
            rho = math.hypot(x, dy)
            theta = math.atan2(x, dy)
        s = (self.c - (rho * self.n / R_EARTH_KM) ** 2) / (2 * self.n)
        return math.degrees(self.lon0 + theta / self.n), math.degrees(math.asin(max(-1.0, min(1.0, s))))


@dataclass
class MapProjection:
    """lon/lat → map km (origin top-left, y down)."""

    min_x: float
    max_y: float
    margin: float

    def __post_init__(self):
        self._albers = Albers()

    def __call__(self, lon: float, lat: float) -> tuple[float, float]:
        x, y = self._albers(lon, lat)
        return x - self.min_x + self.margin, self.max_y - y + self.margin

    def inverse(self, x: float, y: float) -> tuple[float, float]:
        """map km → (lon, lat)."""
        return self._albers.inverse(x + self.min_x - self.margin, self.max_y + self.margin - y)

    def to_dict(self) -> dict:
        return {"min_x": self.min_x, "max_y": self.max_y, "margin": self.margin}


def ring_contains(ring: list[tuple[float, float]], x: float, y: float) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


class Shape:
    """A (multi)polygon as a bag of rings; even-odd rule handles holes."""

    def __init__(self, rings: Iterable[list[tuple[float, float]]]):
        self.rings = [r for r in rings if len(r) >= 3]
        xs = [p[0] for r in self.rings for p in r] or [0]
        ys = [p[1] for r in self.rings for p in r] or [0]
        self.bbox = (min(xs), min(ys), max(xs), max(ys))

    def contains(self, x: float, y: float) -> bool:
        x0, y0, x1, y1 = self.bbox
        if x < x0 or x > x1 or y < y0 or y > y1:
            return False
        inside = False
        for r in self.rings:
            if ring_contains(r, x, y):
                inside = not inside
        return inside


class ShapeIndex:
    """Bucket shapes by coarse grid square so point lookups only test a few shapes."""

    def __init__(self, shapes: list[Shape], cell_km: float = 50.0):
        self.shapes = shapes
        self.cell = cell_km
        self.buckets: dict[tuple[int, int], list[int]] = defaultdict(list)
        for k, s in enumerate(shapes):
            x0, y0, x1, y1 = s.bbox
            for gx in range(int(x0 // cell_km), int(x1 // cell_km) + 1):
                for gy in range(int(y0 // cell_km), int(y1 // cell_km) + 1):
                    self.buckets[(gx, gy)].append(k)

    def locate(self, x: float, y: float) -> int:
        for k in self.buckets.get((int(x // self.cell), int(y // self.cell)), ()):
            if self.shapes[k].contains(x, y):
                return k
        return -1


# --- file formats -----------------------------------------------------------


def geojson_rings(geom: dict) -> list[list[tuple[float, float]]]:
    t, c = geom["type"], geom["coordinates"]
    polys = [c] if t == "Polygon" else c if t == "MultiPolygon" else []
    return [[(round(x, 5), round(y, 5)) for x, y, *_ in ring] for poly in polys for ring in poly]


def geojson_lines(geom: dict) -> list[list[tuple[float, float]]]:
    t, c = geom["type"], geom["coordinates"]
    lines = [c] if t == "LineString" else c if t == "MultiLineString" else []
    return [[(round(x, 5), round(y, 5)) for x, y, *_ in line] for line in lines]


def load_geojson(path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)["features"]


def bbox_intersects(points: Iterable[tuple[float, float]], bbox: tuple[float, float, float, float]) -> bool:
    x0, y0, x1, y1 = bbox
    return any(x0 <= x <= x1 and y0 <= y <= y1 for x, y in points)


def _read_dbf(data: bytes) -> list[dict[str, str]]:
    """Minimal pure-Python DBF reader for ESRI shapefiles."""
    num_records, header_len, record_len = struct.unpack("<IHH", data[4:12])
    fields = []
    pos = 32
    while pos < header_len - 1 and data[pos] != 0x0D:
        name = data[pos : pos + 11].split(b"\x00", 1)[0].decode("latin-1").strip()
        ftype = chr(data[pos + 11])
        flen = data[pos + 16]
        fields.append((name, ftype, flen))
        pos += 32

    records = []
    offset = header_len
    for _ in range(num_records):
        if offset + record_len > len(data):
            break
        rec_bytes = data[offset : offset + record_len]
        offset += record_len
        if rec_bytes[0:1] == b"*":  # deleted
            continue
        p = 1
        row = {}
        for name, ftype, flen in fields:
            raw = rec_bytes[p : p + flen]
            p += flen
            try:
                val = raw.decode("utf-8").strip()
            except UnicodeDecodeError:
                val = raw.decode("latin-1").strip()
            row[name] = val
        records.append(row)
    return records


def _read_shp_polygons(data: bytes, simplify_deg: float = 0.005) -> list[list[list[tuple[float, float]]]]:
    """Minimal pure-Python SHP polygon reader (types 5, 15, 25)."""
    shapes = []
    pos = 100
    nbytes = len(data)
    while pos + 8 <= nbytes:
        _rec_num, content_words = struct.unpack(">II", data[pos : pos + 8])
        pos += 8
        rec_end = pos + content_words * 2
        if rec_end > nbytes:
            break
        shape_type = struct.unpack("<I", data[pos : pos + 4])[0]
        rings: list[list[tuple[float, float]]] = []
        if shape_type in (5, 15, 25):  # Polygon, PolygonZ, PolygonM
            num_parts, num_points = struct.unpack("<II", data[pos + 36 : pos + 44])
            parts_off = pos + 44
            parts = list(struct.unpack(f"<{num_parts}I", data[parts_off : parts_off + 4 * num_parts]))
            pts_off = parts_off + 4 * num_parts
            for pi in range(num_parts):
                start = parts[pi]
                end = parts[pi + 1] if pi + 1 < num_parts else num_points
                ring = []
                last = None
                for idx in range(start, end):
                    o = pts_off + idx * 16
                    x, y = struct.unpack("<dd", data[o : o + 16])
                    pt = (round(x, 5), round(y, 5))
                    if last is None or abs(pt[0] - last[0]) + abs(pt[1] - last[1]) >= simplify_deg:
                        ring.append(pt)
                        last = pt
                if len(ring) >= 3:
                    rings.append(ring)
        shapes.append(rings)
        pos = rec_end
    return shapes


def read_shapefile_zip(zip_path, simplify_deg: float = 0.005) -> Iterator[tuple[dict[str, str], list[list[tuple[float, float]]]]]:
    """Yield (properties, rings) from a .zip containing a .shp and .dbf."""
    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        shp_name = next(n for n in names if n.lower().endswith(".shp"))
        dbf_name = next(n for n in names if n.lower().endswith(".dbf"))
        shp_data = zf.read(shp_name)
        dbf_data = zf.read(dbf_name)
    records = _read_dbf(dbf_data)
    geoms = _read_shp_polygons(shp_data, simplify_deg=simplify_deg)
    for props, rings in zip(records, geoms):
        yield props, rings
