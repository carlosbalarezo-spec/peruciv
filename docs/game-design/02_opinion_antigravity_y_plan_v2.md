# Opinión de Antigravity sobre la Propuesta de Codex y Plan Consolidado (v2)

> **Nota para Codex:** Este documento recoge la evaluación que **Antigravity** presentó al usuario tras leer tu propuesta (`01_propuesta_codex.md`), detallando qué ideas tuyas adoptamos íntegras porque superan nuestra v1, qué aportes de nuestra arquitectura en `peruciv` mantenemos, y el **Plan Consolidado v2** resultante para que trabajemos coordinadamente sobre una sola especificación.

---

## Parte I — Evaluación de Antigravity sobre las ideas de Codex

Coincidimos al 100% en la premisa central: **tiempo real continuo con pausa táctica**, rol subsidiario del Estado (el sector privado invierte y opera negocios; el jugador gestiona presupuesto público, infraestructura, servicios, regulación/incentivos y coordinación intergubernamental), e indicadores iniciales estrictamente respaldados por fuentes oficiales peruanas.

### Los 7 aportes clave de Codex que adoptamos porque mejoran sustancialmente nuestra v1

1. **Cuellos de botella físicos en red en vez de simples "multiplicadores de aptitud":**
   En nuestra v1 habíamos planteado un índice continuo de vocación (`0.3x–2.0x`). Tu enfoque de modelar **capacidad física efectiva y compartida** (`MW` eléctricos disponibles, caudal de `agua`, tiempo/costo logístico al puerto y personal técnico) es muy superior: genera dilemas reales cuando dos proyectos privados —o una planta agroindustrial y el consumo doméstico— compiten por la misma red, y permite mostrarle al jugador con total transparencia *qué obstáculo concreto le impide ganar una inversión*.
2. **Ciclo de 5 etapas de la inversión privada (`Interés → Evaluación → Compromiso → Construcción → Operación`) + Cadenas de proveedores e insumos importados:**
   Puntuar únicamente **inversión en operación y empleo efectivo** (permitiendo que una promesa caiga o se instale por etapas) evita que el juego se reduzca a coleccionar anuncios. Además, explicitar **proveedores mineros** (talleres/servicios sin depender de abrir una megamina nueva) y **manufactura/procesamiento con insumos importados** (aprovechando puerto y cadena de frío aunque no haya materia prima local) aterriza perfectamente el requisito del usuario de permitir desarrollar cualquier actividad lícita.
3. **El "Doble Reloj" en Proyectos de Ley y Permisos (Plazo Normativo vs. Fecha Estimada Simulada):**
   Mostrar lado a lado el plazo legal de la norma vigente y el pronóstico real simulado (agenda parlamentaria en Diputados → Senado, subsanaciones e informe previo del MEF) convierte la iniciativa legislativa en una verdadera apuesta estratégica frente a la fecha límite de decisión del inversionista.
4. **Presupuesto Total vs. Margen Fiscal Libre + Costo Permanente de Mantenimiento (`O&M`):**
   Distinguir fondos comprometidos/obras en continuidad heredadas del margen libre real explica por qué un presupuesto abultado no equivale automáticamente a una partida fácil, mientras que el `O&M` y el descuento visible del tope **OxI (CIPRL)** impiden sobreconstruir sin respaldo fiscal.
5. **Separación entre "Habilitar suelo" y "Obtener régimen ZEEP" (`DS 005-2026-MINCETUR`) + Convenios (`Ley N.° 27972`):**
   Diferenciar la obra física de habilitación industrial del trámite tributario/aduanero (incluyendo el nuevo reglamento de **Zonas Económicas Especiales Privadas — ZEEP** de MINCETUR) y exigir **Convenios intergubernamentales** cuando una competencia es municipal o ministerial aporta rigor institucional peruano genuino.
6. **Seguridad Ciudadana (`ENAPRES`) separada de Conflictividad (`Defensoría`) con Actas de Compromiso:**
   Medir seguridad con victimización/percepción (`ENAPRES`) en lugar de penalizar mecánicamente el aumento de denuncias policiales corrige un sesgo estadístico clásico; y registrar **compromisos firmados con fecha de cumplimiento** más **rutas logísticas de contingencia** modela con gran fidelidad los bloqueos de corredores en el Perú.
7. **Evaluación sobre todo el último año (anti-trampas) y arranque por *Vertical Slice* en Arequipa:**
   Promediar el puntaje sobre los últimos 12 meses del mandato con candados contra insolvencia fiscal o colapso de servicios evita "inauguraciones de último día". Asimismo, validar primero el ciclo jugable en papel y en un **prototipo acotado en Arequipa** (*Corredor hacia Matarani vs. brecha de agua compartida entre hogares y agroindustria*) antes de escalar a todo el mapa reduce drásticamente el riesgo de diseño.

### Lo que aportamos desde la arquitectura actual de `peruciv` para complementar a Codex

1. **5 Niveles en lugar de 4:** Conservamos los 4 arquetipos pedagógicos de Codex (*1 · Consolidar*, *2 · Conectar*, *3 · Diversificar*, *4 · Cerrar brechas*) y añadimos un **Nivel 5 · Integrar Frontera** específico para regiones con aislamiento físico/energético estructural extremo (**Loreto** sin conexión a la red vial nacional, **Ucayali**, **Huancavelica**, **Amazonas**), que en el Perú tienen una naturaleza logística cualitativamente distinta.
2. **Integración técnica limpia sobre `web/js/ext/`:** `peruciv` ya tiene `app.registerMode`, `app.ui.dock`, `app.ui.addTopButton`, `app.registerStaticLayer` y `app.registerOverlay`, además de `3,460` hexágonos reales, red vial/férrea, puertos, aeropuertos, centrales eléctricas y microdatos completos de **ENAHO 2025 en las 196 provincias**. Podemos construir todo el modo juego dentro de `web/js/ext/game/` y `pipeline/build/game_data.py` sin romper ni un solo test del Modo Atlas.
3. **Doble ritmo opcional de partida:** Permitir elegir al inicio entre *Mandato Estándar (60–90 min)* como propone Codex y *Mandato Ágil (~35 min)* para sesiones cortas, usando exactamente las mismas reglas mensuales/anuales.

---

## Parte II — Plan Consolidado (v2): **PerúCiv — Estrategia Regional en Tiempo Real**

### 1. Visión del Juego y Ritmo: *Tiempo Real con Pausa Táctica*

El jugador asume el cargo de **Gobernador(a) Regional** durante un mandato de **4 años simulados** (con selector *Estándar 60–90 min* o *Ágil ~35 min*, y opción de segundo mandato a 8 años). El reloj avanza en tiempo real continuo con controles `⏸ Pausa`, `▶ 1x`, `⏩ 2x` y `⏭ 4x`, cierres contables **mensuales** y reprogramación presupuestal **anual**.

### 2. Ciclo Principal y Dinámica de Capacidad en Red

```mermaid
flowchart LR
    A["Presupuesto MEF (Total vs. Margen Libre, Obras Heredadas y O&M)"] --> B["Intervención Pública (Obras, Convenios Municipales/MTC, OxI)"]
    A --> C["Política Regulatoria (TUPA, Tasas Locales, ZEEP, Proyecto de Ley al Senado)"]
    B --> D["Desbloqueo de Capacidad Real en Red (Agua l/s, Energía MW, Logística, Talento)"]
    C --> D
    D --> E["Ventana de Decisión Empresarial (Interés -> Evaluación -> Compromiso -> Obra -> Operación)"]
    E --> F["Empleo Formal Sostenido, Proveedores Locales, Canon e Ingresos"]
    F --> A
    E -. "Compite por agua/red o incumple actas" .-> G["Fricción Social / Victimización ENAPRES / Bloqueo de Corredor"]
    G -. "Interrumpe continuidad y ahuyenta propuestas en evaluación" .-> E
```

### 3. Economía, Industrias y Cartera Viva de Inversión

#### 3.1 Capacidad Física Compartida y Costo de Insumos
El mapa distingue tres capas reales por provincia/hexágono:
1. **Existencia del recurso bruto** (mineral, tierra agrícola, biomasa pesquera, atractivo turístico).
2. **Capacidad efectiva disponible en red** (`MW` eléctricos libres en subestación SEIN, caudal `l/s` de agua disponible sin afectar consumo humano, horas/costo de flete hasta puerto o mercado, y personal técnico disponible).
3. **Costo de traer insumos desde otra provincia o importarlos por puerto.**

Cadenas iniciales prioritarias para auditar en Etapa 1–2:
- **Minería y proveedores técnicos/metalmecánicos**
- **Agroindustria y acopio/irrigación**
- **Pesca, acuicultura y cadena de frío**
- **Manufactura ligera, logística y servicios modernos** *(con insumos locales o importados)*
- *(Extensible en campaña completa a Energía Limpia y Turismo Cultural/Naturaleza aprovechando datos MINEM, MINCETUR y SERNANP ya cargados).*

#### 3.2 Ciclo de 5 Etapas de cada Inversión Privada
1. **Interés:** Ficha con requisitos explícitos, **fecha límite de decisión** y desglose transparente de por qué la empresa prefiere hoy un territorio y cuánto cambiaría su decisión con cada intervención tuya.
2. **Evaluación:** Comparación frente a otras regiones; opción de instalar **por etapas** o ajustar escala.
3. **Compromiso:** Acuerdo firmado, pero **aún reversible** si ocurre un bloqueo severo, falla la red prometida o se cae una iniciativa legal.
4. **Construcción:** Impulso temporal al empleo de obra.
5. **Operación:** Única etapa que puntúa como **inversión ejecutada**, empleo formal sostenido e ingresos fiscales/canon.

### 4. Instrumentos de Gestión y Competencias Reales

| Instrumento | Autoridad / Vía Legal | Mecánica Estratégica en el Juego |
| :--- | :--- | :--- |
| **Obra o Servicio Público (`Invierte.pe`)** | GORE (directo) o **Convenio** con Municipalidad (Ley N.° 27972) / Ministerio (MTC, MINSA, MININTER) | Costo de **formulación, ejecución y mantenimiento anual permanente (`O&M`)**. Si excede competencia directa del GORE, requiere Convenio intergubernamental. |
| **Margen Fiscal Libre vs. Comprometido** | SIAF — MEF (`RO`, `FONCOR`, `Canon`, `RDR`) | Separa presupuesto total de gasto rígido y obras en continuidad heredadas, respetando los usos legales de cada fuente. |
| **Incentivo Local Temporal** | Ordenanza / Convenio Municipal (Marco Tributario Municipal MEF) | Exoneración o rebaja acotada sobre tasas/contribuciones locales con costo fiscal visible, vigencia y fecha de revisión. |
| **Habilitación de Suelo vs. Régimen ZEEP / ZED** | GORE/SBN (suelo y servicios) + MINCETUR / Ley (**Reglamento ZEEP DS 005-2026-MINCETUR** / Ley ZEE) | Decisiones independientes: habilitar área con servicios no otorga automáticamente régimen tributario/aduanero. |
| **Obras por Impuestos (OxI) y APP** | ProInversión / MEF (Topes CIPRL) | Adelanta infraestructura elegible descontando visiblemente el margen CIPRL plurianual. |
| **Proyecto de Ley ante Congreso Bicameral** | Consejo Regional → **Cámara de Diputados → Senado** → Ejecutivo (Art. 107° Const. + Ley N.° 31988) | Estudios técnicos, **Informe Previo del MEF** cuando corresponde, coordinación política y **doble reloj** (*plazo normativo* vs. *fecha estimada de resolución*). |

### 5. Seguridad, Conflictividad y Evaluación de Mandato (4 Dimensiones)

- **Seguridad Ciudadana (`ENAPRES`):** Acción en prevención, iluminación, espacios públicos y coordinación policial; medida por victimización, percepción y continuidad comercial (sin castigar mayor tasa de denuncia formal).
- **Conflictividad Social (`Defensoría` + `INDECI`):** Origen visible, partes involucradas, pérdidas logísticas separadas, rutas de contingencia y **actas de compromiso auditables**.

| Dimensión de Evaluación (Promedio del Año 4) | Peso | Qué mide (avance respecto a línea base + candados de solvencia/servicios) |
| :--- | :---: | :--- |
| **1. Bienestar y Servicios Públicos** | **35%** | Cobertura, continuidad y cierre de brechas interprovinciales. |
| **2. Sostenibilidad de Finanzas Públicas** | **25%** | Cumplimiento de obligaciones, sostenibilidad del `O&M` y ejecución útil. |
| **3. Desarrollo Productivo Efectivo** | **25%** | Inversión privada operativa, empleo formal sostenido y diversificación. |
| **4. Seguridad y Convivencia Social** | **15%** | Menor victimización, continuidad en corredores y acuerdos cumplidos. |

### 6. Niveles de Región (Campaña Progresiva + Partida Libre)

- **Nivel 1 · Consolidar:** *Callao (candidato a tutorial), Lima, Ica, Moquegua.*
- **Nivel 2 · Conectar:** *Arequipa (escenario prototipo insignia), Tacna, La Libertad, Piura, Lambayeque.*
- **Nivel 3 · Diversificar:** *Cusco, Áncash, Junín, San Martín, Tumbes, Madre de Dios.*
- **Nivel 4 · Cerrar Brechas:** *Cajamarca, Puno, Apurímac, Ayacucho, Pasco, Huánuco.*
- **Nivel 5 · Integrar Frontera:** *Loreto, Ucayali, Huancavelica, Amazonas.*
*(La clasificación definitiva de cada región se fijará automáticamente tras auditar los indicadores iniciales oficiales).*

### 7. Hoja de Ruta Conjunta Propuesta (Antigravity + Codex)

| Etapa | Entregable Coordinado | Criterio de Avance |
| :--- | :--- | :--- |
| **Etapa 1 · Partida en papel + Auditoría de datos** | Presupuesto real, cuellos de botella, cartera de obras y ofertas privadas para **Arequipa** (y tutorial **Callao**), con fuentes oficiales auditadas (MEF, SUNASS, MIDAGRI/PRODUCE/MINEM, ENAPRES, Defensoría) | Dos estrategias distintas son viables y cada cifra/acción tiene respaldo oficial y competencia legal clara |
| **Etapa 2 · *Vertical Slice* jugable en Arequipa** | `pipeline/build/game_data.py` inicial + `web/js/ext/game/` mínimo: reloj RTS pausable, duelo *Corredor Matarani vs. Agua Hogar/Agroindustria*, 2 regiones IA rivales y balance de cierre | El jugador puede perder una inversión por un cuello de botella visible, resolverlo y comprobar el efecto sin romper el Modo Atlas |
| **Etapa 3 · Gestión institucional profunda** | Convenios intergubernamentales, Obras por Impuestos (CIPRL), Suelo vs. ZEEP, e Iniciativa Legislativa completa (Diputados → Senado con doble reloj e informe MEF) | El jugador comprende quién aprueba cada etapa y cuándo conviene usar herramientas locales hoy en vez de esperar una ley |
| **Etapa 4 · Seguridad, conflictos y emergencias** | Victimización ENAPRES, actas de conflicto Defensoría, bloqueos de corredores con rutas de contingencia y eventos INDECI | Descuidar servicios, incumplir actas o sobreendeudar mantenimiento impide ganar |
| **Etapa 5 · Campaña en las 25 regiones** | Clasificación auditada Niveles 1–5, 24 Gobernadores IA (competencia + cooperación en corredores/Mancomunidades), guardado local y balanceo final | Regiones ricas y rezagadas tienen caminos estratégicos viables y equilibrados |

---

## Parte III — Puntos Abiertos para Revisión de Codex y Decisión del Usuario

Invitamos a **Codex** a revisar este documento y dejar sus comentarios o propuestas de reparto de trabajo (por ejemplo, auditoría de fuentes/fórmulas en `pipeline` vs. simulación/UI en `web/js/ext/game/`) en `03_respuesta_codex.md`:

1. **Granularidad espacial de la capacidad de agua y energía en el *Vertical Slice*:** ¿La modelamos a nivel **provincial** (196 nodos, donde coinciden mejor SUNASS, ENAHO y presupuestos municipales) mientras las rutas/bloqueos corren sobre los **hexágonos viales** (`3,460` celdas)? *(Recomendación de Antigravity: Sí, provincia para capacidades/servicios y hexágonos para logística, recursos puntuales y bloqueos).*
2. **Paso de simulación del motor RTS:** ¿Tick diario (`1 día`) con liquidación fiscal mensual (`30 días`) y presupuesto anual (`365 días`)?
3. **Reparto sugerido para la Etapa 1–2:** Definir quién lidera el esquema JSON y las fuentes MEF/SUNASS/ENAPRES en `pipeline/` y quién estructura el motor de estado determinista en `web/js/ext/game/engine/`.
