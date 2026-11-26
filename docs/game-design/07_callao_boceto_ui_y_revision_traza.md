# Etapa 1 · T-103 Ficha de Callao (tutorial) y boceto de interfaz (Antigravity)

Todas las cifras de esta ficha son **simuladas**. Reutiliza sin cambios la regla de elegibilidad, la fecha de decisión y la lectura de resultado de la [traza de Arequipa](./04_traza_arequipa.md).

## 1. Revisión cruzada de la traza de Arequipa (Antigravity → Codex)

Recalculé las tres estrategias con los parámetros de la ficha de [03](./03_respuesta_codex.md). **Los resultados de la tabla son correctos**: agua primero entrega el día 95 (30+65), corredor primero el día 80 (25+55) y la tercera estrategia desplaza el agua al día 125 (acceso habilitado el día 30, luego 30+65 sobre ese inicio); la fase reducida gana por 215 contra 220 min.

Observaciones:
1. **Sin corredor no hay rescate en el incidente.** Con 65 unidades, ninguna estrategia financia agua y corredor a la vez (45+40). El incidente solo se mitiga con el corredor; es una tensión buena, pero debe quedar escrita como regla de diseño.
2. **Inspección antes del día 60:** la apoyo **solo si requiere el acceso habilitado**. Con vía ordinaria (habilitación día 110) la inspección no puede ocurrir antes del 60, por lo que el convenio prioritario compra tiempo verificable. Si la inspección no depende del acceso, la regla no diferencia las vías. Propuesta: condición de la empresa = "inspección técnica con acceso habilitado antes del día 60".
3. **Mantenimiento del acceso:** propongo que el **O&M del acceso lo asuma la municipalidad provincial** (vía local, Ley 27972) y que los 15 u. del convenio prioritario sean transferencia de capital del gobierno regional. Variable de prueba: si el O&M recayera en la región (2 u./año), el margen de 5 u. se reduce a 3. Correr ambas variantes.
4. Falta en la traza una columna de **motivo en texto** por decisión (ya prevista en el contrato) y el **saldo de agua protegido** por estrategia.

## 2. Callao · tutorial (5–8 min)

| Elemento | Parámetro simulado |
|---|---|
| Oferta | Planta logística con frío; decide el día 90. Requiere acceso habilitado al terminal y ruta ≤ 90 min. |
| Cuello de botella visible | El acceso público al terminal tiene una restricción que sube la ruta a 110 min. |
| Presupuesto | 30 unidades elegibles, un equipo de expedientes. |
| Opción A · reparar el acceso | Cuesta 25, entrega a los 40 días, baja la ruta a 80 min. O&M anual 2. |
| Opción B · alternativa de conexión | Convenio con la autoridad portuaria: cuesta 10, habilita el día 70 una conexión de 95 min. |
| Rival | Una sede rival ofrece 100 min y gana si la oferta no cumple. |
| Resultado esperado | A gana con 80 min (< 90) y deja 5; B queda en 95 y **pierde** frente al rival pese a costar menos: enseña "el requisito pendiente". |

El tutorial pasa cuando el jugador identifica el requisito pendiente (ruta ≤ 90), completa la decisión y explica por qué cambió el resultado.

## 3. Boceto de interfaz del modo juego (sin código)

- **Entrada:** botón `🎮 Gobernar` en la barra superior (`app.ui.addTopButton`), que activa `app.registerMode("game")`; `Esc` regresa al Atlas.
- **Barra de reloj** (arriba, centro): fecha, `⏸ 1× 2× 4×`, saldo disponible / comprometido.
- **Dock izquierdo (`app.ui.dock("left")`):** *Cartera* (obras y convenios con estado y fechas), *Ofertas* (con cuenta regresiva y **semáforo de requisitos**), *Registro* (eventos explicables del motor).
- **Ficha de oferta:** lista de requisitos con ✔/✘, "qué cambia si construyes X" y comparación con la sede rival.
- **Mapa:** `registerOverlay` dibuja predio, nodo de agua, enlaces con tiempo, obras en curso e interrupciones; `registerStaticLayer` para la capa de red.
- **Fin de partida:** resultado separado en *decisión de ubicación* y *efectos de gestión* (continuidad de agua, accesibilidad, obligaciones, inversión desembolsada, empleo).
- **Regla técnica:** al salir del modo se liberan overlays, paneles y suscripciones; el Atlas queda intacto.
