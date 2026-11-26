# Etapa 1 · Tutorial Ica–Pisco

**Decisión de trabajo durante la coordinación interina de Codex.** El primer tutorial se sitúa en Ica–Pisco. Arequipa–Matarani sigue como demo principal. Callao queda para un escenario posterior que pueda darle un área seleccionable en una vista metropolitana. La ficha histórica de Callao conserva el boceto de interfaz y la revisión cruzada de Arequipa. [Mesa de trabajo](https://github.com/carlosbalarezo-spec/peruciv/issues/1#issuecomment-7200816344) · [Ficha original](./07_callao_boceto_ui_y_revision_traza.md)

## Corredor y fuentes

La malla vigente asigna 60 celdas a Ica y ninguna celda terrestre al Callao. En Ica, el anclaje de la ciudad y el del terminal están conectados por cuatro enlaces consecutivos de la red del Atlas.

| Elemento del Atlas | Referencia verificada |
|---|---|
| Ciudad de Ica | Celda `7826`. |
| Corredor esquemático Ica–Pisco | `7826 → 7745 → 7744 → 7743 → 7660`. Los cuatro tramos aparecen en `infrastructure.json` y sus extremos pertenecen a Ica. |
| Terminal | Puerto `pisco`, celda `7660`. Comparte anclaje con la ciudad de Pisco. El tutorial identifica el nodo como terminal y separa su selección de la de la ciudad. |
| Acceso terminal | `7743 → 7660`, único enlace vial del terminal en el subgrafo de Ica. Al retirar cualquiera de los cuatro enlaces, el mapa no contiene un camino alternativo que permanezca en Ica. |

La red del Atlas demuestra que la ruta puede representarse con la malla actual. Sus cuatro tramos tienen el campo de nombre vacío. Los índices no identifican segmentos oficiales ni acreditan recorridos reales, tiempos o capacidad. [Geometría](../../web/data/world.json) · [Red del Atlas](../../web/data/infrastructure.json) · [Ciudades](../../web/data/cities.json)

- **Ubicación oficial.** El MTC sitúa el Terminal Portuario General San Martín en Punta Pejerrey, distrito de Paracas, provincia de Pisco, Ica, y lo relaciona con el acceso por la Panamericana Sur. [MTC · Terminal Portuario General San Martín](https://portal.mtc.gob.pe/transportes/concesiones/infraestructura_portuaria/portuario_san_martin.html)
- **Corredor de referencia.** El expediente publicado por SERNANP identifica el empalme PE-1S, desvío a Paracas y la ruta PE-28 en el acceso al puerto. La ficha describe un proyecto específico y advierte superposición con la reserva y su zona de amortiguamiento. Sirve para auditar jurisdicción y restricciones del acceso. El tutorial simula mejoras sobre un enlace existente. [Expediente · Cuadro 02 y Opinión Técnica 233-2019-SERNANP](https://compatibilidad.sernanp.gob.pe/consultasernanp/files/582508_1611260747013.pdf) · [MTC · Clasificador de rutas nacionales](https://portal.mtc.gob.pe/transportes/caminos/normas_carreteras/mapa-ruta-nacional.html)

Para fijar la línea base en una versión calibrada queda pendiente cotejar geometría y tiempos de operación, la autoridad de cada tramo, los requerimientos ambientales aplicables y el calendario real. El uso del acceso en el tutorial presupone, como regla simulada, un convenio habilitante y que las intervenciones son elegibles. El jugador compromete su presupuesto regional en las condiciones de ese convenio.

## Partida en papel

**Todas las cifras de juego de esta sección son simuladas.** Duración objetivo de 5–8 minutos. Una empresa de cadena de frío compara una sede en Ica y una sede rival externa al mapa del tutorial. Decide el día 90. Ambas sedes necesitan acceso habilitado y un recorrido de hasta 90 min. Entre las elegibles, gana el menor tiempo. La rival queda en 85 min. En Ica los otros requisitos quedan satisfechos para que el jugador se concentre en el acceso.

El jugador parte con 30 unidades elegibles. El recorrido de Ica suma 65 min en el resto del corredor y 45 min en el acceso final. Las dos cartas son intervenciones excluyentes en ese acceso durante la ventana de la oferta. La reserva del primer año de O&M se muestra aparte del saldo de inversión.

| Elección | Día de efecto | Ruta al día 90 | Saldo tras inversión y reserva de O&M | Decisión |
|---|---:|---:|---|---|
| Reparar el acceso | 40 | 80 min = 65 + 15 | 30 − 25 − 2 = **3** | Ica cumple el umbral y gana frente a 85 min. |
| Reordenar ventanas de carga con el operador | 70 | 95 min = 65 + 30 | 30 − 10 = **20**. La ficha no genera O&M incremental. | La mejora ayuda al corredor, pero la sede queda excluida por superar 90 min. Gana la rival. |
| Esperar | — | 110 min = 65 + 45 | **30** | Ica supera 90 min. Gana la rival. |

**Recorrido del jugador.** Enfocar el corredor en el mapa. Abrir la oferta y localizar el requisito incumplido. Comparar la fecha, el tiempo y el costo de ambas intervenciones. Ejecutar una, avanzar el reloj y leer el motivo de decisión. El comprobante de la empresa distingue los minutos físicos, el límite y la sede elegida.

**Casos de aceptación.** Repetir ambas cartas y la espera con las mismas condiciones. Mover la entrega de la reparación al día 90 y comprobar que entra antes de evaluar la oferta. Moverla al día 91 y comprobar que gana la rival porque Ica sigue en 110 min. Cambiar la rival a 100 min y elegir reordenamiento para comprobar una oferta desierta con el filtro simétrico.

## Revisión pendiente

Confirmar con Antigravity que el traslado conserva el propósito de su tutorial. Incorporar la ficha al tablero de Etapa 1 y marcar la calibración vial y presupuestal como pendientes. La auditoría de Arequipa y las pruebas de O&M mantienen sus propios criterios de cierre. [Contrato v0.1](./08_contrato_game_json_v0_1.md)
