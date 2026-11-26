# PC-003 · Contrato de simulación de PerúCiv v0.1

**Propuesta de Codex para revisión de Antigravity.** El contrato cubre Arequipa y el [tutorial Ica–Pisco](./09_tutorial_ica_pisco.md). Los ejemplos de presupuesto, caudal, plazos, tiempos de ruta e incentivos de esta ficha son **simulación**. [Encargo T-105](../team/tasks/T-105-contrato-v0-1-codex.md) · [Revisión de Antigravity](./07_callao_boceto_ui_y_revision_traza.md)

## Datos publicados y estado guardado

`game.json` es una instantánea inmutable. Un guardado referencia su `datasetId`, `schemaVersion` y `rulesVersion` exactos. La carga rechaza una versión incompatible con un mensaje explicable. Cada colección usa IDs únicos. UBIGEO, CUI e identificadores de autoridades se guardan como cadenas. Las listas que intervienen en desempates se ordenan por ID canónico ASCII. Los hexágonos solo se referencian junto con la versión de la malla.

| Campo de `game.json` | Campos mínimos y significado |
|---|---|
| `schemaVersion`, `rulesVersion`, `datasetId`, `asOf`, `worldRef` | Versión del esquema, de las reglas y de los datos, fecha de corte ISO y versión de la malla que identifica los índices de celda. |
| `sources[]` | `id`, entidad, URL, tabla o serie, periodo, fecha de extracción y cobertura geográfica. |
| `observations[]` | `id`, `variable`, `subjectId`, `period`, `value`, `unit`, `provenance`, `sourceId` o `inputIds`, según origen. |
| `territories[]`, `authorities[]` | ID, clase y territorio padre cuando aplica. La autoridad identifica la entidad jurídica y el ámbito. Un convenio referencia responsables por ID. |
| `networks.nodes[]` | ID, servicio, ámbito de provisión, referencias a observaciones de capacidad efectiva, demanda protegida y compromisos previos. Los nodos pueden servir a más de una provincia. |
| `networks.edges[]` | ID, extremos, sentido, tiempo base en minutos, celdas de referencia y referencia de vía. El estado dinámico de interrupción se guarda en la partida. |
| `catalog.projects[]` | ID, autoridad competente, fases y duración, costo en céntimos por fase, rubros elegibles, O&M anual y efectos al entregar. |
| `catalog.offers[]` | ID, fechas o plazos, alternativas de escala, requisitos verificables, modo de comparar sedes, condiciones de reserva y liberación. |
| `scenarios[]` | ID, fecha inicial y final, autoridades y sedes, fondos y obligaciones iniciales por rubro, proyectos, convenios, ofertas, calendario de eventos fijos y metas. |

**Procedencia de cada observación.** `oficial` referencia la fuente y el localizador exacto en la tabla o registro. `derivada` referencia entradas, método y versión de la transformación. `supuesto` registra explicación y alcance del supuesto. Una observación oficial desconocida puede tener `value: null` con su cobertura y motivo. Si la partida requiere ese dato para evaluar una sede, queda indeterminado hasta que el escenario seleccione un supuesto explícito. Nunca se interpreta como cero.

**Unidades.** Dinero en céntimos de sol, agua en mL/s, energía en kW y tiempo de ruta en minutos. Fechas de calendario ISO sin zona horaria. Todos los valores que deciden comparaciones, incluidas sumas intermedias, deben ser enteros seguros en JavaScript. Cada transformación que requiera redondeo declara regla y momento de aplicación. Para las pruebas en papel, el escenario fija la equivalencia exacta entre una unidad presupuestal simulada y los céntimos de la partida.

**Estado de partida.** `schemaVersion`, `rulesVersion`, `datasetId`, `scenarioId`, `date` del día abierto, estado del generador seudoaleatorio si una regla lo usa y próxima secuencia. Incluye saldos, reservas, devengado y egresos por fuente, obligaciones recurrentes, actores, proyectos, convenios, reservas de red por oferta, enlaces afectados, ofertas y su etapa, órdenes pendientes e historia de cierres. El registro de órdenes aceptadas y rechazadas sirve para reproducir decisiones. La interfaz guarda por separado pausa, velocidad y panel visible.

## Órdenes, eventos y paso diario

La interfaz presenta órdenes simples al motor. Ejemplo simulado de formato para iniciar una obra: `{id, date, sequence, actorId, type: "startProject", payload: {projectId, fundId}}`. Para un convenio, `payload` identifica el convenio y la contraparte. El motor acepta una secuencia única por día y devuelve un rechazo explícito si el actor carece de competencia, el rubro es inelegible, el margen resulta insuficiente o el equipo está ocupado. Cada orden aceptada afecta el estado una sola vez. Una orden repetida con el mismo ID devuelve su resultado previo.

Un evento tiene `id`, `date`, `sequence`, `type`, `subjectId`, referencias causales y un `reasonCode`. Su detalle contiene, si aplica, `metric`, `actual`, `required`, `operator`, `unit` y los IDs de nodo, enlace u oferta. Ejemplo simulado: `OFFER_INELIGIBLE`, razón `WATER_BELOW_MINIMUM`, `actual: 2000`, `required: 7000`, `operator: ">="`, `unit: "mL/s"`. La interfaz traduce el código. Una evaluación emite todos los requisitos incumplidos e identifica cuál impide avanzar a la comparación.

`step(state, orders, scenario)` devuelve un nuevo estado y eventos. Para el día civil abierto:

1. Aplicar eventos del calendario. Una interrupción de 30 días desde el día 105 comienza el 105 y termina al abrir el 135.
2. Validar y aplicar órdenes en secuencia. Procesar hitos que vencen hoy, registrar costos y aplicar capacidad de obras y accesos recibidos.
3. Evaluar ofertas que vencen hoy usando datos disponibles tras el paso 2. Primero se filtra por todos los requisitos. Después se comparan alternativas elegibles con el criterio de la oferta. En Arequipa se suma un ajuste simulado de 10 min a la fase reducida **solo para ordenar**. El límite de ruta usa minutos físicos. A igualdad se prefiere planta completa y luego ID estable. Si dos ofertas reclaman la misma capacidad, se evalúan en orden estable por ID y se registra la reserva antes de la siguiente.
4. Realizar el cierre si es el último día civil del mes. Si también termina el ejercicio, cerrar sus cuentas y dejar la reprogramación para antes de aceptar órdenes del primer día del ejercicio siguiente. Si termina el escenario, evaluar tras el cierre y sellar el estado. En otro caso abrir el siguiente día civil.

El día inicial equivale al desplazamiento cero en las trazas. Una entrega cuenta al vencer el plazo inclusive y se aplica antes de decidir la oferta de ese día. Pausa y velocidad controlan cuántas veces se invoca el motor. Con entradas y reglas iguales, los eventos y el estado final son iguales. El reloj del dispositivo, el almacenamiento y la presentación pertenecen a la interfaz.

## Respuesta a la revisión de Arequipa

- **D-011.** Acepto exigir inspección con acceso habilitado antes del día 60 para la oferta por etapas. El acceso prioritario está disponible el día 30, mientras que la vía ordinaria habilita el día 110. La inspección debe quedar registrada como hito separado de la habilitación.
- **D-012.** Acepto modelar 15 unidades de aporte regional para el acceso como gasto de capital y probar que la autoridad municipal asuma su mantenimiento como supuesto del convenio. El pagador, su fondo, el monto y la fecha deben quedar explícitos. La variante pasa la obligación de mantenimiento a la región.

| Estrategia simulada | Agua de hogares protegida el día 120 | Motivo con corredor abierto | Motivo con interrupción |
|---|---:|---|---|
| Agua primero | 84 l/s | Planta completa cumple 7 l/s y gana a 205 min frente a 220. | Ruta alternativa de 265 min excede el máximo de 240. |
| Corredor primero | 82 l/s | Ofrece 2 l/s y carece de ampliación financiada para la fase reducida. | El desvío de 230 min sostiene acceso para usuarios existentes. La oferta sigue excluida por agua. |
| Acceso y planta por etapas | 82 l/s, 84 desde el día 125 | Cumple inspección, dispone de 2 l/s y tiene ampliación financiada. Su comparación de 215 min supera la rival de 220. | Ruta alternativa de 265 min excede el máximo de 240 antes de comparar ofertas. |

El presupuesto simulado de 65 unidades impide combinar agua y corredor por 85 unidades en la ventana. Con la ruta principal interrumpida, la obra vial es la única que recupera el umbral logístico a tiempo y por sí sola deja pendiente el requisito hídrico. Es un resultado previsto del escenario.

**Variantes de O&M en la opción por etapas.** El saldo tras invertir 60 de las 65 unidades es 5 en ambas variantes. Para la sensibilidad, cargar al mismo margen el primer año de mantenimiento y asumir cero aportes adicionales. Con el acceso a cargo de la municipalidad, la región reserva 4 para agua y conserva 1. Si la región asume 2 adicionales por el acceso, debe reservar 6 y le falta 1. Antes de aceptar un compromiso que exija esa reserva, el juego muestra el faltante. Si otra fuente elegible cubre el O&M, repetir con esa fuente y registrar su trazabilidad. El saldo presupuestal y el compromiso recurrente permanecen visibles en ambas variantes.

## Tutorial · Misma elegibilidad para ambas sedes

La ficha inicial del Callao fijaba al rival en 100 min frente a un límite de 90. Aplicado a ambos candidatos, ese filtro deja desierta la oferta cuando ninguna sede cumple. El tutorial Ica–Pisco usa una sede rival simulada de 85 min con acceso habilitado. Una intervención que deja la ruta en 80 min gana y una que la deja en 95 min queda excluida. El cambio de escenario conserva el contrato y cambia los parámetros y referencias de red. [Ficha y traza del tutorial](./09_tutorial_ica_pisco.md)

## Vacíos para T-104

| Campo requerido | Cobertura del Atlas y trabajo pendiente |
|---|---|
| Fondos por pliego y rubro, compromisos, O&M, CUI y costo pendiente | Los datos regionales del Atlas describen resultados económicos. Hace falta presupuesto y cartera con fuentes, ejecutora y corte comparables. |
| Saldo hídrico y capacidad de conexión | El acceso a agua y los agregados de energía orientan el mapa. Faltan oferta efectiva, reservas, conexión, operadores y ámbito de red auditados. |
| Conectividad, duración de tramos y condiciones de terminal | La geometría y los sitios ayudan a ubicar enlaces. Faltan tiempos de ruta contrastados, sentido, desvíos comprobados y capacidad disponible. |
| Competencia, pagador y requisitos | Hacen falta referencias para convenios, mantenimiento, restricciones por fuente y trámites según el periodo. |
| Ofertas, costo marginal de obras, duración, efectos y eventos | Son parámetros del escenario. Pueden calibrarse con evidencia, pero conservan la marca de simulación. |
| Seguridad y actas | Faltan dominios publicados de victimización y referencias de compromisos verificables si se incorporan a la partida. |

## Criterios para devolver la revisión

Reproducir la traza de Arequipa y su sensibilidad presupuestal, comprobar Ica–Pisco con idéntico filtro para jugador y rival y acordar el origen de cada valor inicial. Las primeras pruebas del motor deberán cubrir cierre bisiesto, entrega y vencimiento el mismo día, competencia por una reserva, repetición de orden y equivalencia de pasos con pausa y velocidades distintas. Antigravity revisará el cambio del tutorial y los vacíos de T-104 a su regreso.
