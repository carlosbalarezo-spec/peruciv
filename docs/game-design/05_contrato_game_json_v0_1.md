# Contrato de datos, estado y reloj v0.1

Borrador de PC-001 para revisión de Antigravity. Todas las magnitudes, fechas y cantidades de los ejemplos y de la [traza](./06_traza_arequipa.md) son **simulación**. Los números en nombres de versiones y referencias identifican documentos o formatos.

## Documento inmutable

Objeto JSON cerrado por versión. Las tablas son listas de registros con `id` único por tabla, y toda referencia debe resolver en su tabla de destino. Los códigos territoriales, fechas e identificadores se guardan como cadenas. Las cantidades y resultados intermedios deben ser enteros seguros de JavaScript. Se rechazan desbordamientos, fracciones, referencias rotas y campos requeridos ausentes. Las fechas usan ISO civil gregoriano `YYYY-MM-DD`.

| Bloque requerido | Campos y restricciones |
|---|---|
| Cabecera | `schemaVersion`, `rulesVersion`, `datasetId`, `cutoffDate`, `gridVersion`, `units`. `datasetId` identifica un contenido inmutable. |
| `sources` | `id, publisher, url, locator, extractedOn`. Localizador de tabla o fila para fuentes publicadas. |
| `observations` | `id, metric, value, unit, scopeId, period, provenance, sourceIds, inputIds, method`. `value` admite `null` para desconocido, con motivo en `method`. |
| `territories`, `authorities` | Territorio con `id, ubigeo, parentId, cellIds`. Entidad con `id, territoryIds, roles` y competencias del escenario. La provincia presenta los resultados y cada nodo se cuenta una sola vez en balances compartidos. |
| `networks` | `waterNodes` con ámbito, oferta efectiva, protección doméstica y usos firmes. `powerNodes` con ámbito y potencia factible de conexión. `accesses` con predio, contraparte y factibilidad. `links` con extremos dirigidos, celdas, tramo vial, minutos base y disponibilidad inicial. Las cantidades de línea base apuntan a observaciones. El derecho de uso, la factibilidad y la capacidad técnica se registran por separado. |
| `catalog` | `works` con fases, costo, días de expediente y ejecución, fuentes elegibles, cambios al entregar y calendario de O&M. `agreements` con contraparte, modalidades, costos y fecha o plazo de habilitación. `investmentProfiles` con variantes, requisitos por etapa, plazos, desembolsos acreditables y empleo de obra y operación. |
| `scenarios` | `id, startDate, endDate, playerAuthorityIds, rivals, initialAccounts, obligations, inheritedProjects, offers, calendarEvents, goals`. Cada rival activo tiene regla, sede y semilla. Cada oferta tiene perfil, fecha inclusiva, candidatos explícitos con ruta y nodos de conexión, y desempate. Los demás territorios son contexto. |

`units` fija PEN en céntimos, agua en mL/s, potencia en W, tiempos de viaje en minutos, plazos en días civiles y empleo en personas. En la ficha de papel se usa una unidad presupuestaria ficticia. **Simulación:** una unidad se codifica como 100 céntimos y un l/s como 1000 mL/s.

Cada valor de entrada que determine la partida lleva una referencia de auditoría. En redes se usa el ID de observación. Para parámetros de catálogo o escenario se usa `evidence`, un mapa de punteros JSON relativos al registro hacia IDs de observación con valor y unidad coincidentes. `provenance` admite `oficial` (fuente peruana verificada y fila), `derivada` (entradas y transformación reproducible) y `supuesto` (método y rótulo visible **simulación**). Los desconocidos se conservan como tales. Una oferta con un requisito desconocido requiere un supuesto explícito para resolverlo en la prueba de papel o queda inelegible con motivo registrado.

## Guardado y paso del motor

El guardado incluye `schemaVersion, rulesVersion, datasetId, scenarioId, nextDate, seed, rngState, rivalRngStates, accounts, obligations, projects, agreements, reservations, incidents, offers, monthlyHistory, pendingOrders, orderLog, ledger`. Las cuentas se identifican por entidad y fuente, con disponible, saldo comprometido y movimientos. Los proyectos y convenios guardan fase y fechas efectivas. Las reservas guardan titular, nodo, cantidad, etapa y vencimiento. El libro guarda claves únicas de hitos de desembolso, cargos y liberaciones. Una versión o dataset incompatible impide cargar el guardado. La reproducción usa el arranque del escenario y el registro íntegro de órdenes externas, con semilla, reglas y datos idénticos.

`step(data, state, orders)` devuelve estado y eventos de un único día. El calendario de interfaz solicita pasos al ritmo elegido. Pausa solicita cero pasos. Los lotes atraviesan exactamente las mismas transiciones que los pasos individuales. El identificador de algoritmo aleatorio forma parte de `rulesVersion`; cualquier consumo usa el estado persistido del flujo correspondiente. La traza usa calendarios fijos y cero sorteos.

1. Aplicar altas y bajas de incidencias y cambios calendarizados, ordenados por ID. Las incidencias tienen inicio inclusivo y fin exclusivo.
2. Incorporar órdenes de jugador y rivales, validarlas con el mismo procedimiento y aplicarlas por secuencia global. Avanzar obras y convenios por ID y actualizar capacidades entregadas. Un expediente aceptado el día D y de duración N libera el equipo al inicio de D+N. Acreditar los cambios de capacidad antes de evaluar ofertas.
3. Resolver ofertas que venzan ese día por ID. Filtrar por acceso, capacidad, derechos, conexión y ruta. El saldo industrial disponible es el máximo entre cero y oferta efectiva menos protección doméstica, usos firmes y reservas activas. Un déficit doméstico se registra por separado. La ruta disponible minimiza tiempo entre enlaces habilitados, con empate por secuencia lexicográfica de IDs. Ordenar candidatos elegibles por minutos con penalización de escala, luego por planta completa y después por ID. Reservar capacidad al asignar cada oferta. Una ampliación futura requiere cronograma financiado y se activa al entregar capacidad suficiente. Si vence su plazo sin cumplir, registrar el incumplimiento y liberar la reserva según el perfil.
4. Registrar movimientos, desembolsos privados acreditados y empleo en operación. Cerrar el mes en su último día civil, cerrar el ejercicio al terminar diciembre y habilitar la reprogramación al abrir el siguiente ejercicio. En el último día del mandato, ejecutar los cierres que correspondan antes de evaluar. Guardar la siguiente fecha civil o marcar la partida terminada.

Las órdenes llevan `id, effectiveDate, sequence, actorId, type, payload`. Tipos del corte inicial: `startWork` con obra y fuente, `signAccessAgreement` con convenio, modalidad y fuente, y `reprogram` con ejercicio y asignaciones por fuente. La secuencia se asigna al ingresar y se conserva en reproducción. Los rivales se incorporan por ID después de las órdenes externas del día, con secuencias reproducibles. Reintentar un ID ya procesado conserva el resultado anterior. Una orden rechazada emite motivo y deja intactas cuentas y reservas. Se comprueban competencia, fecha, equipo, elegibilidad de fuente y fondos antes de comprometer el gasto.

Cada evento lleva `id, date, index, type, entityId, orderId, reasonCode, facts, deltas`. `index` fija el orden intradía, `orderId` admite nulo y `facts` incluye referencias a candidatos, rutas, enlaces y observaciones relevantes, con valores, umbrales y unidades. `deltas` enumera cambios con cuenta o nodo, unidad y cantidad firmada. El ID deriva de fecha e índice. Tipos mínimos: orden aceptada o rechazada, entrega, cambio de red, evaluación de candidato, adjudicación, movimiento de fondos, desembolso acreditado, entrada en operación y cierre. Por ejemplo, **simulación**, `ROUTE_LIMIT` explica una ruta de 265 min frente a un máximo de 240 min e identifica el enlace cerrado. El feed rival usa los mismos hechos y señala qué cambió. Cada desembolso se registra una vez por oferta y hito de construcción. Los puestos de operación se registran al activar la etapa y el cierre mensual conserva los días-persona para medir empleo sostenido.

## Preguntas abiertas para Antigravity

| Cobertura pendiente en `web/data/` | Pregunta para la auditoría |
|---|---|
| Agua. `water_access` mide acceso de hogares por red. | ¿Qué nodo y ámbito de SEDAPAR corresponden al predio, y qué fuentes sustentan oferta efectiva, demanda protegida, usos firmes, derechos y conexión? |
| Energía. El resumen departamental da contexto. | ¿Qué operador y nodo pueden acreditar potencia factible, capacidad comprometida y plazo de conexión? |
| Logística. La capa vial enlaza celdas y el puerto tiene `county: null`. | ¿Qué tramos SINAC, sentidos, jurisdicciones, tiempos y desvíos verificables permiten reconciliar el acceso a Matarani con Islay y contrastar capacidad del terminal? |
| Hacienda y convenios | ¿Qué corte MEF, pliegos, rubros, restricciones, caja, CUI, compromisos, convenios y obligaciones de O&M respaldan el margen ejecutable y quién firma cada intervención? |
| Inversión y empleo. La Planilla Electrónica disponible es una muestra. | ¿Qué perfiles pueden auditarse para demanda de servicios, desembolsos por hito y puestos formales sostenidos, y cuáles quedarán como supuestos? |
| Calendario y rivales | ¿Qué fechas de habilitación, datos comparables de sedes rivales y reglas de operación pueden respaldarse, y cuáles pertenecen exclusivamente al guion? |

[Ficha original](./03_respuesta_codex.md) · [Revisión de Antigravity](./04_antigravity_respuesta_a_codex.md) · [Contratos del Atlas](../DATA_CONTRACTS.md)
