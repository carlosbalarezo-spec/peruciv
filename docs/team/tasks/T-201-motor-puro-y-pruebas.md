# T-201 · Motor puro `web/js/ext/game/engine/` y pruebas unitarias (Etapa 2)

Dispatch: `PC-005`
Operator: `CODEX`
Orquestador: Codex · Revisor: Antigravity

## Contexto
Etapa 1 cerrada (`docs/game-design/10_matriz_cobertura_y_auditoria.md`). El contrato v0.1 (`08_contrato_game_json_v0_1.md`), la traza de Arequipa (`04` + `08`) y el tutorial Ica–Pisco (`09`) están aprobados. A partir de este despacho **Codex asume la orquestación de Etapa 2** (D-007).

## Alcance (solo `web/js/ext/game/engine/` y sus pruebas `*.test.js`)
1. Implementar el motor puro y determinista en ES Modules nativos (cero dependencias externas, sin DOM, enteros para dinero en céntimos / agua en mL/s / energía en kW / tiempo en minutos, fechas ISO sin zona horaria):
   - Carga y validación de versión (`schemaVersion`, `rulesVersion`, `datasetId`, `worldRef`) y rechazo explicable ante incompatibilidad.
   - Orden de resolución diario en 4 pasos (`08_contrato_game_json_v0_1.md`): eventos/red → órdenes y hitos/capacidad → evaluación de ofertas (filtro simétrico, reservas estables por ID, ajuste virtual solo para ordenar) → cierre mensual (incluyendo febrero y años bisiestos) / cierre anual / fin de escenario.
   - Guardado y carga de estado + registro de órdenes para reproducción idéntica.
2. Incluir la suite de pruebas en `web/js/ext/game/engine/*.test.js` (ejecutable con `node --test` en CI) cubriendo como mínimo:
   - Repetición idéntica de una partida con la misma entrada a distintas velocidades (1×, 2×, 4×) y pausas.
   - Cierres de febrero (28 y 29 en bisiesto) y 31 de diciembre.
   - Rechazo de gasto contra fuente inelegible o sin saldo (incluyendo la variante O&M regional `-1` de Arequipa).
   - Reservas incompatibles sobre el mismo nodo de agua.
   - Interrupción y desvío de enlace (ronda 2 de Arequipa, días 105–135).
   - Empate entre sedes y desempate estable por ID.
   - Los 6 desenlaces del tutorial Ica–Pisco (`09_tutorial_ica_pisco.md`) incluyendo entrega día 90 vs. 91 y oferta desierta.
   - Guardado seguido de carga y reproducción equivalente.

## Fuera de alcance
No modificar `pipeline/`, `web/data/`, `web/js/ext/index.js`, `web/js/ext/game/ui/`, `.github/`, `docs/team/BATON.md` ni `docs/team/PROTOCOL.md`.

## Criterio de aceptación
- `node --test` pasa al 100% sobre todos los archivos `web/js/ext/game/engine/*.test.js`.
- `python scripts/team/check_encoding.py`, `python -m pipeline check` y `python -m unittest discover -s tests` pasan sin errores.
