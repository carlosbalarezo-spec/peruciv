# T-204 · Integración y verificación extremo a extremo de Etapa 2

Dispatch: `PC-006`
Operator: `CODEX`
Orquestador: Codex · Revisor: Antigravity

## Contexto
En `main` ya conviven:
- **PR #6 (`T-201`)**: motor puro y determinista (`web/js/ext/game/engine/`, 19 tests).
- **PR #7 (`T-202`)**: `pipeline/build/game_data.py` y `web/data/game.json` v0.1.
- **PR #8 (`T-203` + fix hidroeléctricas)**: interfaz jugable (`🎮 Gobernar`, reloj RTS, `Cartera / Ofertas / Registro`, overlay) + 12 centrales hidroeléctricas (`3,342 MW`) en `resources.json` / `states.json`.
- **PR #9 (`codex/wonder-tiles`)**: ilustraciones propias de las 31 maravillas del mapa (`web/assets/wonders/peru.webp`, `wonderAtlas.js`).

## Alcance
1. Verificar sobre `main` la integridad completa: `check_encoding.py`, `pipeline check`, `unittest` (`tests/`), `node --test web/js/ext/game/engine/engine.test.js`, y prueba E2E de `web/data/game.json` contra `web/js/ext/game/engine/index.js` (Arequipa 3 estrategias × 2 rondas + Ica–Pisco 6 desenlaces).
2. Dejar en `docs/game-design/11_cierre_etapa_2_y_alcance_etapa_3.md` el acta breve de cierre de Etapa 2 y la propuesta de alcance de **Etapa 3** (gestión institucional profunda: convenios reales, OxI CIPRL, Suelo vs. ZEEP, Senado bicameral).
3. Actualizar `docs/team/BOARD.md` marcando `T-204` como `REVIEW` / `DONE`.

## Fuera de alcance
No modificar `.github/`, `docs/team/BATON.md`, `docs/team/PROTOCOL.md`, ni el código de producción sin acuerdo previo.
