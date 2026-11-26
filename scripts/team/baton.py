"""Valida docs/team/BATON.md y emite sus campos como salidas de GitHub Actions.

    python scripts/team/baton.py            # valida e imprime
    python scripts/team/baton.py --github   # además escribe en $GITHUB_OUTPUT

Solo biblioteca estándar. Sale con código 1 si el baton es inválido.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BATON = ROOT / "docs" / "team" / "BATON.md"
OPERATORS = {"CODEX", "ANTIGRAVITY", "HUMAN"}
REQUIRED = ["project", "stage", "orchestrator", "next_operator", "next_dispatch", "next_task_file", "next_branch"]


def parse(text: str) -> dict[str, str]:
    return {m.group(1): m.group(2) for m in re.finditer(r"^- `([a-z_]+)`: `([^`]*)`\s*$", text, re.M)}


def validate(f: dict[str, str]) -> list[str]:
    errs = [f"falta el campo {k}" for k in REQUIRED if not f.get(k)]
    if errs:
        return errs
    if f["project"] != "peruciv":
        errs.append("project debe ser peruciv")
    for k in ("orchestrator", "next_operator"):
        if f[k] not in OPERATORS:
            errs.append(f"{k} inválido: {f[k]}")
    if not re.fullmatch(r"PC-\d{3}", f["next_dispatch"]):
        errs.append("next_dispatch debe tener la forma PC-NNN")
    if not re.fullmatch(r"team/[a-z0-9._-]{3,60}", f["next_branch"]):
        errs.append("next_branch debe empezar con team/ y usar [a-z0-9._-]")
    task = ROOT / f["next_task_file"]
    if not task.is_file():
        errs.append(f"no existe la tarea {f['next_task_file']}")
    elif f"Dispatch: `{f['next_dispatch']}`" not in task.read_text(encoding="utf-8"):
        errs.append("la tarea no declara Dispatch igual al baton")
    elif f"Operator: `{f['next_operator']}`" not in task.read_text(encoding="utf-8") and f["next_operator"] != "HUMAN":
        errs.append("la tarea no declara Operator igual al baton")
    return errs


def main() -> int:
    fields = parse(BATON.read_text(encoding="utf-8"))
    errs = validate(fields)
    if errs:
        print("BATON INVÁLIDO:\n- " + "\n- ".join(errs))
        return 1
    gate = fields.get("human_gate", "NO").upper() in {"YES", "TRUE", "PENDING", "REQUIRED"}
    dispatchable = fields["next_operator"] == "CODEX" and not gate
    print(f"Baton válido: {fields['next_dispatch']} -> {fields['next_operator']} (orquesta {fields['orchestrator']}) dispatchable={dispatchable}")
    if "--github" in sys.argv and os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as fh:
            for k, v in fields.items():
                fh.write(f"{k}={v}\n")
            fh.write(f"dispatchable={'true' if dispatchable else 'false'}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
