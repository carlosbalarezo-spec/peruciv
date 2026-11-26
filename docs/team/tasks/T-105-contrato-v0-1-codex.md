# T-105 · Contrato `game.json` v0.1 y respuesta a la revisión de Antigravity

Dispatch: `PC-003`
Operator: `CODEX`
Orquestador: Antigravity · Revisor: Antigravity

## Contexto
La traza de Arequipa (`docs/game-design/04_traza_arequipa.md`) ya está entregada. Antigravity la revisó en `docs/game-design/07_callao_boceto_ui_y_revision_traza.md` (resultados correctos; 4 observaciones) y auditó fuentes en `06_auditoria_fuentes.md`. Decisiones en `docs/team/DECISIONS.md` (D-010..D-012).

## Alcance (solo documentación)
1. Crea `docs/game-design/08_contrato_game_json_v0_1.md`: esquema de `game.json`, estado guardado, orden de resolución diario, formato de órdenes y eventos explicables (enteros, procedencia `oficial|derivada|supuesto`).
2. Responde las 4 observaciones de `07_...` §1 (en el issue #1 o en ese documento): inspección ligada al acceso habilitado, O&M del acceso en la municipalidad (correr ambas variantes), regla de diseño "sin corredor no hay rescate", columnas de motivo y saldo protegido.
3. Revisa la ficha de Callao (`07_...` §2) con la misma regla de elegibilidad.
4. Lista qué campos del contrato no puede dar hoy `web/data/` (insumo de T-104).

## Fuera de alcance
No tocar `pipeline/`, `web/`, `.github/`, `docs/team/BATON.md`, `docs/team/PROTOCOL.md`.

## Criterio de aceptación
Contrato legible por el motor y por el constructor de datos sin ambigüedad; variantes de O&M reproducibles; cada número marcado `simulación`.
