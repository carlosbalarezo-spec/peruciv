# Etapa 1 · T-102 Inventario y auditoría de fuentes (Antigravity)

Estado de cada dato que el prototipo necesita: qué **ya existe en el repo** (y con qué límite), qué **fuente oficial hay que extraer** y qué queda como **supuesto rotulado**. Las URL externas vienen de [03_respuesta_codex.md](./03_respuesta_codex.md) y están **sin verificar** hasta que se extraigan (T-102b); no se afirma ninguna cifra oficial nueva en este documento.

Procedencia permitida en `game.json`: `oficial` (extraída y trazable) · `derivada` (calculada de oficiales, con método) · `supuesto` (simulación rotulada).

## 1. Lo que el Atlas ya aporta y sus límites (verificado en el repo)

| Dato | Archivo / campo | Límite para el juego |
|---|---|---|
| Territorio: 25 regiones, 196 provincias, UBIGEO | `states.json`, `counties.json` (`geoid`) | Arequipa `04`, provincia `0401`, Islay `0407`, Callao `0701`. Fiable (INEI/PNDA). |
| Acceso a agua por red de hogares | `counties.json:water_access` | **ENAHO 2025 con suavizado empírico bayesiano** en provincias pequeñas. Es cobertura de hogares, **no caudal ni saldo en l/s**. |
| Pobreza, ingreso, internet, educación | `counties.json` | ENAHO 2025: muestra (33 702 hogares); error muestral alto en provincias pequeñas. |
| Cifras departamentales (PBI, pobreza, desempleo…) | `DEP_STATS` en `pipeline/sources/peru_socioeconomic.py` | Valores de referencia **escritos en el código**, no extraídos por el pipeline. Pasan a `supuesto` hasta auditarlos contra INEI. |
| Empleo formal por sector | `districts.json`, `citizens.json` (MTPE) | **Muestra** (Planilla Electrónica dic. 2025); no usar como total regional. |
| Red vial y ferroviaria | `infrastructure.json` (pares de celdas + clase) | Natural Earth 1:10m, no es el SINAC del MTC. Sin código de ruta ni tiempos. |
| Puertos y aeropuertos | `infrastructure.json` | `county: null` en Matarani y Callao: hay que reconciliar jurisdicción. Capacidad libre del terminal: no existe. |
| Energía | `resources.json`, `states.json:energy` | Potencia instalada (MINEM), no capacidad factible en un nodo. |
| Emergencias | `disasters.json` (INDECI 2003–2025) | Sirve para riesgo base; no es un calendario de eventos. |

## 2. Inventario por dato del escenario Arequipa

| Necesidad del escenario | Fuente candidata | Estado | Decisión |
|---|---|---|---|
| Presupuesto elegible y obligaciones (PIA, PIM, compromiso, devengado) | MEF Consulta Amigable | Pendiente de extracción | Escenario de papel usa **65 u. simuladas** (`supuesto`). La extracción es T-102b. |
| Cartera heredada (CUI, costo, avance) | MEF Seguimiento de Proyectos de Inversión (datos abiertos) | Pendiente | Sin cartera real en el prototipo; se declara 0 heredado (`supuesto`). |
| Oferta efectiva de agua, usos firmes | SUNASS Benchmarking + ANA (Plan Quilca–Chili) | Pendiente; el balance l/s probablemente **no está publicado** | Los 100/82/16 l/s son `supuesto`; se marca "desconocido" en datos reales. |
| Continuidad y presión (línea base de hogares) | SUNASS | Pendiente | Línea base opcional, no entra al cálculo del dilema. |
| Rutas y tiempos a Matarani | MTC SINAC + cálculo propio sobre enlaces | Parcial (Natural Earth) | Los minutos (205/175/230/265) son `supuesto`; la geometría se toma del Atlas. |
| Movimiento portuario | APN PIEP | Pendiente | Solo contexto comercial. |
| Insumo agrícola de la oferta | MIDAGRI SIEA | Pendiente | Un cultivo candidato basta para la ficha. |
| Victimización | INEI ENAPRES | Fuera del primer corte | Entra en la etapa de seguridad. |
| Conflictos | Defensoría (reporte mensual) | Fuera del primer corte | El incidente del día 105 es ficticio. |

## 3. Reglas de auditoría
1. Ninguna cifra decisiva entra a `game.json` sin `procedencia`, entidad, URL, tabla o fila, periodo, ámbito y método.
2. Desconocido = `null`, nunca un valor inventado. Si el dato real no existe, la ficha del escenario declara el supuesto.
3. Un valor departamental no se reparte a provincias ni hexágonos sin una fuente con ese detalle.
4. `pipeline check` debe fallar si un campo del escenario carece de procedencia.

## 4. Siguientes tareas derivadas
- **T-102b** (Antigravity): extraer MEF Consulta Amigable para Arequipa y Callao y SUNASS/ANA; verificar cada URL; reportar qué existe realmente.
- **T-104** (Antigravity): tabla campos-requeridos vs campos-disponibles del contrato de Codex.
