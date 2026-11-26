# Propuesta de Producto · Inicio de Partida, Flashback y Día 1 en el Cargo

**Origen:** Directriz del usuario (`2026-11-26`) al probar la beta en GitHub Pages (`https://carlosbalarezo-spec.github.io/peruciv/`).
**Objetivo:** Transformar la entrada a **🎮 Gobernar** de un selector técnico de 2 escenarios de prueba a una **experiencia completa de Gobernador(a) Regional**, manteniendo el rigor institucional y los datos reales del Perú.

---

## 1. Flujo de Inicio de Partida (Onboarding)

1. **Identidad y Elección de Región:**
   - Campo para el **nombre del jugador** (ej. *"Gobernador(a) [Nombre]"*).
   - Desplegable / selector de las **25 regiones del Perú**, agrupadas por **Nivel de dificultad (1 al 5)** calculado con datos reales (infraestructura operativa, margen fiscal libre, recursos, brechas y riesgo).
   - *(En el corte actual de Etapa 2–3, las regiones sin ficha completa aún pueden mostrar su diagnóstico real del Atlas y un aviso claro de "Escenario en calibración", mientras Arequipa e Ica–Pisco están 100% activos).*
2. **Secuencia "Flashback" de Campaña y Proclamación (~2–3 segundos, saltable):**
   - Breve viñeta animada en Canvas/UI (4 cuadros rápidos):
     1. *Mítines y recorrido territorial* (bases regionales).
     2. *Reuniones técnicas y plan de gobierno*.
     3. *Jornada electoral*.
     4. *Proclamación y entrega de credenciales (JNE/JEE) → Toma de mando*.
3. **Fecha de Inicio = Fecha Calendario Actual ("What-If" desde hoy):**
   - La partida arranca en la **fecha corriente** (`YYYY-MM-DD`, ej. `2026-11-26`), con las cuentas públicas, proyectos en curso y brechas regionales heredadas **al corte real más reciente** (`MEF Consulta Amigable / Invierte.pe`, `ENAHO 2025`, `SUNASS`, `INDECI`).
   - De este modo, cada partida simula un **"futuro posible" desde el presente** durante un mandato de 4 años.

---

## 2. Día 1 en el Cargo: Entrega de Cargo y Comité de Asesores

Antes de avanzar el reloj, el nuevo Gobernador se reúne con su **Comité de Asesores** para revisar la herencia recibida:

1. **Acta de Transferencia (Cuentas que dejó la gestión saliente):**
   - **Presupuesto del año en curso:** `PIA`, `PIM`, `Comprometido`, `Devengado` y **Margen Libre Real** por fuente (`RO`, `FONCOR`, `Canon/Regalías`, `RDR`).
   - **Cartera heredada:** obras en ejecución recibidas (CUI, avance, costo pendiente y `O&M` comprometido).
   - **Estado de la región al día de hoy:** brechas de agua/energía/conectividad, seguridad ciudadana y conflictos sociales activos/latentes.
2. **Primera Decisión: Asignación Inicial del Presupuesto:**
   - El jugador distribuye su **margen libre disponible** entre prioridades (ej. continuidad de obras heredadas, cierre de brechas básicas, mantenimiento `O&M`, seguridad preventiva o habilitación productiva), asesorado por los ministros/gerentes de *Economía*, *Infraestructura*, *Prosperidad* y *Peligros*.
3. **Propósito Cívico del Juego (Competencias Reales):**
   - Mostrar con claridad y neutralidad institucional **qué depende directamente del Gobierno Regional** (ejecución limpia del PIM, priorización de `Invierte.pe`, convenios municipales, TUPA/suelo, prevención y diálogo), **qué requiere coordinación con el Gobierno Nacional / Congreso** (transferencias, megaproyectos, leyes en Diputados/Senado) y **qué corresponde al sector privado** (inversión productiva y empleo formal).

---

## 3. Impacto Técnico para Coordinar con Codex (Etapa 3+)

1. **Motor (`web/js/ext/game/engine/`):**
   - Soportar `startDate` dinámico (fecha corriente del cliente o fecha de corte del escenario) y estado inicial con `obligations[]` y `projects` heredados en ejecución (`in_progress`) al momento de asumir el cargo.
   - Incorporar una acción inicial de **asignación presupuestal por partida/rubro** al Día 1 antes de abrir la simulación continua.
2. **Datos (`pipeline/build/game_data.py`):**
   - Avanzar en **T-202b** (extracción real de MEF Consulta Amigable + Seguimiento de Proyectos por departamento) para poblar la herencia real de las **25 regiones** (empezando por Arequipa e Ica).
3. **Interfaz (`web/js/ext/game/ui/`):**
   - Nuevo módulo ligero `onboarding.js` (nombre + selector de región por nivel + flashback animatic Canvas/CSS + pantalla de *Entrega de Cargo / Comité de Asesores* en Día 1).
