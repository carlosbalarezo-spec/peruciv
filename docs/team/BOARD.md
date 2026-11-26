# Tablero de tareas

Estados: `TODO` · `DOING` · `REVIEW` · `DONE` · `BLOCKED`. Dueño = quien ejecuta; revisor = quien verifica.

## Etapa 1 · Diseño y auditoría (orquesta: Antigravity)

| ID | Tarea | Dueño | Revisor | Estado | Depende de |
|---|---|---|---|---|---|
| T-101 | Contrato `game.json` + estado guardado + reloj (versión 0.1) y traza en papel de Arequipa (3 estrategias × 2 rondas) | Codex | Antigravity | DONE (traza en 04; contrato pasa a T-105) | — |
| T-102 | Inventario y auditorÃ­a de fuentes (MEF, SUNASS/ANA, MTC/APN, MIDAGRI/PRODUCE/MINEM, ENAPRES, DefensorÃ­a): quÃ© es evidencia, quÃ© es supuesto | Antigravity | Codex | DONE (06; extracción en T-102b) | â€” |
| T-103 | Ficha de Callao (tutorial 5–8 min) + boceto de interfaz del modo juego | Antigravity | Codex | DONE (07) | T-101 (mecánica) |
| T-104 | Revisión cruzada del contrato con cobertura/unidades reales de `web/data/` (campos disponibles vs. requeridos) | Antigravity | Codex | TODO | T-101 |
| T-105 | Cierre de Etapa 1: dos trazas en papel + revisión cruzada + inventario → decisión de pasar a Etapa 2 | Orquestador | — | TODO | T-101..T-104 |

## Etapa 2 · Prototipo autorizado (orquesta: Codex)

| ID | Tarea | Dueño | Revisor | Estado |
|---|---|---|---|---|
| T-201 | Motor puro `web/js/ext/game/engine/` + pruebas (repetición, febrero/diciembre, reservas, desvío de enlace, desempate) | Codex | Antigravity | BLOCKED (espera T-105) |
| T-202 | `pipeline/sources/` nuevas + `pipeline/build/game_data.py` + `web/data/game.json` + validación | Antigravity | Codex | BLOCKED |
| T-203 | `web/js/ext/game/ui/` + overlays + registro en `ext/index.js` + regreso limpio al Atlas | Antigravity | Codex | BLOCKED |
| T-204 | Integración y traza reproducible extremo a extremo | Orquestador | — | BLOCKED |

| T-102b | Extraer MEF/SUNASS/ANA para Arequipa y Callao y verificar URL | Antigravity | Codex | TODO | — |
| T-105 | Contrato game.json v0.1 + respuesta a revisión (PC-003) | Codex | Antigravity | TODO | T-101, T-103 |
