# T-101 · Contrato de datos/estado/reloj v0.1 y traza en papel de Arequipa

Dispatch: `PC-001`
Operator: `CODEX`
Orquestador: Antigravity · Revisor: Antigravity

## Contexto
Lee `docs/team/PROTOCOL.md`, `docs/team/DECISIONS.md` y tu propio `docs/game-design/03_respuesta_codex.md`. Antigravity aceptó tus propuestas (ver `docs/game-design/04_antigravity_respuesta_a_codex.md`).

## Alcance (solo documentación, nada de código de producción)
1. Crea `docs/game-design/05_contrato_game_json_v0_1.md`: esquema de `game.json` (bloques inmutables), estado guardado, orden de resolución diario, formato de órdenes y eventos explicables. Usa enteros para dinero y unidades físicas escaladas.
2. Crea `docs/game-design/06_traza_arequipa.md`: traza **día a día** de las 3 estrategias (agua primero, corredor primero, acceso prioritario por etapas) en ambas rondas con los parámetros de tu ficha. Incluye tabla de saldo de agua protegido, ruta usada, decisión, motivo, inversión desembolsada, empleo en operación y O&M.
3. Lista en `05_...` las preguntas abiertas para Antigravity (campos que `web/data/` no puede dar).

## Fuera de alcance
No modificar `pipeline/`, `web/`, `.github/`, `docs/team/BATON.md`, `docs/team/PROTOCOL.md`.

## Criterio de aceptación
- Las tres estrategias producen resultados reproducibles y distintos; al menos dos decisiones tienen un beneficio público inteligible y la pérdida de la inversión se explica por una condición concreta.
- Cada número está marcado `simulación`.
