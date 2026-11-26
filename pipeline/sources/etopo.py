"""Elevation & ocean bathymetry from AWS Open Data Terrain Tiles (Mapzen Terrarium, SRTM + ETOPO1).

Zero-dependency pure-Python PNG decoder. At zoom 5, 9 tiles (x=8..10, y=15..17) cover all of Peru,
neighboring borders, Lake Titicaca, and the Peru-Chile Pacific Trench at ~3.5 km spacing.
"""

from __future__ import annotations

import math
import struct
import zlib

from ..core.source import Source, SourceInfo

ZOOM = 5
TILES_X = (8, 9, 10)
TILES_Y = (15, 16, 17)
STEP = 2  # sample every 2nd pixel (~4 km) -> ~120k points
BASE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium"


def _paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    return b if pb <= pc else c


def _decode_png_rgb(data: bytes) -> tuple[int, int, list[bytes]]:
    """Decode an 8-bit RGB/RGBA PNG into (width, height, list_of_row_bytes)."""
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "Not a PNG"
    pos = 8
    w = h = color_type = 0
    idat = bytearray()
    while pos < len(data):
        length, ctype = struct.unpack(">I4s", data[pos : pos + 8])
        chunk = data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if ctype == b"IHDR":
            w, h, bit_depth, color_type = struct.unpack(">IIBB", chunk[:10])
            assert bit_depth == 8 and color_type in (2, 6), f"Unsupported PNG: depth={bit_depth} type={color_type}"
        elif ctype == b"IDAT":
            idat.extend(chunk)
        elif ctype == b"IEND":
            break
    bpp = 3 if color_type == 2 else 4
    stride = w * bpp
    raw = zlib.decompress(bytes(idat))
    rows: list[bytes] = []
    prev = bytes(stride)
    idx = 0
    for _ in range(h):
        ftype = raw[idx]
        idx += 1
        line = bytearray(raw[idx : idx + stride])
        idx += stride
        if ftype == 1:  # Sub
            for i in range(bpp, stride):
                line[i] = (line[i] + line[i - bpp]) & 0xFF
        elif ftype == 2:  # Up
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif ftype == 3:  # Average
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 0xFF
        elif ftype == 4:  # Paeth
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                b = prev[i]
                c = prev[i - bpp] if i >= bpp else 0
                line[i] = (line[i] + _paeth(a, b, c)) & 0xFF
        prev = bytes(line)
        rows.append(prev)
    return w, h, rows, bpp


def _tile_px_to_lonlat(z: int, tx: int, ty: int, px: int, py: int, size: int = 256) -> tuple[float, float]:
    n = 1 << z
    lon = (tx + (px + 0.5) / size) / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1.0 - 2.0 * (ty + (py + 0.5) / size) / n)))
    return lon, math.degrees(lat_rad)


class Etopo(Source):
    info = SourceInfo(
        id="etopo",
        title="Relieve y Batimetría Global (AWS Terrain Tiles — SRTM / ETOPO1)",
        publisher="Registry of Open Data on AWS (Mapzen / NASA SRTM / NOAA ETOPO1)",
        homepage="https://registry.opendata.aws/terrain-tiles/",
        license="Dominio público / Open Data",
        description="Elevación terrestre (SRTM) y batimetría oceánica (ETOPO1) muestreada cada ~4 km sobre el Perú, "
        "la Cordillera de los Andes y la Fosa de Perú-Chile.",
        used_for=["Relieve andino y amazónico", "Sombreado topográfico", "Profundidad oceánica"],
    )

    def _fname(self, tx: int, ty: int) -> str:
        return f"terrarium_z{ZOOM}_{tx}_{ty}.png"

    def fetch(self, force=False):
        for tx in TILES_X:
            for ty in TILES_Y:
                self.download(f"{BASE}/{ZOOM}/{tx}/{ty}.png", self._fname(tx, ty), force=force, expect_binary=True)

    def process(self):
        lat, lon, alt = [], [], []
        files = []
        for tx in TILES_X:
            for ty in TILES_Y:
                fn = self._fname(tx, ty)
                files.append(fn)
                data = (self.raw_dir / fn).read_bytes()
                w, h, rows, bpp = _decode_png_rgb(data)
                for py in range(0, h, STEP):
                    row = rows[py]
                    for px in range(0, w, STEP):
                        lo, la = _tile_px_to_lonlat(ZOOM, tx, ty, px, py, w)
                        if not (-21.0 <= la <= 3.0 and -84.0 <= lo <= -66.0):
                            continue
                        o = px * bpp
                        r, g, b = row[o], row[o + 1], row[o + 2]
                        elev = (r * 256.0 + g + b / 256.0) - 32768.0
                        lat.append(round(la, 4))
                        lon.append(round(lo, 4))
                        alt.append(int(round(elev)))
        print(f"    {len(alt):,} muestras de relieve/batimetría (rango {min(alt)} m .. {max(alt)} m)")
        return {
            "vintage": "AWS Terrain Tiles (SRTM + ETOPO1, zoom 5)",
            "_files": files,
            "lat": lat,
            "lon": lon,
            "alt": alt,
        }
