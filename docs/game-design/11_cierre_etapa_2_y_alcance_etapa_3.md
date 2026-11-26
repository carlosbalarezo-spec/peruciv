# Cierre técnico de Etapa 2 y propuesta de Etapa 3

**PC-006 · T-204 · En revisión por Antigravity.** La rama de trabajo partió de `b4f9e30`, revisión compartida por `main` y `origin/main` locales. La entrega reúne el motor determinista (PR #6), el dataset v0.1 (PR #7), el modo Gobernar y las 12 hidroeléctricas (PR #8) y las ilustraciones de las 31 maravillas (PR #9). La prueba extremo a extremo cubre la lectura del dataset y la resolución de partidas mediante el motor. La revisión visual en navegador queda pendiente.

| Comando desde la raíz | Resultado |
|---|---|
| `python scripts/team/check_encoding.py` | 0 coincidencias de mojibake |
| `python -m pipeline check` | 31 correctos, 0 advertencias, 0 fallos. Incluye dos escenarios v0.1 y nueve observaciones con procedencia. |
| `python -m unittest discover -s tests -v` | 5 pruebas correctas |
| `node --test web/js/ext/game/engine/engine.test.js` | Archivo correcto, 19 casos |
| `node --test web/js/ext/game/engine/game-data.test.js` | Archivo correcto, 12 casos |

## Trazas de integración

La prueba carga [game.json](../../web/data/game.json) con la API pública del motor y comprueba aceptación de órdenes, resultados de ofertas y objetivos al sellar cada partida. Las cifras de las trazas son **Simulación**. El cierre vial, los cambios de fecha de entrega y el cambio de tiempo rival se aplican a copias en memoria. [Prueba reproducible](../../web/js/ext/game/engine/game-data.test.js)

**Arequipa–Matarani.** La oferta se decide el 1 de mayo. La ronda interrumpida cierra la vía principal del 16 de abril al 16 de mayo, con reapertura ese día. Los minutos de la tabla corresponden a la ruta local.

| Estrategia | Corredor abierto | Corredor interrumpido |
|---|---|---|
| Agua primero | Arequipa, escala completa, 205 min | Rival, ruta local de 265 min supera el límite de 240 |
| Corredor primero | Rival, agua local insuficiente pese a la ruta de 175 min | Rival, agua local insuficiente con desvío de 230 min |
| Instalación por etapas | Arequipa, escala completa, 205 min | Rival, ruta local de 265 min supera el límite de 240 |

En la estrategia por etapas se firma el convenio el 1 de enero, se inicia el agua el 11 de enero y se inspecciona el 1 de febrero. El convenio habilita el acceso el 31 de enero y el dataset conserva además la habilitación ordinaria del 21 de abril. Con los 95 días de obra publicados, el agua se entrega el 16 de abril. El escenario de diseño prevé la entrega el 6 de mayo (día 125) y una victoria a escala reducida con 215 minutos de puntuación. Antigravity debe revisar cuál de los dos calendarios se adopta en el siguiente cambio de contrato. [Traza de diseño](./04_traza_arequipa.md) · [Prueba unitaria de la escala reducida](../../web/js/ext/game/engine/engine.test.js)

**Ica–Pisco.** La oferta se decide el 1 de abril (día 90). El límite de 90 minutos se aplica a ambas sedes. Las cifras de la última columna son el margen luego de descontar órdenes y O&M reservados, expresado en céntimos de simulación.

| Caso | Ruta local | Ruta rival | Decisión | Margen |
|---|---:|---:|---|---:|
| Reparar | 80 min | 85 min | Ica | 300 |
| Reordenar | 95 min | 85 min | Rival | 2 000 |
| Esperar | 110 min | 85 min | Rival | 3 000 |
| Reparación entregada el día 90 | 80 min | 85 min | Ica | 300 |
| Reparación entregada el día 91 | 110 min | 85 min | Rival | 300 |
| Reordenar con rival a 100 min | 95 min | 100 min | Desierta | 2 000 |

## Alcance propuesto para Etapa 3

Usar Arequipa como escenario de integración y conservar Ica–Pisco como tutorial de acceso y plazos. Antes de implementar cada instrumento, acordar sus autoridades, evidencias, efectos presupuestales y reglas de transición en el contrato de datos. Fichar las normas y documentos oficiales con fecha de vigencia. Rotular como **Simulación** los pronósticos y parámetros sin calibración oficial. [Plan de diseño](./02_opinion_antigravity_y_plan_v2.md)

| Instrumento | Entrega y criterio de aceptación |
|---|---|
| Convenios intergubernamentales | Modelar al menos un convenio a partir de un instrumento documentado. Identificar competencia, contraparte, acreditación, obligaciones, financiamiento y O&M. Probar rechazo por incompetencia y habilitación del acceso al cumplir los hitos. |
| Obras por Impuestos (OxI) y CIPRL | Mostrar tope aplicable, margen libre, compromisos y emisión del certificado según los hitos y reglas vigentes. Probar dos proyectos que compiten por el mismo margen y el efecto de una cancelación según el estado del compromiso. [ProInversión](https://www.gob.pe/institucion/proinversion/noticias/1366043-nuevo-reglamento-de-obras-por-impuestos-promueve-mas-inversiones-y-fortalece-la-ejecucion-de-las-intervenciones-en-todo-el-pais) |
| Suelo industrial y ZEEP | Modelar por separado la habilitación física y los servicios del predio, y la solicitud de régimen con su autoridad, requisitos, actividades y vigencia. Probar que un predio habilitado puede operar bajo las reglas ordinarias y que los efectos ZEEP empiezan al acreditarse el régimen. [MINCETUR](https://www.gob.pe/institucion/mincetur/normas-legales/8078649-005-2026-mincetur) |
| Iniciativa legislativa bicameral | Seguir el expediente por Diputados, Senado y Ejecutivo, con informe previo del MEF cuando corresponda. Mostrar plazo normativo y fecha estimada simulada por separado. Probar modificación o archivo y una ley aprobada cuya vigencia llega después de la decisión de inversión. [Ley 31988](https://www.leyes.congreso.gob.pe/Documentos/2021_2026/ADLP/Texto_Consolidado/31988-TXM.pdf) |

Antigravity revisará la discrepancia de calendario en Arequipa, el recorrido en navegador de Gobernar y la prioridad y cobertura de fuentes de las cuatro fichas institucionales antes de cerrar T-204.
