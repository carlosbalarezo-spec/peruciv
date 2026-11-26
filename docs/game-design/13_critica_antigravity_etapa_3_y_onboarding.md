# Crítica de Antigravity · Alcance de Etapa 3, Onboarding y Educación Cívica

**Para revisión y contraste con Codex (`PC-007` / `T-300`).** Sin código todavía. Evaluamos [`11_cierre_etapa_2_y_alcance_etapa_3.md`](./11_cierre_etapa_2_y_alcance_etapa_3.md) y [`12_propuesta_onboarding_y_dia_1_usuario.md`](./12_propuesta_onboarding_y_dia_1_usuario.md) bajo las directrices del usuario: simulación de **educación cívica**, **agnóstica a colores políticos**, abierta a **todo el espectro de políticas lícitas**, con **asesores como guardarraíles constitucionales/legales** y sin mecánica de corrupción en esta fase.

---

## 1. ¿El alcance es adecuado? Lo que SÍ y lo que "cojea"

### Lo que está bien dimensionado
- Mantener **Arequipa** como escenario de profundidad institucional y **Ica–Pisco** como tutorial corto evita multiplicar por 25 una deuda de datos antes de probar las mecánicas nuevas.
- La regla de **asesores como guardarraíles legales** encaja perfecto con nuestro modelo de competencias (`ACTOR_NOT_COMPETENT`, `FUND_INELIGIBLE`, informe previo MEF, Ley 27972).

### 4 puntos donde el plan actual "cojea" si los implementamos tal cual

1. **Riesgo de "Fecha corriente" vs. Cortes oficiales reales (Año fiscal):**
   - Si la partida siempre arranca en `hoy` (ej. `26 de noviembre de 2026`), al año fiscal solo le quedan **35 días** antes del cierre del 31 de diciembre y de la apertura del ejercicio 2027. En la vida real, en noviembre el PIM ya está casi cerrado y devengado en gran parte.
   - **Propuesta de ajuste:** Mostrar en el Día 1 el **corte real vigente** (noviembre 2026: saldo de cierre del ejercicio actual + *Proyecto de Presupuesto / PIA 2027* por asignar) para que el jugador decida tanto la **reprogramación de cierre de año** como la **priorización del año fiscal completo siguiente**, en vez de quedar atrapado con 35 días sin margen.
2. **Las 25 regiones en el desplegable sin datos MEF/SUNASS auditados aún:**
   - Si ponemos las 25 regiones en el desplegable hoy, 23 de ellas no tienen aún presupuesto MEF extraído ni ofertas calibradas. Si dejamos jugar las 23 con números inventados, rompemos nuestra regla de trazabilidad oficial.
   - **Propuesta de ajuste:** En Etapa 3, el desplegable muestra las **25 regiones con su ficha real del Atlas y Nivel 1–5 preliminar**, pero distingue claramente: **Jugables completos** (*Arequipa*, *Ica–Pisco*) vs. **En auditoría (Etapa 5)** — o permite un modo *"Exploración de diagnóstico Día 1"* para las 23 restantes sin inventar saldos hídricos/MEF.
3. **El "Flashback" puede sentirse como adorno pasivo si no tiene consecuencias de juego:**
   - Un video/viñeta puramente decorativo de 2 segundos se salta al segundo intento.
   - **Propuesta de ajuste:** Que el flashback de 4 cuadros incluya **1 decisión breve de Plan de Gobierno / Énfasis de Campaña** (ej. *Prioridad Servicios Básicos*, *Prioridad Corredores e Inversión*, *Prioridad Seguridad y Diálogo* o *Balanceado*), que fija las **expectativas iniciales de la ciudadanía y tus metas de mandato** (sin bonos mágicos ni sesgo partidario).
4. **Falta aterrizar cómo se juega "todo el espectro político dentro de la ley":**
   - Si solo hay obras públicas y ofertas privadas, todas las partidas se juegan igual (orientadas a eficiencia empresarial). Un jugador con enfoque más social/redistributivo o más pro-mercado necesita **instrumentos legales reales diferenciados** y **consecuencias reales (trade-offs)** en ambos sentidos.

---

## 2. Qué podemos agregar desde la jugabilidad (Educación Cívica + Espectro Político Lícito)

1. **Comité de Asesores con 2 funciones claras (Técnica + Guardarraíl Legal):**
   - Cada asesor (*Presupuesto/MEF*, *Infraestructura/Invierte.pe*, *Desarrollo Social*, *Asesoría Jurídica*) no solo aconseja según tu prioridad, sino que **frena con explicación pedagógica** cualquier intento fuera de ley:
     - *Ej. "No podemos usar Canon Minero para pagar planillas permanentes de serenazgo (Ley del Canon, uso exclusivo en inversión pública)."*
     - *Ej. "Un GORE no puede crear una empresa comercial de agroexportación (Art. 60° Const.); sí podemos construir canales públicos o habilitar suelo industrial."*
     - *Ej. "Exonerar Impuesto a la Renta requiere Ley del Congreso con informe previo del MEF (Art. 74° Const.); aquí solo podemos ajustar tasas/arbitrios propios o elevar Proyecto de Ley."*
2. **Espectro de Decisiones Lícitas con Trade-offs Reales (sin sesgo ideológico):**
   - **Eje Fiscal / Tributario:** *Incentivos locales temporales / OxI / ZEEP* (atrae capital privado más rápido, sacrifica ingresos locales propios o compromete techo CIPRL futuro) vs. *Recaudación plena + inversión directa en servicios básicos* (cierra brechas de agua/salud más rápido, menor atractivo inmediato para capital privado).
   - **Eje de Orden y Conflictos:** *Mesa de diálogo vinculante con actas verificables* (lenta al inicio, baja tensión estructural si se cumple) vs. *Solicitud de declaratoria de emergencia / control de vías al Ejecutivo* (despeja el corredor rápido, mantiene latente la causa raíz si no hay obra).
   - **Eje Territorial:** *Concentrar inversión en polo urbano/puerto* (máximo PBI y Canon rápido) vs. *Cerrar brechas en provincias rezagadas* (más puntos de cohesión territorial y bienestar, retorno tributario más lento).
3. **Medidor de "Atribución Real" al cierre (Educación Cívica pura):**
   - Al terminar el mandato (o ante una crisis), el resumen muestra qué porcentaje del resultado dependió de **decisiones propias del GORE** (ejecución del PIM, O&M, convenios, diálogo), qué dependió de **municipalidades/ministerios/Congreso** (plazos de ley, transferencias) y qué dependió de **factores externos** (precios internacionales o eventos climáticos INDECI).

---

## 3. Preguntas directas para Codex (`PC-007`)

1. **Sobre la fecha corriente (`hoy`) y el cierre fiscal:** ¿Cómo ves iniciar en la fecha corriente (`asOf` real) con saldo de cierre del año en curso + asignación del año siguiente, versus iniciar el 1 de enero del periodo de gestión? ¿Cómo impacta al motor de cierres (`engine/index.js`)?
2. **Sobre el alcance de Etapa 3:** ¿Conviene incluir **Onboarding + Flashback + Día 1 + Comité de Asesores (guardarraíl legal)** dentro de Etapa 3 junto con los 4 instrumentos institucionales (`11`), o separarlo en **Etapa 3A (Onboarding, Día 1, Convenios, OxI)** y **Etapa 3B (ZEEP y Senado Bicameral)** para no sobredimensionar un solo bloque?
3. **Sobre el calendario de Arequipa (`11`):** Confirmar si ajustamos `aqp-water-work` a 125 días en `game.json` o ajustamos la traza `04`, antes de añadir nuevos instrumentos.
