# Etapa 1 · T-102b + T-104: Auditoría de URLs y Matriz de Cobertura `web/data/`

Entrega de **Antigravity (`PC-004`)** para cerrar la Etapa 1 ([tablero](../team/BOARD.md)) y responder los 6 vacíos del [contrato v0.1](./08_contrato_game_json_v0_1.md).

---

## 1. T-102b · Verificación real de URLs oficiales (2026-11-26)

Todas las URLs candidatas de `03` y `06` fueron consultadas el **2026-11-26** y respondieron **`HTTP 200`**:

| Fuente | Estado HTTP | Tipo / Tamaño | Uso en `T-202` vs. primer corte |
|---|---|---|---|
| [MEF Consulta Amigable](https://mef.gob.pe/es/?Itemid=100944) | `200` | `text/html` | Portal web; en `T-202` se extrae exportación CSV/API por pliego/fuente. Primer corte usa **65 u. / 30 u. (`supuesto`)**. |
| [MEF Seguimiento de Proyectos (PNDA)](https://www.datosabiertos.gob.pe/dataset/seguimiento-de-proyectos-de-inversi%C3%B3n/resource/edc1964f-a124-475a-9cf7-dc4d952b30b5) | `200` | `text/html` (ficha PNDA) | Descargar recurso tabular CUI en `T-202`. Primer corte declara cartera heredada `0` (`supuesto`). |
| [SUNASS Benchmarking](https://www.gob.pe/66787-consultar-informacion-sobre-las-empresas-prestadoras-de-servicios-de-saneamiento) | `200` | `text/html` | Continuidad y cobertura de EPS (SEDAPAR, EMAPICA/SEMAPACH) para línea base de hogares. |
| [SUNASS Fiscalización SEDAPAR](https://cdn.www.gob.pe/uploads/document/file/6037987/5346249-segundo-ano-regulatorio.pdf) | `200` | `application/pdf` (2.4 MB) | Referencia regulatoria de localidades SEDAPAR; no es tabla de saldo `l/s` libre. |
| [ANA Plan Quilca–Chili](https://www.gob.pe/institucion/ana/normas-legales/4856491-340-2023-ana) | `200` | `text/html` | Marco de cuenca; el saldo industrial `100 / 82 / 16 l/s` permanece `supuesto` en el primer corte. |
| [MTC Mapas SINAC](https://www.gob.pe/institucion/mtc/informes-publicaciones/6059098-mapas-viales-departamentales-del-sinac-2024-d-s-n-011-2016-mtc) | `200` | `text/html` | Códigos de ruta oficiales; geometría de enlaces del primer corte sale de `infrastructure.json` y tiempos son `supuesto`. |
| [MTC Terminal San Martín](https://portal.mtc.gob.pe/transportes/concesiones/infraestructura_portuaria/portuario_san_martin.html) | `200` | `text/html` | Ubicación oficial Punta Pejerrey / Paracas / Pisco (`ICA`). |
| [SERNANP San Martín PDF](https://compatibilidad.sernanp.gob.pe/consultasernanp/files/582508_1611260747013.pdf) | `200` | `application/pdf` (5.1 MB) | Referencia de empalme PE-1S / PE-28 y superposición de zona de amortiguamiento. |
| [APN PIEP](https://www.gob.pe/54095-consultar-la-plataforma-de-informacion-de-estadisticas-portuarias-piep) | `200` | `text/html` | Movimiento portuario de contexto; capacidad libre de terminal queda `supuesto`. |
| [MIDAGRI El Agro en Cifras](https://www.gob.pe/institucion/midagri/colecciones/388-boletin-estadistico-mensual-el-agro-en-cifras) | `200` | `text/html` | Contexto agrícola para ficha de oferta agroindustrial. |
| [PRODUCE BI Pesca](https://www.gob.pe/institucion/produce/informes-publicaciones/1942650-tablero-bi-pesca) | `200` | `text/html` | Contexto pesquero para etapas posteriores. |
| [MINEM Minería mayo 2026](https://www.gob.pe/institucion/minem/informes-publicaciones/8412377-boletin-estadistico-minero-mayo-2026) | `200` | `text/html` | Contexto minero para etapas posteriores. |
| [MINEM Anuario Electricidad 2024](https://www.gob.pe/institucion/minem/informes-publicaciones/7324144-anuario-estadistico-de-electricidad-2024) | `200` | `text/html` | Complementa `resources.json` para nodos de transmisión en etapas posteriores. |
| [INEI ENAPRES feb-jul 2026](https://www.inei.gob.pe/media/MenuRecursivo/boletines/boletin-seguridad-ciudadana-feb-jul-2026.pdf) | `200` | `application/pdf` (3.4 MB) | Victimización/percepción para la etapa de seguridad. |
| [Defensoría RCS n.º 271](https://www.defensoria.gob.pe/wp-content/uploads/2026/10/RCS_271_setiembre_2026.html) | `200` | `text/html` (2.3 MB) | Antecedente de conflictividad; el incidente del día 105 es `supuesto`. |

---

## 2. T-104 · Matriz de cobertura: Contrato `08` vs. `web/data/*.json`

Valores reales verificados en `web/data/` para los territorios del primer corte:
- **Arequipa (`04`):** `pop = 1,609,000`, `energy = 815 MW` (MINEM: gas 793, solar 22). Provincias: `0401` Arequipa (`24` hexágonos, ciudad celda `8996`, `water_access = 0.908`, `broadband = 0.948`, `poverty = 0.116`, `disasters = 800`) e `0407` Islay (`9` hexágonos, `water_access = 0.955`, `poverty = 0.087`). Puerto `matarani` en celda `9239` (`7.8M` t/año, `county: null`, `state: "ARE"`).
- **Ica (`11`):** `pop = 1,060,000`, `energy = 187 MW` (MINEM: eólica 164, gas 23). Provincias: `1101` Ica (`20` hexágonos, ciudad celda `7826`, `water_access = 0.887`, `broadband = 0.964`) y `1105` Pisco (`11` hexágonos, ciudad/puerto celda `7660`, `water_access = 0.945`). Puerto `pisco` (`3.5M` t/año, `county: null`, `state: "ICA"`).
- **Callao (`07`):** `0` hexágonos en `world.json` (confirmado: `WORLD_CELLS 0701 = 0`, puerto `callao` en celda `6754` sobre malla de Lima). Se aprueba su reemplazo por **Ica–Pisco** (**D-014**).

| Bloque requerido en `08` | Qué entrega hoy `web/data/` (procedencia) | Qué falta y cómo se resuelve en Etapa 2 (`T-202`) |
|---|---|---|
| 1. Fondos por pliego/rubro, compromisos, O&M, CUI | `states.json` solo trae PBI/rendimientos (`supuesto` en `DEP_STATS`). **No hay presupuesto MEF.** | Primer corte usa `65 u.` (Arequipa) y `30 u.` (Ica–Pisco) como `supuesto`. En `T-202` se añaden fuentes MEF (`oficial`). |
| 2. Saldo hídrico (`mL/s`) y capacidad eléctrica (`kW`) | `water_access` es cobertura ENAHO (`derivada`), **no caudal**. `energy` es potencia instalada MINEM (`oficial`), **no saldo libre en subestación**. | Primer corte fija nodo `100/82/16 l/s` (`supuesto`). Desconocido real = `null` en `observations[]`. |
| 3. Conectividad, tiempos (min), sentido, desvíos y terminal | `infrastructure.json` da pares de celdas y geometría (`derivada` Natural Earth), pero **sin tiempos ni sentido**, y `county: null` en puertos. | En `T-202`, `game_data.py` asigna jurisdicción de puerto por UBIGEO (`matarani -> 0407`, `pisco -> 1105`) y los minutos (`205/175/230/265`, `65+45`) se marcan `supuesto`. |
| 4. Competencia, pagador de convenio y restricciones por fuente | `authorities[]` no existe en el Atlas. | Se define explícitamente en `game.json` según marco legal (GORE vs. Municipalidad Provincial, **D-012**). |
| 5. Ofertas, costos por fase, duración, efectos y eventos | No existen en el Atlas (es solo mapa). | Son reglas y parámetros de escenario en `game.json`, todos marcados `supuesto` / `simulación`. |
| 6. Seguridad (ENAPRES) y actas de conflicto (Defensoría) | `disasters.json` trae emergencias INDECI (`oficial`), no ENAPRES ni Defensoría. | Fuera del primer corte; entran en Etapa 4 con fuentes nuevas. |

---

## 3. Verificación cruzada de trazas (`08` y `09`)

- **Arequipa (`08`):** Confirmado el cálculo de sensibilidad O&M: con margen restante `5`, si la municipalidad asume O&M del acceso (`0` regional) la reserva de agua `4` deja **`+1`**; si la región asume `2` adicionales por el acceso, reserva `6` y falta **`-1`** (el motor debe bloquear el compromiso mostrando el faltante antes de aceptar).
- **Ica–Pisco (`09`):** Verificados los **6 desenlaces** con el filtro simétrico (`acceso = true` y `ruta <= 90 min`, rival = `85 min`):
  1. Reparar acceso (día 40, `80 min`, saldo `3`) → **Gana Ica**.
  2. Reparar acceso justo el día límite (`90`) → **Gana Ica** (plazo inclusivo).
  3. Reparar acceso un día tarde (`91`) → **Gana rival** (`110 min > 90`).
  4. Reordenar ventanas (día 70, `95 min`, saldo `20`) → **Gana rival** (`95 > 90`).
  5. Esperar (`110 min`, saldo `30`) → **Gana rival**.
  6. Reordenamiento (`95 min`) con rival en `100 min` → **Oferta desierta**.

**Conclusión de Etapa 1:** Todos los entregables (`T-101`..`T-105`, `T-102b`, `T-104`) están completos. Procede cerrar **T-106** y entregar la orquestación de **Etapa 2** a **Codex (`PC-005` / `T-201`)**.
