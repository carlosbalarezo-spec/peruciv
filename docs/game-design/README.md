# Coordinación de Diseño y Desarrollo: **PerúCiv — Modo Juego (Antigravity + Codex)**

Esta carpeta centraliza el diseño compartido, las revisiones cruzadas y los acuerdos técnicos entre **Antigravity** y **Codex** bajo la dirección del usuario antes y durante la implementación del modo jugable sobre `peruciv`.

## Documentos actuales

1. [`01_propuesta_codex.md`](./01_propuesta_codex.md) — Propuesta original de **Codex** (*PerúCiv · Estrategia regional en tiempo real*).
2. [`02_opinion_antigravity_y_plan_v2.md`](./02_opinion_antigravity_y_plan_v2.md) — **Evaluación de Antigravity sobre la propuesta de Codex** (los 7 aportes clave adoptados, elementos técnicos conservados de `peruciv` y preguntas abiertas) seguida del **Plan Consolidado v2** completo.
3. [`03_respuesta_codex.md`](./03_respuesta_codex.md) — Revisión del plan, reglas preliminares, fuentes a auditar y reparto propuesto.
4. [`04_traza_arequipa.md`](./04_traza_arequipa.md) — Primera partida en papel y casos para revisión cruzada.

---

## Estado actual de la base técnica (`peruciv` Modo Atlas)

Antes de tocar código para el modo juego, este es el estado verificado del repositorio:
- **Pipeline reproducible (`pipeline/`, Python >= 3.11 solo librería estándar, `dependencies = []`):**
  - Proyección equivalente de Albers segura para el hemisferio sur (`lat1=-4, lat2=-15, lat0=-9.5, lon0=-75`).
  - Malla hexagonal `82 × 130` (`3,460` hexágonos terrestres del Perú, radio ~12 km), **25 regiones** (24 departamentos + Callao), **196 provincias** (`counties.json` con 33 columnas) y **48 ciudades** (`cities.json`).
  - **15 fuentes oficiales** procesadas y verificadas: INEI/PCM (límites y ubigeos), ENAHO 2025 microdatos completos (33,702 hogares en las 196 provincias), MTPE Planilla Electrónica 2025, MINEM (generación eléctrica, hidrocarburos, minería), OSITRAN (aeropuertos), MINCETUR (sitios turísticos), SERNANP (ANPs), SUNEDU (universidades), MINCUL (RENTOCA), MINSA (anemia infantil), INDECI SINPAD (emergencias 2003–2025), Natural Earth y SRTM/ETOPO.
  - Verificación en verde: `uv run python -m pipeline check` (`31 pass, 0 warn, 0 fail`) y `uv run python -m unittest discover -s tests -v` (`4/4 OK`).
- **Frontend (`web/`, ES Modules puros + HTML5 Canvas 2D, cero bundlers/npm, 100% en español):**
  - Cuenta con una **API de Extensiones lista** en `web/js/ext/index.js` y `web/js/app/api.js` (`app.registerMode`, `app.ui.dock`, `app.ui.addTopButton`, `app.ui.addMapToggle`, `app.registerStaticLayer`, `app.registerOverlay`, `app.hash.register`).

---

## Reglas de Coordinación (Antigravity ↔ Codex)

1. **No tocar código de implementación hasta cerrar el acuerdo de diseño (Etapa 1)** o recibir instrucción explícita del usuario.
2. **No romper el Modo Atlas:** El juego se construirá de forma modular en `web/js/ext/game/` y nuevos módulos `pipeline/sources/` + `pipeline/build/game_data.py` (`web/data/game.json`), manteniendo siempre en verde `pipeline check` y `tests/`.
3. **Cero dependencias pesadas:** Mantener Python stdlib en `pipeline/` y ES Modules nativos sin bundler en `web/`.
4. **Rigor de datos oficiales vs. simulación:** Toda cifra de partida (presupuesto, capacidad, brecha, riesgo) debe citar fuente oficial peruana, año y granularidad real; todo cálculo prospectivo debe identificarse como **Simulación**.
5. **Bitácora de iteración:** Cuando **Codex** o **Antigravity** propongan ajustes al modelo en papel, fórmulas, fichas sectoriales o reparto de tareas, deberán añadir o actualizar un documento numerado en esta misma carpeta (`03_...`, `04_...`) para mantener contexto simétrico.

## Mesa de trabajo y relevo

El [issue de la Etapa 1](https://github.com/carlosbalarezo-spec/peruciv/issues/1) registra propuestas, desacuerdos, encargos y quién coordina en cada momento. Cada agente publica su posición, la evidencia, las alternativas y qué decisión necesita del otro. Las conclusiones se incorporan a los archivos de diseño mediante cambios revisables.

- **Encargos.** El orquestador propone el alcance, responsable, archivos y criterio de cierre. El agente lo acepta o propone un ajuste en el issue. Para editar, cada agente usa su propia rama y abre un PR enlazado al issue. Se acuerdan los cambios de archivos compartidos antes de editar.
- **Revisión cruzada.** Cada entrega incluye sus supuestos y una forma de reproducirla. El otro agente deja observaciones en el PR o en el issue. El orquestador registra la decisión y el motivo. Si el desacuerdo cambia el alcance o una preferencia del usuario, se eleva con sus alternativas.
- **Relevo.** Quien coordina deja enlaces a las entregas, decisiones pendientes y próximo objetivo. El agente entrante confirma que acepta. La secuencia prevista es Codex → Antigravity durante la integración de datos y Callao → Codex durante la revisión cruzada. El issue registra cada aceptación.
- **Verificación.** GitHub Actions comprueba enlaces locales de la documentación de diseño en cambios a `main` y en PR. La revisión del contenido y la aceptación del relevo quedan a cargo de los agentes.
