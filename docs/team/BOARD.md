# Tablero de tareas

Estados: `TODO` · `DOING` · `REVIEW` · `DONE` · `BLOCKED`. Dueño = quien ejecuta; revisor = quien verifica.

## Etapa 1 · Diseño y auditoría (orquestó: Antigravity) — CERRADA

| ID | Tarea | Dueño | Revisor | Estado | Depende de |
|---|---|---|---|---|---|
| T-101 | Traza en papel de Arequipa (3 estrategias × 2 rondas) | Codex | Antigravity | DONE (`04` + `08`) | — |
| T-102 | Inventario y auditoría de fuentes: qué es evidencia, qué es supuesto | Antigravity | Codex | DONE (`06`) | — |
| T-102b | Verificar URLs reales MEF/SUNASS/ANA/MTC/APN/MIDAGRI/MINEM/ENAPRES/Defensoría | Antigravity | Codex | DONE (`10_matriz_cobertura_y_auditoria.md`) | T-102 |
| T-103 | Ficha de tutorial + boceto de interfaz + revisión de la traza (Ica–Pisco en `09`) | Antigravity + Codex | Mutuo | DONE (`07` + `09`) | T-101 |
| T-104 | Campos requeridos por el contrato (`08`) vs. campos disponibles en `web/data/` | Antigravity | Codex | DONE (`10_matriz_cobertura_y_auditoria.md`) | T-105 |
| T-105 | Contrato `game.json` v0.1 + respuesta a la revisión de Antigravity (PC-003) | Codex | Antigravity | DONE (`08`) | T-101, T-103 |
| T-106 | Cierre de Etapa 1 y relevo de orquestación a Codex | Antigravity | Codex | DONE | T-102b, T-104 |

## Etapa 2 · Prototipo autorizado (orquesta: Codex)

| ID | Tarea | Dueño | Revisor | Estado |
|---|---|---|---|---|
| T-201 | Motor puro `web/js/ext/game/engine/` + pruebas (`PC-005`) | Codex | Antigravity | DONE (PR #6) |
| T-202 | `pipeline/build/game_data.py` + `web/data/game.json` (Arequipa + Ica–Pisco v0.1 con procedencias) + validación | Antigravity | Codex | DONE (PR #7) |
| T-203 | `web/js/ext/game/ui/` + overlays + registro en `ext/index.js` + regreso limpio al Atlas (+ fix 12 hidroeléctricas MINEM) | Antigravity | Codex | DONE (PR #8) |
| Extra | Arte del mapa: ilustraciones propias para las 31 maravillas (`codex/wonder-tiles`) | Codex | Antigravity | DONE (PR #9) |
| T-204 | Integración y traza reproducible extremo a extremo sobre `main` + cierre Etapa 2 (`PC-006`) | Codex | Antigravity | TODO |
