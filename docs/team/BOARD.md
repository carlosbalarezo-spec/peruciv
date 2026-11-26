# Tablero de tareas

Estados: `TODO` · `DOING` · `REVIEW` · `DONE` · `BLOCKED`. Dueño = quien ejecuta; revisor = quien verifica.

## Etapa 1 · Diseño y auditoría (orquesta: Antigravity desde D-010)

| ID | Tarea | Dueño | Revisor | Estado | Depende de |
|---|---|---|---|---|---|
| T-101 | Traza en papel de Arequipa (3 estrategias × 2 rondas) | Codex | Antigravity | DONE (`04_traza_arequipa.md`, revisada en `07`) | — |
| T-102 | Inventario y auditoría de fuentes: qué es evidencia, qué es supuesto | Antigravity | Codex | DONE (`06_auditoria_fuentes.md`) | — |
| T-102b | Extraer MEF/SUNASS/ANA para Arequipa y Callao y verificar cada URL | Antigravity | Codex | TODO | T-102 |
| T-103 | Ficha de Callao (tutorial) + boceto de interfaz + revisión de la traza | Antigravity | Codex | DONE (`07_callao_boceto_ui_y_revision_traza.md`) | T-101 |
| T-104 | Campos requeridos por el contrato vs. campos disponibles en `web/data/` | Antigravity | Codex | TODO | T-105 |
| T-105 | Contrato `game.json` v0.1 + respuesta a la revisión de Antigravity (PC-003) | Codex | Antigravity | TODO | T-101, T-103 |
| T-106 | Cierre de Etapa 1: dos trazas + revisión cruzada + inventario → decisión de pasar a Etapa 2 y relevo a Codex | Orquestador | — | TODO | T-102b, T-104, T-105 |

## Etapa 2 · Prototipo autorizado (orquesta: Codex)

| ID | Tarea | Dueño | Revisor | Estado |
|---|---|---|---|---|
| T-201 | Motor puro `web/js/ext/game/engine/` + pruebas (repetición, febrero/diciembre, reservas, desvío de enlace, desempate) | Codex | Antigravity | BLOCKED (espera T-106) |
| T-202 | `pipeline/sources/` nuevas + `pipeline/build/game_data.py` + `web/data/game.json` + validación | Antigravity | Codex | BLOCKED |
| T-203 | `web/js/ext/game/ui/` + overlays + registro en `ext/index.js` + regreso limpio al Atlas | Antigravity | Codex | BLOCKED |
| T-204 | Integración y traza reproducible extremo a extremo | Orquestador | — | BLOCKED |
