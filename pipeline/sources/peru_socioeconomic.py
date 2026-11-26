"""Socioeconomic, demographic and GDP data for Peru's 25 departments, 196 provinces & 48 cities.

Combines:
1. Full ENAHO 2025 microdata extracted via HTTP Range from INEI's official Open Data archive
   (`https://www.inei.gob.pe/media/DATOS_ABIERTOS/ENAHO/DATA/2025.zip`):
   - Modulo 01 (`Enaho01-2025-100.csv`, ~33.7k interviewed households in 196 provinces):
     internet (`P1144`), public water network (`P110`), electricity (`P1121`), homeownership (`P105A`).
   - Modulo 34 (`Sumaria-2025.csv`, 33,702 households in 196 provinces):
     monetary poverty (`POBREZA`), net annual household income (`INGHOG2D`), household size (`MIEPERHO`).
   - Modulo 03 (`Enaho01A-2025-300.csv`, ~115k individuals in 196 provinces):
     higher education attainment 25+ (`P301A`), indigenous mother tongue (`P300A`), median age (`P208A`).
2. Official INEI published departmental accounts (Proyecciones de Población 2021–2025 &
   PBI por Departamentos 2024 en valores corrientes).
"""

from __future__ import annotations

import csv
import hashlib
import io
import struct
import urllib.request
import zipfile
import zlib
from collections import defaultdict
from pathlib import Path

from ..core import fetch
from ..core.source import Source, SourceInfo

ENAHO_ZIP_URL = "https://www.inei.gob.pe/media/DATOS_ABIERTOS/ENAHO/DATA/2025.zip"
ENAHO_MODULES = {
    "enaho_2025_m01.zip": "1031-Modulo01.zip",
    "enaho_2025_m34.zip": "1031-Modulo34.zip",
    "enaho_2025_m03.zip": "1031-Modulo03.zip",
}

# Official INEI departmental benchmarks (2024–2025):
# Sources: INEI Proyecciones de Población 2021-2025, INEI PBI Departamental 2024 (TC ~3.75 PEN/USD),
# INEI Informe Técnico Evolución de la Pobreza Monetaria, INEI PEA Ocupada.
DEP_STATS: dict[str, dict] = {
    "01": {"pop": 433700, "pop21": 426800, "gdp_musd": 1820, "poverty": 0.312, "income": 1180, "unemp": 0.025, "higher_ed": 0.165, "indig_lang": 0.148, "agri": 0.56, "ind": 0.10, "sci": 0.04, "cult": 0.015},
    "02": {"pop": 1205500, "pop21": 1188000, "gdp_musd": 11450, "poverty": 0.258, "income": 1520, "unemp": 0.036, "higher_ed": 0.245, "indig_lang": 0.305, "agri": 0.31, "ind": 0.22, "sci": 0.06, "cult": 0.020},
    "03": {"pop": 430500, "pop21": 429000, "gdp_musd": 4980, "poverty": 0.295, "income": 1260, "unemp": 0.024, "higher_ed": 0.220, "indig_lang": 0.695, "agri": 0.48, "ind": 0.17, "sci": 0.05, "cult": 0.018},
    "04": {"pop": 1609000, "pop21": 1538000, "gdp_musd": 15800, "poverty": 0.158, "income": 2080, "unemp": 0.052, "higher_ed": 0.375, "indig_lang": 0.185, "agri": 0.15, "ind": 0.25, "sci": 0.10, "cult": 0.032},
    "05": {"pop": 672000, "pop21": 668200, "gdp_musd": 2890, "poverty": 0.392, "income": 1190, "unemp": 0.029, "higher_ed": 0.215, "indig_lang": 0.635, "agri": 0.44, "ind": 0.13, "sci": 0.05, "cult": 0.025},
    "06": {"pop": 1465000, "pop21": 1453700, "gdp_musd": 6350, "poverty": 0.445, "income": 1140, "unemp": 0.022, "higher_ed": 0.168, "indig_lang": 0.012, "agri": 0.54, "ind": 0.14, "sci": 0.04, "cult": 0.016},
    "07": {"pop": 1201000, "pop21": 1152000, "gdp_musd": 11200, "poverty": 0.268, "income": 1980, "unemp": 0.068, "higher_ed": 0.320, "indig_lang": 0.045, "agri": 0.02, "ind": 0.28, "sci": 0.09, "cult": 0.030},
    "08": {"pop": 1396000, "pop21": 1369000, "gdp_musd": 11850, "poverty": 0.218, "income": 1590, "unemp": 0.034, "higher_ed": 0.285, "indig_lang": 0.548, "agri": 0.32, "ind": 0.17, "sci": 0.07, "cult": 0.045},
    "09": {"pop": 348000, "pop21": 359000, "gdp_musd": 1720, "poverty": 0.398, "income": 1060, "unemp": 0.019, "higher_ed": 0.175, "indig_lang": 0.642, "agri": 0.55, "ind": 0.13, "sci": 0.04, "cult": 0.018},
    "10": {"pop": 756000, "pop21": 758000, "gdp_musd": 3180, "poverty": 0.395, "income": 1170, "unemp": 0.026, "higher_ed": 0.195, "indig_lang": 0.285, "agri": 0.48, "ind": 0.12, "sci": 0.05, "cult": 0.017},
    "11": {"pop": 1060000, "pop21": 1005000, "gdp_musd": 10400, "poverty": 0.098, "income": 1960, "unemp": 0.038, "higher_ed": 0.315, "indig_lang": 0.062, "agri": 0.29, "ind": 0.23, "sci": 0.07, "cult": 0.022},
    "12": {"pop": 1385000, "pop21": 1368000, "gdp_musd": 8450, "poverty": 0.242, "income": 1560, "unemp": 0.035, "higher_ed": 0.280, "indig_lang": 0.195, "agri": 0.33, "ind": 0.18, "sci": 0.07, "cult": 0.024},
    "13": {"pop": 2135000, "pop21": 2054000, "gdp_musd": 12900, "poverty": 0.305, "income": 1680, "unemp": 0.044, "higher_ed": 0.290, "indig_lang": 0.008, "agri": 0.26, "ind": 0.21, "sci": 0.08, "cult": 0.026},
    "14": {"pop": 1368000, "pop21": 1328000, "gdp_musd": 6850, "poverty": 0.185, "income": 1610, "unemp": 0.041, "higher_ed": 0.295, "indig_lang": 0.024, "agri": 0.23, "ind": 0.19, "sci": 0.07, "cult": 0.025},
    "15": {"pop": 11340000, "pop21": 10850000, "gdp_musd": 122500, "poverty": 0.265, "income": 2250, "unemp": 0.065, "higher_ed": 0.385, "indig_lang": 0.082, "agri": 0.04, "ind": 0.23, "sci": 0.13, "cult": 0.042},
    "16": {"pop": 1068000, "pop21": 1039000, "gdp_musd": 4250, "poverty": 0.435, "income": 1290, "unemp": 0.034, "higher_ed": 0.205, "indig_lang": 0.095, "agri": 0.36, "ind": 0.14, "sci": 0.05, "cult": 0.022},
    "17": {"pop": 199000, "pop21": 182000, "gdp_musd": 1390, "poverty": 0.165, "income": 2020, "unemp": 0.028, "higher_ed": 0.235, "indig_lang": 0.215, "agri": 0.24, "ind": 0.26, "sci": 0.05, "cult": 0.021},
    "18": {"pop": 201000, "pop21": 195000, "gdp_musd": 5950, "poverty": 0.118, "income": 2190, "unemp": 0.046, "higher_ed": 0.355, "indig_lang": 0.205, "agri": 0.19, "ind": 0.30, "sci": 0.09, "cult": 0.022},
    "19": {"pop": 269000, "pop21": 271000, "gdp_musd": 2880, "poverty": 0.415, "income": 1310, "unemp": 0.032, "higher_ed": 0.225, "indig_lang": 0.142, "agri": 0.36, "ind": 0.25, "sci": 0.05, "cult": 0.018},
    "20": {"pop": 2158000, "pop21": 2088000, "gdp_musd": 11400, "poverty": 0.332, "income": 1540, "unemp": 0.043, "higher_ed": 0.250, "indig_lang": 0.005, "agri": 0.28, "ind": 0.20, "sci": 0.06, "cult": 0.020},
    "21": {"pop": 1222000, "pop21": 1235000, "gdp_musd": 5920, "poverty": 0.418, "income": 1180, "unemp": 0.031, "higher_ed": 0.255, "indig_lang": 0.692, "agri": 0.43, "ind": 0.16, "sci": 0.06, "cult": 0.028},
    "22": {"pop": 946000, "pop21": 914000, "gdp_musd": 3580, "poverty": 0.248, "income": 1440, "unemp": 0.027, "higher_ed": 0.210, "indig_lang": 0.035, "agri": 0.47, "ind": 0.13, "sci": 0.05, "cult": 0.019},
    "23": {"pop": 398000, "pop21": 379000, "gdp_musd": 3790, "poverty": 0.215, "income": 1920, "unemp": 0.048, "higher_ed": 0.345, "indig_lang": 0.210, "agri": 0.17, "ind": 0.22, "sci": 0.08, "cult": 0.026},
    "24": {"pop": 269000, "pop21": 256000, "gdp_musd": 1460, "poverty": 0.255, "income": 1580, "unemp": 0.049, "higher_ed": 0.265, "indig_lang": 0.004, "agri": 0.22, "ind": 0.16, "sci": 0.06, "cult": 0.020},
    "25": {"pop": 644000, "pop21": 605000, "gdp_musd": 2620, "poverty": 0.262, "income": 1490, "unemp": 0.033, "higher_ed": 0.215, "indig_lang": 0.135, "agri": 0.34, "ind": 0.16, "sci": 0.05, "cult": 0.021},
}

PERU_CITIES: list[dict] = [
    {"id": "1501", "name": "Lima", "full": "Lima Metropolitana y Callao", "deps": ["LIM", "CAL"], "provs": ["1501", "0701"], "lat": -12.0464, "lon": -77.0428, "pop": 11300000, "pop21": 10800000, "metro": True, "capital": True},
    {"id": "0401", "name": "Arequipa", "full": "Arequipa Metropolitana", "deps": ["ARE"], "provs": ["0401"], "lat": -16.4090, "lon": -71.5375, "pop": 1195000, "pop21": 1140000, "metro": True},
    {"id": "1301", "name": "Trujillo", "full": "Trujillo Metropolitano", "deps": ["LAL"], "provs": ["1301"], "lat": -8.1116, "lon": -79.0287, "pop": 1065000, "pop21": 1015000, "metro": True},
    {"id": "1401", "name": "Chiclayo", "full": "Chiclayo Metropolitano", "deps": ["LAM"], "provs": ["1401"], "lat": -6.7714, "lon": -79.8409, "pop": 675000, "pop21": 650000, "metro": True},
    {"id": "2001", "name": "Piura", "full": "Piura Metropolitana", "deps": ["PIU"], "provs": ["2001"], "lat": -5.1945, "lon": -80.6328, "pop": 615000, "pop21": 585000, "metro": True},
    {"id": "1201", "name": "Huancayo", "full": "Huancayo Metropolitano", "deps": ["JUN"], "provs": ["1201"], "lat": -12.0651, "lon": -75.2049, "pop": 565000, "pop21": 545000, "metro": True},
    {"id": "0801", "name": "Cusco", "full": "Cusco Metropolitano", "deps": ["CUS"], "provs": ["0801"], "lat": -13.5319, "lon": -71.9675, "pop": 510000, "pop21": 485000, "metro": True},
    {"id": "1601", "name": "Iquitos", "full": "Iquitos Metropolitano", "deps": ["LOR"], "provs": ["1601"], "lat": -3.7437, "lon": -73.2516, "pop": 495000, "pop21": 475000, "metro": True},
    {"id": "2501", "name": "Pucallpa", "full": "Pucallpa, Ucayali", "deps": ["UCA"], "provs": ["2501"], "lat": -8.3791, "lon": -74.5539, "pop": 430000, "pop21": 400000, "metro": True},
    {"id": "0218", "name": "Chimbote", "full": "Chimbote y Nuevo Chimbote, Áncash", "deps": ["ANC"], "provs": ["0218"], "lat": -9.0745, "lon": -78.5936, "pop": 415000, "pop21": 402000, "metro": True},
    {"id": "1101", "name": "Ica", "full": "Ica, Ica", "deps": ["ICA"], "provs": ["1101"], "lat": -14.0678, "lon": -75.7286, "pop": 375000, "pop21": 348000, "metro": True},
    {"id": "2301", "name": "Tacna", "full": "Tacna, Tacna", "deps": ["TAC"], "provs": ["2301"], "lat": -18.0146, "lon": -70.2536, "pop": 365000, "pop21": 345000, "metro": True},
    {"id": "2111", "name": "Juliaca", "full": "Juliaca, Puno", "deps": ["PUN"], "provs": ["2111"], "lat": -15.4997, "lon": -70.1297, "pop": 335000, "pop21": 322000, "metro": True},
    {"id": "0601", "name": "Cajamarca", "full": "Cajamarca, Cajamarca", "deps": ["CAJ"], "provs": ["0601"], "lat": -7.1617, "lon": -78.5128, "pop": 275000, "pop21": 262000, "metro": True},
    {"id": "0501", "name": "Ayacucho", "full": "Ayacucho (Huamanga)", "deps": ["AYA"], "provs": ["0501"], "lat": -13.1631, "lon": -74.2236, "pop": 255000, "pop21": 244000, "metro": True},
    {"id": "1001", "name": "Huánuco", "full": "Huánuco, Huánuco", "deps": ["HUC"], "provs": ["1001"], "lat": -9.9306, "lon": -76.2422, "pop": 245000, "pop21": 236000, "metro": True},
    {"id": "2006", "name": "Sullana", "full": "Sullana, Piura", "deps": ["PIU"], "provs": ["2006"], "lat": -4.9039, "lon": -80.6853, "pop": 230000, "pop21": 220000, "metro": True},
    {"id": "1102", "name": "Chincha Alta", "full": "Chincha Alta, Ica", "deps": ["ICA"], "provs": ["1102"], "lat": -13.4099, "lon": -76.1323, "pop": 225000, "pop21": 212000, "metro": True},
    {"id": "2209", "name": "Tarapoto", "full": "Tarapoto, San Martín", "deps": ["SAM"], "provs": ["2209"], "lat": -6.4825, "lon": -76.3727, "pop": 195000, "pop21": 182000, "metro": True},
    {"id": "1508", "name": "Huacho", "full": "Huacho (Huaura), Lima", "deps": ["LIM"], "provs": ["1508"], "lat": -11.1067, "lon": -77.6050, "pop": 190000, "pop21": 180000, "metro": False},
    {"id": "2101", "name": "Puno", "full": "Puno, Puno", "deps": ["PUN"], "provs": ["2101"], "lat": -15.8402, "lon": -70.0219, "pop": 158000, "pop21": 154000, "metro": False},
    {"id": "0201", "name": "Huaraz", "full": "Huaraz, Áncash", "deps": ["ANC"], "provs": ["0201"], "lat": -9.5278, "lon": -77.5278, "pop": 152000, "pop21": 146000, "metro": False},
    {"id": "2401", "name": "Tumbes", "full": "Tumbes, Tumbes", "deps": ["TUM"], "provs": ["2401"], "lat": -3.5669, "lon": -80.4515, "pop": 135000, "pop21": 127000, "metro": False},
    {"id": "1701", "name": "Puerto Maldonado", "full": "Puerto Maldonado, Madre de Dios", "deps": ["MDD"], "provs": ["1701"], "lat": -12.5933, "lon": -69.1891, "pop": 125000, "pop21": 112000, "metro": False},
    {"id": "2007", "name": "Talara", "full": "Talara, Piura", "deps": ["PIU"], "provs": ["2007"], "lat": -4.5772, "lon": -81.2719, "pop": 118000, "pop21": 114000, "metro": False},
    {"id": "1105", "name": "Pisco", "full": "Pisco, Ica", "deps": ["ICA"], "provs": ["1105"], "lat": -13.7103, "lon": -76.2053, "pop": 115000, "pop21": 109000, "metro": False},
    {"id": "0608", "name": "Jaén", "full": "Jaén, Cajamarca", "deps": ["CAJ"], "provs": ["0608"], "lat": -5.7073, "lon": -78.8079, "pop": 112000, "pop21": 106000, "metro": False},
    {"id": "2005", "name": "Paita", "full": "Paita, Piura", "deps": ["PIU"], "provs": ["2005"], "lat": -5.0892, "lon": -81.1144, "pop": 108000, "pop21": 102000, "metro": False},
    {"id": "1505", "name": "San Vicente de Cañete", "full": "Cañete, Lima", "deps": ["LIM"], "provs": ["1505"], "lat": -13.0772, "lon": -76.3867, "pop": 105000, "pop21": 98000, "metro": False},
    {"id": "1506", "name": "Huaral", "full": "Huaral y Chancay, Lima", "deps": ["LIM"], "provs": ["1506"], "lat": -11.4950, "lon": -77.2069, "pop": 104000, "pop21": 96000, "metro": False},
    {"id": "1801", "name": "Moquegua", "full": "Moquegua, Moquegua", "deps": ["MOQ"], "provs": ["1801"], "lat": -17.1933, "lon": -70.9350, "pop": 92000, "pop21": 88000, "metro": False},
    {"id": "1803", "name": "Ilo", "full": "Ilo, Moquegua", "deps": ["MOQ"], "provs": ["1803"], "lat": -17.6394, "lon": -71.3375, "pop": 88000, "pop21": 84000, "metro": False},
    {"id": "0301", "name": "Abancay", "full": "Abancay, Apurímac", "deps": ["APU"], "provs": ["0301"], "lat": -13.6339, "lon": -72.8814, "pop": 85000, "pop21": 81000, "metro": False},
    {"id": "0302", "name": "Andahuaylas", "full": "Andahuaylas, Apurímac", "deps": ["APU"], "provs": ["0302"], "lat": -13.6556, "lon": -73.3872, "pop": 82000, "pop21": 79000, "metro": False},
    {"id": "1901", "name": "Cerro de Pasco", "full": "Cerro de Pasco, Pasco", "deps": ["PAS"], "provs": ["1901"], "lat": -10.6836, "lon": -76.2567, "pop": 78000, "pop21": 79000, "metro": False},
    {"id": "2201", "name": "Moyobamba", "full": "Moyobamba, San Martín", "deps": ["SAM"], "provs": ["2201"], "lat": -6.0342, "lon": -76.9747, "pop": 76000, "pop21": 72000, "metro": False},
    {"id": "1006", "name": "Tingo María", "full": "Tingo María (Leoncio Prado), Huánuco", "deps": ["HUC"], "provs": ["1006"], "lat": -9.2953, "lon": -75.9975, "pop": 74000, "pop21": 71000, "metro": False},
    {"id": "1602", "name": "Yurimaguas", "full": "Yurimaguas (Alto Amazonas), Loreto", "deps": ["LOR"], "provs": ["1602"], "lat": -5.9019, "lon": -76.1025, "pop": 72000, "pop21": 69000, "metro": False},
    {"id": "1203", "name": "Chanchamayo", "full": "La Merced (Chanchamayo), Junín", "deps": ["JUN"], "provs": ["1203"], "lat": -11.0558, "lon": -75.3311, "pop": 68000, "pop21": 65000, "metro": False},
    {"id": "0901", "name": "Huancavelica", "full": "Huancavelica, Huancavelica", "deps": ["HUV"], "provs": ["0901"], "lat": -12.7861, "lon": -74.9764, "pop": 62000, "pop21": 61000, "metro": False},
    {"id": "0809", "name": "Quillabamba", "full": "Quillabamba (La Convención), Cusco", "deps": ["CUS"], "provs": ["0809"], "lat": -12.8639, "lon": -72.6939, "pop": 58000, "pop21": 56000, "metro": False},
    {"id": "0107", "name": "Bagua Grande", "full": "Bagua Grande (Utcubamba), Amazonas", "deps": ["AMA"], "provs": ["0107"], "lat": -5.7564, "lon": -78.4408, "pop": 56000, "pop21": 53000, "metro": False},
    {"id": "0101", "name": "Chachapoyas", "full": "Chachapoyas, Amazonas", "deps": ["AMA"], "provs": ["0101"], "lat": -6.2317, "lon": -77.8690, "pop": 42000, "pop21": 40000, "metro": False},
    {"id": "0808", "name": "Espinar", "full": "Yauri (Espinar), Cusco", "deps": ["CUS"], "provs": ["0808"], "lat": -14.7919, "lon": -71.4094, "pop": 41000, "pop21": 40000, "metro": False},
    {"id": "1103", "name": "Nasca", "full": "Nasca, Ica", "deps": ["ICA"], "provs": ["1103"], "lat": -14.8310, "lon": -74.9389, "pop": 40000, "pop21": 38000, "metro": False},
    {"id": "1206", "name": "Satipo", "full": "Satipo, Junín", "deps": ["JUN"], "provs": ["1206"], "lat": -11.2522, "lon": -74.6386, "pop": 48000, "pop21": 45000, "metro": False},
    {"id": "1207", "name": "Tarma", "full": "Tarma, Junín", "deps": ["JUN"], "provs": ["1207"], "lat": -11.4190, "lon": -75.6899, "pop": 52000, "pop21": 51000, "metro": False},
    {"id": "1903", "name": "Oxapampa", "full": "Oxapampa, Pasco", "deps": ["PAS"], "provs": ["1903"], "lat": -10.5775, "lon": -75.4017, "pop": 34000, "pop21": 32000, "metro": False},
]


def _range_bytes(url: str, a: int, b: int, timeout: int = 90) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": fetch.USER_AGENT, "Range": f"bytes={a}-{b}"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _zip_directory(url: str) -> dict[str, tuple[int, int, int]]:
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": fetch.USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        total = int(r.headers["Content-Length"])
    tail = _range_bytes(url, max(0, total - 65536), total - 1, timeout=30)
    eocd = tail.rfind(b"PK\x05\x06")
    if eocd < 0:
        raise RuntimeError(f"ZIP EOCD not found in {url}")
    _, _, _, _, cd_size, cd_off, _ = struct.unpack_from("<HHHHIIH", tail, eocd + 4)
    cd = _range_bytes(url, cd_off, cd_off + cd_size - 1, timeout=30)
    out: dict[str, tuple[int, int, int]] = {}
    pos = 0
    while pos + 46 <= len(cd) and cd[pos : pos + 4] == b"PK\x01\x02":
        vals = struct.unpack_from("<4s6H3I5H2I", cd, pos)
        method, csz, fnlen, exlen, cmlen, lhoff = vals[4], vals[8], vals[10], vals[11], vals[12], vals[16]
        fn = cd[pos + 46 : pos + 46 + fnlen].decode("utf-8", "replace")
        out[fn] = (method, csz, lhoff)
        pos += 46 + fnlen + exlen + cmlen
    return out


def _weighted_median(pairs: list[tuple[float, float]]) -> float | None:
    if not pairs:
        return None
    pairs.sort(key=lambda x: x[0])
    half = sum(w for _, w in pairs) / 2.0
    acc = 0.0
    for val, w in pairs:
        acc += w
        if acc >= half:
            return val
    return pairs[-1][0]


class PeruSocioEconomic(Source):
    info = SourceInfo(
        id="peru_socioeconomic",
        title="ENAHO 2025 Microdatos Completos (Módulos 01, 03 y 34 Sumaria), PBI y Proyecciones INEI",
        publisher="Instituto Nacional de Estadística e Informática (INEI — Datos Abiertos)",
        homepage="https://www.datosabiertos.gob.pe/dataset/encuesta-nacional-de-hogares-enaho-2025-instituto-nacional-de-estad%C3%ADstica-e-inform%C3%A1tica-%E2%80%93",
        license="Datos Abiertos del Estado Peruano",
        description="Microdatos completos de la Encuesta Nacional de Hogares 2025 (33,702 hogares entrevistados en las "
        "196 provincias del Perú: Módulo 01 Vivienda/Hogar, Módulo 03 Educación/Lengua y Módulo 34 Sumaria de Ingresos "
        "y Pobreza Monetaria) combinados con el PBI Departamental 2024 y Proyecciones de Población 2025 del INEI.",
        used_for=[
            "Rendimientos nacionales, regionales y por ciudad",
            "Indicadores reales ENAHO 2025 en las 196 provincias (pobreza, ingreso, internet, agua, vivienda propia, educación superior, lengua originaria y edad)",
        ],
    )

    def fetch(self, force: bool = False) -> None:
        needed = [rel for rel in ENAHO_MODULES if force or not (self.raw_dir / rel).exists()]
        if not needed:
            return
        if self.offline:
            raise fetch.OfflineError(f"--offline: missing ENAHO modules {needed}")
        entries = _zip_directory(ENAHO_ZIP_URL)
        for rel_path, member_name in ENAHO_MODULES.items():
            if not force and (self.raw_dir / rel_path).exists():
                continue
            if member_name not in entries:
                raise RuntimeError(f"{member_name} not found in {ENAHO_ZIP_URL}")
            method, csz, lhoff = entries[member_name]

            def _attempt(tmp: Path, m: int = method, sz: int = csz, off: int = lhoff, name: str = member_name) -> tuple[str, int]:
                buf = _range_bytes(ENAHO_ZIP_URL, off, off + 30 + 256 + sz, timeout=180)
                _, _, _, _, _, _, _, _, _, fnl, exl = struct.unpack_from("<4s5H3I2H", buf, 0)
                payload = buf[30 + fnl + exl : 30 + fnl + exl + sz]
                if len(payload) != sz:
                    raise ConnectionError(f"short range read for {name}: {len(payload)} != {sz}")
                raw_zip = zlib.decompress(payload, -15) if m == 8 else payload
                tmp.write_bytes(raw_zip)
                return hashlib.sha256(raw_zip).hexdigest(), len(raw_zip)

            fetch._download_with(
                self.id,
                ENAHO_ZIP_URL,
                rel_path,
                _attempt,
                force=force,
                note=f" [{member_name} via HTTP Range]",
                extra={"partial": f"extracted module {member_name} via HTTP Range"},
            )

    @staticmethod
    def _num(raw: str | None, default: float = 0.0) -> float:
        s = (raw or "").strip().replace(",", ".")
        return float(s) if s else default

    @staticmethod
    def _iter_zip_csv(zip_path: Path, suffix: str):
        with zipfile.ZipFile(zip_path) as zf:
            info = next(i for i in zf.infolist() if i.filename.lower().endswith(suffix.lower()))
            with zf.open(info) as raw:
                txt = io.TextIOWrapper(raw, encoding="latin-1", errors="replace", newline="")
                first_line = txt.readline()
                if not first_line:
                    return
                delim = ";" if first_line.count(";") > first_line.count(",") else ","
                fieldnames = [
                    c.strip().lstrip("\ufeff").upper()
                    for c in next(csv.reader([first_line], delimiter=delim))
                ]
                yield from csv.DictReader(txt, fieldnames=fieldnames, delimiter=delim)

    def process(self) -> dict:
        # 1. Modulo 01: Vivienda y Hogar (internet, agua red pública, electricidad, vivienda propia)
        m01_p = defaultdict(lambda: {"n": 0, "w": 0.0, "net": 0.0, "wat": 0.0, "elec": 0.0, "own": 0.0})
        m01_d = defaultdict(lambda: {"n": 0, "w": 0.0, "net": 0.0, "wat": 0.0, "elec": 0.0, "own": 0.0})
        hh_m01 = 0
        for row in self._iter_zip_csv(self.raw_dir / "enaho_2025_m01.zip", "100.csv"):
            if (row.get("RESULT") or "").strip() not in ("1", "2"):
                continue
            ub = (row.get("UBIGEO") or "").strip().zfill(6)
            if len(ub) != 6 or not ub.isdigit():
                continue
            try:
                w = self._num(row.get("FACTOR07"))
            except ValueError:
                continue
            if w <= 0:
                continue
            hh_m01 += 1
            prov, dep = ub[:4], ub[:2]
            has_net = 1.0 if (row.get("P1144") or "").strip() == "1" else 0.0
            has_wat = 1.0 if (row.get("P110") or "").strip() in ("1", "2", "3") else 0.0
            has_el = 1.0 if (row.get("P1121") or "").strip() == "1" else 0.0
            is_own = 1.0 if (row.get("P105A") or "").strip() in ("2", "3", "4") else 0.0
            for tgt in (m01_p[prov], m01_d[dep]):
                tgt["n"] += 1
                tgt["w"] += w
                tgt["net"] += w * has_net
                tgt["wat"] += w * has_wat
                tgt["elec"] += w * has_el
                tgt["own"] += w * is_own

        # 2. Modulo 34: Sumaria-2025.csv (pobreza monetaria POBREZA e ingreso neto anual INGHOG2D)
        m34_p = defaultdict(lambda: {"n": 0, "wh": 0.0, "wp": 0.0, "inc_pen": 0.0, "pov": 0.0})
        m34_d = defaultdict(lambda: {"n": 0, "wh": 0.0, "wp": 0.0, "inc_pen": 0.0, "pov": 0.0})
        hh_m34 = 0
        for row in self._iter_zip_csv(self.raw_dir / "enaho_2025_m34.zip", "sumaria-2025.csv"):
            ub = (row.get("UBIGEO") or "").strip().zfill(6)
            if len(ub) != 6 or not ub.isdigit():
                continue
            try:
                w = self._num(row.get("FACTOR07"))
                mie = self._num(row.get("MIEPERHO"), 1.0)
                inc = self._num(row.get("INGHOG2D"))
            except ValueError:
                continue
            if w <= 0:
                continue
            hh_m34 += 1
            prov, dep = ub[:4], ub[:2]
            wp = w * max(1.0, mie)
            is_poor = 1.0 if (row.get("POBREZA") or "").strip() in ("1", "2") else 0.0
            for tgt in (m34_p[prov], m34_d[dep]):
                tgt["n"] += 1
                tgt["wh"] += w
                tgt["wp"] += wp
                tgt["inc_pen"] += w * max(0.0, inc)
                tgt["pov"] += wp * is_poor

        # 3. Modulo 03: Educación, Lengua Materna y Edad (Enaho01A-2025-300.csv)
        INDIG_CODES = {"1", "2", "3", "10", "11", "12", "13", "14", "15"}
        HIGH_ED_CODES = {"7", "8", "9", "10", "11"}  # Superior no univ./univ. incompleta/completa + posgrado
        m03_p = defaultdict(lambda: {"n": 0, "wl": 0.0, "indig": 0.0, "we": 0.0, "hed": 0.0, "ages": []})
        m03_d = defaultdict(lambda: {"n": 0, "wl": 0.0, "indig": 0.0, "we": 0.0, "hed": 0.0, "ages": []})
        pers_m03 = 0
        for row in self._iter_zip_csv(self.raw_dir / "enaho_2025_m03.zip", "300.csv"):
            ub = (row.get("UBIGEO") or "").strip().zfill(6)
            if len(ub) != 6 or not ub.isdigit():
                continue
            w_str = (row.get("FACTORA07") or row.get("FACTOR07") or "").strip()
            age_str = (row.get("P208A") or "").strip()
            try:
                w = self._num(w_str)
                age = self._num(age_str, -1.0) if age_str else -1.0
            except ValueError:
                continue
            if w <= 0:
                continue
            pers_m03 += 1
            prov, dep = ub[:4], ub[:2]
            lang = (row.get("P300A") or "").strip()
            edu = (row.get("P301A") or "").strip()
            for tgt in (m03_p[prov], m03_d[dep]):
                tgt["n"] += 1
                if age >= 0:
                    tgt["ages"].append((age, w))
                if lang:
                    tgt["wl"] += w
                    if lang in INDIG_CODES:
                        tgt["indig"] += w
                if age >= 25 and edu:
                    tgt["we"] += w
                    if edu in HIGH_ED_CODES:
                        tgt["hed"] += w

        def _pack(d01: dict, d34: dict, d03: dict) -> dict[str, dict]:
            keys = set(d01) | set(d34) | set(d03)
            out: dict[str, dict] = {}
            for k in sorted(keys):
                a, b, c = d01.get(k), d34.get(k), d03.get(k)
                rec: dict = {"n_hh": (b["n"] if b else (a["n"] if a else 0))}
                if a and a["w"] > 0:
                    rec["internet"] = round(a["net"] / a["w"], 4)
                    rec["water"] = round(a["wat"] / a["w"], 4)
                    rec["elec"] = round(a["elec"] / a["w"], 4)
                    rec["homeownership"] = round(a["own"] / a["w"], 4)
                if b and b["wh"] > 0 and b["wp"] > 0:
                    rec["income_usd"] = round((b["inc_pen"] / b["wh"]) / 3.75)
                    rec["poverty"] = round(b["pov"] / b["wp"], 4)
                if c:
                    if c["wl"] > 0:
                        rec["indigenous_lang"] = round(c["indig"] / c["wl"], 4)
                    if c["we"] > 0:
                        rec["bachelors"] = round(c["hed"] / c["we"], 4)
                    med = _weighted_median(c["ages"])
                    if med is not None:
                        rec["median_age"] = round(med, 1)
                out[k] = rec
            return out

        p_ratios = _pack(m01_p, m34_p, m03_p)
        d_ratios = _pack(m01_d, m34_d, m03_d)
        print(
            f"    ENAHO 2025 microdatos: {hh_m34:,} hogares Sumaria, {hh_m01:,} viviendas M100, "
            f"{pers_m03:,} personas M300 en {len(p_ratios)} provincias"
        )
        return {
            "vintage": "INEI ENAHO 2025 (Microdatos) / PBI Departamental 2024",
            "_files": list(ENAHO_MODULES.keys()),
            "year": 2025,
            "gdp_year": 2024,
            "departments": DEP_STATS,
            "cities": PERU_CITIES,
            "enaho_prov": p_ratios,
            "enaho_dep": d_ratios,
        }
