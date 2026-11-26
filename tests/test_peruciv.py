import json
import unittest
from pathlib import Path

from pipeline import check
from pipeline.core.geo import Albers, MapProjection
from pipeline.core.hexgrid import HexGrid
from pipeline.core.paths import WEB_DATA

ALL_FILES = [
    "world.json", "states.json", "cities.json", "counties.json", "nation.json",
    "lenses.json", "resources.json", "wonders.json", "infrastructure.json",
    "citizens.json", "districts.json", "disasters.json", "trade.json",
    "military.json", "sources.json",
]


class TestPeruCiv(unittest.TestCase):
    def test_albers_southern_hemisphere_roundtrip(self):
        proj = Albers()
        # Lima, Cusco, Iquitos, Tacna, Talara
        for lon, lat in [(-77.0428, -12.0464), (-71.9675, -13.5319), (-73.2516, -3.7437), (-70.2536, -18.0146), (-81.2719, -4.5772)]:
            x, y = proj(lon, lat)
            lon2, lat2 = proj.inverse(x, y)
            self.assertAlmostEqual(lon, lon2, places=4)
            self.assertAlmostEqual(lat, lat2, places=4)

    def test_map_projection_roundtrip(self):
        mp = MapProjection(-700.0, 950.0, 140.0)
        x, y = mp(-77.0428, -12.0464)
        lon, lat = mp.inverse(x, y)
        self.assertAlmostEqual(lon, -77.0428, places=4)
        self.assertAlmostEqual(lat, -12.0464, places=4)

    def test_hexgrid_cell_at_centers(self):
        g = HexGrid(radius=12.0, cols=40, rows=50)
        for idx in (0, 17, 40, 41, 825, g.size - 1):
            col, row = g.col_row(idx)
            cx, cy = g.center(col, row)
            self.assertEqual(g.cell_at(cx, cy), idx)

    def test_all_15_web_data_files_present_and_valid(self):
        for name in ALL_FILES:
            p = Path(WEB_DATA) / name
            self.assertTrue(p.exists(), f"Missing {name}")
            doc = json.loads(p.read_text(encoding="utf-8"))
            self.assertIsNotNone(doc)

        rep = check.run(quiet=True)
        fails = [msg for lv, msg in rep.lines if lv == "FAIL"]
        self.assertEqual(fails, [], f"pipeline check failed: {fails}")

    def test_game_json_valid_and_provenance(self):
        from pipeline.build import game_data
        p = Path(WEB_DATA) / "game.json"
        self.assertTrue(p.exists(), "Missing game.json")
        res = game_data.check(Path(WEB_DATA))
        self.assertTrue(any(lv == "PASS" for lv, _ in res), f"Unexpected game_data.check result: {res}")
        self.assertFalse(any(lv == "FAIL" for lv, _ in res), f"game_data.check failed: {res}")


if __name__ == "__main__":
    unittest.main()
