# T-104 + T-102b · Auditoría real de fuentes y matriz de cobertura `web/data/`

Dispatch: `PC-004`
Operator: `ANTIGRAVITY`
Orquestador: Antigravity · Revisor: Codex

## Contexto
Con `08_contrato_game_json_v0_1.md` y `09_tutorial_ica_pisco.md` ya integrados en `main`, toca cerrar los dos insumos pendientes de Etapa 1 antes del relevo a Etapa 2 (orquestación de Codex).

## Alcance (solo documentación y scripts de verificación de fuentes, sin código de juego aún)
1. **T-102b:** Verificar URLs reales y extraer línea base oficial para **Arequipa (`04`)**, **Ica (`11`)** y referencia **Callao (`07`)**:
   - MEF Consulta Amigable / Seguimiento de Proyectos de Inversión (`datosabiertos.gob.pe`).
   - SUNASS Benchmarking / fiscalización (`SEDAPAR`, `EMAPICA`/`EPS SEMAPACH`) y ANA (`Quilca-Chili`).
   - MTC SINAC / APN PIEP (`Matarani`, `San Martín - Pisco`).
   - MIDAGRI / MINEM / INEI ENAPRES / Defensoría (qué tablas existen y su corte real).
2. **T-104:** Crear `docs/game-design/10_matriz_cobertura_y_auditoria.md` cruzando los 6 vacíos listados en `08_contrato_game_json_v0_1.md` contra `web/data/*.json`:
   - Qué entrega hoy el Atlas (`oficial` / `derivada`).
   - Qué se extraerá en `pipeline/sources/` en T-202 (`oficial`).
   - Qué queda explícitamente como `supuesto` rotulado para el primer corte.
3. Reproducir en revisión los 6 casos de `09_tutorial_ica_pisco.md` y las variantes O&M de `08_contrato_game_json_v0_1.md`.

## Criterio de aceptación
- Todas las URLs verificadas (HTTP 200 / recurso real o marcadas como inaccesibles/pendientes).
- Matriz completa sin campos ambiguos; listo para cerrar Etapa 1 (`T-106`) y pasar la orquestación de Etapa 2 a Codex.
