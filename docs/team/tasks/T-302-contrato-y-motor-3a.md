# T-302 · Contrato y Motor de Etapa 3A (Onboarding/Día 1, Convenios, OxI CIPRL y Arequipa 125d)

Dispatch: `PC-008`
Operator: `CODEX`
Orquestador: Antigravity (D-007) · Revisor: Antigravity

## Contexto
El usuario dio **luz verde** al consenso de `docs/game-design/13_critica_antigravity_etapa_3_y_onboarding.md` y `docs/game-design/14_respuesta_codex_debate_etapa_3.md` (`D-016`, `D-017`).

## Alcance (solo `docs/game-design/` y `web/js/ext/game/engine/`)
1. **Contrato 3A (`docs/game-design/15_contrato_etapa_3a.md`):**
   - Extender el contrato v0.1 (o pasar a `schemaVersion: "0.2"` / `rulesVersion: "0.2"` retrocompatible si conviene) para:
     - `startDate` dinámico (fecha corriente en partida libre / fija en tutorial) + registro de `asOf` por fuente.
     - **Herencia Día 1 (`inherited`):** ejercicio vigente, `PIA`, `PIM`, `compromiso`, `devengado`, cartera heredada por CUI (`in_progress`, avance, saldo pendiente) y obligaciones `O&M` sin doble descuento.
     - **Énfasis de campaña** (`services | investment | dialogue | balanced`) y ajuste inicial de presupuesto en Día 1 (incluyendo bloqueo explicable cuando se intenta gastar un rubro restringido como Canon en gasto corriente, Art. 60° o norma sin competencia).
     - **Obras por Impuestos (OxI) y CIPRL:** tope CIPRL aplicable, margen libre, reserva plurianual y efecto de cancelación según etapa del compromiso.
     - **Dependencia de acceso en Arequipa:** conservar `95 días` para `aqp-water-work` y exigir en la secuencia por etapas que la obra inicie cuando el acceso prioritario esté habilitado (día 30) → entrega **día 125** (`6 de mayo`) y victoria a escala reducida (`215 min`).
2. **Motor puro 3A (`web/js/ext/game/engine/`):**
   - Implementar las reglas de `15_contrato_etapa_3a.md` manteniendo funciones puras, determinismo, enteros seguros y compatibilidad con los escenarios base.
   - Añadir pruebas en `web/js/ext/game/engine/*.test.js` cubriendo:
     - Arequipa por etapas con entrega día 125 y victoria a escala reducida (`215 min`).
     - Día 1 con herencia fiscal CUI + bloqueo legal de gasto restringido (`FUND_INELIGIBLE` / `ACTOR_NOT_COMPETENT`).
     - Competencia de dos proyectos OxI por el mismo tope CIPRL y cancelación.
     - Énfasis de campaña y fecha de inicio dinámica preservada al guardar/cargar.

## Fuera de alcance
No modificar `pipeline/`, `web/data/`, `web/js/ext/game/ui/`, `.github/`, `docs/team/BATON.md` ni `docs/team/PROTOCOL.md`.

## Criterio de aceptación
- `node --test web/js/ext/game/engine/*.test.js` pasa al 100%.
- `python scripts/team/check_encoding.py`, `python -m pipeline check` y `python -m unittest discover -s tests` pasan sin errores.
