# Protocolo de equipo: Antigravity + Codex (+ el usuario)

El repositorio es el espacio de trabajo común: aquí se **proponen ideas, se discuten posiciones, se negocia quién hace qué y se pasa el relevo de orquestador**. Nada importante vive solo en el chat.

## 1. Canales (todo versionado en git)

| Canal | Para qué | Dónde |
|---|---|---|
| **Baton** | Quién orquesta ahora y quién actúa a continuación | [`BATON.md`](./BATON.md) |
| **Tablero** | Tareas, dueño, estado, dependencias | [`BOARD.md`](./BOARD.md) |
| **Tareas** | Instrucciones precisas por tarea | `docs/team/tasks/T-xxx-*.md` |
| **Debate** | Posiciones, objeciones, decisiones | `docs/game-design/NN_*.md` + Issues con etiqueta `debate` |
| **Decisiones** | Registro corto de lo acordado | [`DECISIONS.md`](./DECISIONS.md) |
| **Ejecución** | Verificación automática y despacho a Codex | `.github/workflows/` |

## 2. Roles y rotación del orquestador

- **Orquestador** = quien tiene el baton. Prioriza el tablero, asigna tareas, resuelve empates técnicos y entrega el baton al siguiente. **Solo uno a la vez.**
- **Rotación:** el baton cambia al **terminar cada etapa** (Etapa 1 → Antigravity orquesta; Etapa 2 → Codex; Etapa 3 → Antigravity…) o **antes si el orquestador se bloquea** o necesita una decisión de la otra parte.
- **El usuario** tiene autoridad final y puede tomar el baton (`next_operator: HUMAN`, `human_gate: YES` pausa toda automatización).
- Un agente que no es orquestador **puede** proponer cambios de plan, pero lo hace abriendo un Issue `debate` o añadiendo un documento numerado; el orquestador decide y lo anota en `DECISIONS.md`.

## 3. Propiedad de archivos (para no pisarnos)

| Zona | Dueño por defecto | Regla |
|---|---|---|
| `docs/game-design/` contrato de datos/estado y reglas de reloj | **Codex** | Antigravity revisa cobertura y unidades |
| `docs/game-design/` inventario de fuentes, Callao, boceto de UI | **Antigravity** | Codex revisa |
| `pipeline/sources/`, `pipeline/build/game_data.py`, `web/data/game.json` | **Antigravity** | Cambio de contrato se acuerda antes por documento |
| `web/js/ext/game/engine/` + sus pruebas | **Codex** | Funciones puras, ES Modules, sin dependencias |
| `web/js/ext/game/ui/`, overlays, registro en `web/js/ext/index.js` | **Antigravity** | Consume datos/eventos versionados |
| `.github/`, `scripts/team/`, `docs/team/` | **Orquestador vigente** | Cambios al protocolo se anotan en `DECISIONS.md` |
| Modo Atlas existente (`web/js/` fuera de `ext/game/`) | Nadie sin tarea explícita | No romper `pipeline check` ni `tests/` |

Un agente que necesite tocar un archivo ajeno **no lo edita**: abre una tarea o Issue pidiéndolo.

## 4. Flujo de una tarea

1. El orquestador crea/actualiza `tasks/T-xxx-*.md` y la fila en `BOARD.md` (estado `TODO`).
2. Actualiza `BATON.md` con `next_operator`, `next_task_file` y `next_dispatch` y hace push a `main`.
3. El operador trabaja en una rama `team/<dispatch>-<agente>`, ejecuta las verificaciones y abre un **Pull Request** hacia `main`.
4. El otro agente (o el orquestador) revisa el PR; al fusionar, el estado pasa a `DONE` y el baton se actualiza.
5. **No se declara DONE sin evidencia** (comandos ejecutados y salida).

## 5. Automatización con GitHub Actions

- **`ci.yml`**: en cada push/PR ejecuta `pipeline check`, las pruebas, la revisión de codificación UTF-8 y la validación del baton.
- **`team-baton.yml`**: cuando `BATON.md` cambia en `main` y `next_operator: CODEX` con `human_gate: NO`, valida el baton y activa `openai/codex-action` (secreto `OPENAI_API_KEY` ya configurado en el repo). Codex trabaja en una rama, el runner externo ejecuta las verificaciones y abre un PR con el resultado. Si el baton apunta a **ANTIGRAVITY**, el workflow publica un comentario/Issue de "turno de Antigravity" (Antigravity se activa desde el IDE del usuario, no desde Actions).
- Guardas: despacho idempotente por `dispatch`, Codex no puede modificar `docs/team/BATON.md`, `.github/` ni `docs/team/PROTOCOL.md`, y nada se fusiona sin pasar CI.

## 6. Reglas de oro

1. Distinguir **propuesta**, **decisión**, **implementación** y **verificación**.
2. Cada cifra de partida cita fuente oficial peruana; lo prospectivo se rotula **Simulación**.
3. Cero dependencias nuevas: `pipeline/` solo biblioteca estándar; `web/` ES Modules + Canvas 2D.
4. Antes de tocar código de juego: Etapa 1 cerrada (ver `BOARD.md`).
