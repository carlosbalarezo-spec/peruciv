# Contrato y reglas de Etapa 3A

**PC-008 · T-302 · D-016 y D-017.** Extensión opcional de `schemaVersion: "0.1"` y `rulesVersion: "0.1"`. Las entradas nuevas son declarativas y el motor conserva la lectura de escenarios y partidas base. El dataset publicado sigue siendo v0.1. Las cifras de las pruebas 3A son **Simulación**. [Contrato base](./08_contrato_game_json_v0_1.md) · [Consenso](./14_respuesta_codex_debate_etapa_3.md)

## Inicio, cortes y campaña

- `loadScenario(dataset, id, expected, { today })` acepta `startMode: "current"` en partida libre. El llamador aporta `today` como fecha ISO de Perú al crear la partida. El motor desplaza por el mismo número de días el fin del escenario, los eventos, las ofertas y sus plazos `inspectionBefore` y `fundedBy`. Los cortes, obligaciones heredadas y asignaciones fiscales conservan sus fechas reales. `startMode: "fixed"` o la ausencia del campo conserva el calendario publicado.
- `asOfBySource` mapea cada ID de fuente a su fecha ISO de corte. Los registros fiscales y topes CIPRL referencian ese ID mediante `sourceId`. La UI puede calcular la antigüedad de cada corte y presentar el inicio libre como **Simulación**. Un corte de otro ejercicio requiere un insumo explícito del ejercicio vigente.
- `createState(scenario, { emphasis })` guarda `campaign.emphasis` y las prioridades que representan compromisos de campaña. `services`, `investment` y `dialogue` priorizan el objetivo homónimo. `balanced` incluye los tres y es el valor por defecto. El énfasis deja iguales las cuentas y reglas de admisibilidad.
- `save` conserva `startDate`, `asOf`, campaña y asignaciones. Para reanudar, reconstruir el escenario con la versión guardada y pasar su `startDate` como `today` en modo libre. `load` y `step` verifican la coincidencia de la fecha inicial cuando figura en la partida. Para reproducir desde cero, `replay` acepta las opciones iniciales de `createState` en su cuarto argumento.

## Acta fiscal y ajuste del Día 1

`inherited.year` coincide con el año del inicio. En `inherited.funds[]`, cada fila usa como `id` el fondo del escenario, que aporta actor y rubro. Incluye `sourceId`, `pia`, `pim`, `compromiso`, `devengado` y `available`. La disponibilidad acreditada cumple `available ≤ pim − compromiso` y `devengado ≤ compromiso ≤ pim`. El fondo utiliza `available` como saldo inicial. El devengado ya forma parte del compromiso. Para un fondo con disponibilidad desconocida, proveer cero como margen ejecutable acreditado. Los fondos sin fila heredada provienen del presupuesto base de simulación. [Consulta Amigable del MEF](https://mef.gob.pe/es/?Itemid=100944)

`inherited.portfolio[]` identifica cada obra mediante `cui` único, con `sourceId`, `status: "in_progress"`, `progressPermille` de 0 a 1000 y `pending` en céntimos. El saldo pendiente se conserva para diagnóstico y continuidad. Su financiamiento se refleja en la fila fiscal y sus reservas explícitas. El acta es una instantánea y el registro operativo de obligaciones evoluciona por separado.

`inherited.obligations[]` incorpora O&M con `workId`, `fundId`, `startDate`, `amount`, `includedInCommitment` y, cuando corresponda, `dueYear` y `reserved`. Una obligación incluida en el compromiso del ejercicio lleva ese `dueYear` y reserva cero porque ya está descontada de la disponibilidad. Una reserva adicional resta del margen una sola vez. En la apertura fiscal, la obligación usa su reserva y el crédito aplicable una sola vez si tiene `dueYear`. Si falta margen, sigue pendiente. Las obligaciones sin `dueYear` se evalúan anualmente.

En la apertura, `annualBudgets[year][fundId]` añade únicamente crédito aprobado para fondos heredados. La proyección o propuesta del ejercicio siguiente queda fuera de ese mapa. Los fondos heredados conservan el saldo protegido hasta el importe de las reservas. Para arrastrar también saldo libre, el fondo debe declarar `carryForward: true` según su fuente. Las obligaciones ya comprometidas e impagas pueden consumir crédito del nuevo ejercicio en esta simulación. Un inicio el 1 de enero usa directamente la herencia de su ejercicio. Los efectos anuales del contrato base siguen disponibles y cada crédito debe declararse una sola vez.

`allocateDayOne` recibe `{ actionId, fundId, amount }`. La orden asigna parte del margen vigente a un destino del catálogo `budgetActions[]`, reduce el saldo disponible y registra `allocations` sin producir devengado. `step(state, orders, scenario, { dayOneOnly: true })` resuelve ese tipo de orden sin avanzar el calendario. Una vez transcurrido el día inicial, responde `DAY_ONE_CLOSED`.

| Condición del catálogo | Resultado |
|---|---|
| El rubro o fondo elegido queda fuera de `eligibleRubrics` o de la lista opcional `eligibleFundIds` | `FUND_INELIGIBLE`, por ejemplo un fondo Canon para planilla corriente |
| El actor difiere de `actorId` o la acción declara `authorizationMissing: true` | `ACTOR_NOT_COMPETENT`, por ejemplo actividad empresarial sin habilitación del art. 60 o aprobación regional de una exoneración nacional |
| La disponibilidad es menor que el importe | `INSUFFICIENT_FUNDS`, con margen e importe requerido |

El catálogo aporta `legalBasis` para el mensaje del Comité. Su elegibilidad debe calibrarse por actividad, norma y vigencia, incluidas las excepciones aplicables. [Ley 27506](https://www.leyes.congreso.gob.pe/Documentos/Leyes/27506.pdf) · [Constitución Política del Perú](https://www.congreso.gob.pe/constitucionyreglamento/)

## Convenios y calendario de Arequipa

`signAgreement` exige autoridad, contraparte y fondos elegibles. Los hitos acreditados mediante el calendario del convenio aplican sus efectos al completarse. Los vencimientos de obras y convenios ya iniciados se resuelven antes de recibir órdenes del día. Después de las órdenes se resuelven sus hitos inmediatos, y luego las ofertas.

En la configuración 3A, `aqp-water-work` declara `requiresAgreementWhenSigned: "aqp-fast-access"` y `requiresAccessSiteId: "site-aqp-local"`. La primera regla activa la dependencia si se firma ese convenio antes de iniciar la obra. Para una ruta que deba exigir el convenio desde el inicio, usar `requiresAgreement`. La ruta de agua primero sigue disponible sin convenio prioritario.

En la traza fija de **Simulación** se firma el día 0. El acceso y la inspección se acreditan el día 30 (31 de enero), cuando puede comenzar la obra de 95 días. Al decidir la oferta el día 120, el agua sigue en obra con entrega financiada el día 125 (6 de mayo). La oferta reducida gana con 205 min de ruta y 10 min de ajuste de escala. Con el desvío de 265 min, se excluye la oferta local. El recorrido de agua primero mantiene la entrega del día 95. [Traza de diseño](./04_traza_arequipa.md)

## OxI y CIPRL

`ciprl.limits[]` contiene `id`, `actorId`, `sourceId`, `ceiling` y `prior` por tope aplicable. En `oxiProjects[]`, cada proyecto refiere un `limitId`, la autoridad `actorId`, los importes `tranches` por año y la obra `workId` que acredita entrega. Todos los montos usan céntimos enteros seguros. Las órdenes operan sobre `payload.projectId`.

| Orden | Requisito y efecto |
|---|---|
| `reserveOxi` | La suma plurianual cabe en `free`. Reduce el margen y registra el monto reservado por año en `schedule`. |
| `commitOxi` | Existe una reserva previa. Representa la firma y conserva la reserva completa. |
| `issueCiprl` | El proyecto está comprometido y su obra entregada. Mueve la reserva a `issued` sin restituir margen. |
| `cancelOxi` antes de firma | Devuelve el total al margen y libera sus tramos. |
| `cancelOxi` después de firma | Pasa a `cancelled_pending_settlement` y mantiene la reserva. Una emisión completada impide la cancelación. |

El margen cumple `free = ceiling − prior − reserved − issued`. El calendario de tramos incluye reservas, compromisos y emisiones vigentes. La reserva se mantiene al cambiar de año. 3A simula la emisión total contra entrega y conserva íntegro el compromiso pendiente de liquidación. El cálculo oficial del tope, la emisión parcial y la liquidación requieren datos y reglas adicionales. [ProInversión, reglamento de Obras por Impuestos](https://www.gob.pe/institucion/proinversion/noticias/1366043-nuevo-reglamento-de-obras-por-impuestos-promueve-mas-inversiones-y-fortalece-la-ejecucion-de-las-intervenciones-en-todo-el-pais)
