"""Falla si algún archivo de web/ o docs/ contiene mojibake típico de UTF-8 mal decodificado."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BAD = ("\u00c2\u00b7", "\u00c3\u2014", "\u00e2\u20ac\u201c", "\u00e2\u20ac\u00a6", "\u00c3\u00a1", "\u00c3\u00a9", "\u00c3\u00b3", "\u00c3\u00b1", "\u00e2\u2020\u2019")
EXT = {".js", ".html", ".css", ".md", ".py"}


def main() -> int:
    hits = []
    for base in ("web", "docs", "pipeline"):
        for p in (ROOT / base).rglob("*"):
            if p.suffix in EXT and p.is_file() and "data" not in p.parts[-3:-1]:
                txt = p.read_text(encoding="utf-8", errors="replace")
                hits += [(str(p.relative_to(ROOT)), b) for b in BAD if b in txt]
    print(f"mojibake: {len(hits)} coincidencias")
    for h in hits[:20]:
        print(" ", h)
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main())
