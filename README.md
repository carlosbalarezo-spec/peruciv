# peruciv — Perú como un mapa de estrategia 4X con datos públicos reales

Réplica completa adaptada al Perú de [`usaciv`](https://karpathy.ai/usaciv/) (licencia MIT), construida sobre una malla hexagonal de 12 km de radio con datos oficiales de la **Plataforma Nacional de Datos Abiertos (`datosabiertos.gob.pe`)**, INEI, MTPE, MINEM, SERNANP, MINCETUR, SUNEDU, OSITRAN, INDECI, MINSA y Ministerio de Cultura.

## Qué incluye

- **Mapa hexagonal de 82 × 130 celdas (12 km de radio; 3,460 hexágonos peruanos)** cubriendo los **25 departamentos/regiones** (24 departamentos + Callao) y las **196 provincias** con sus códigos UBIGEO.
- **Relieve y pisos ecológicos reales:** Cordillera de los Andes, nevados, puna, valles interandinos, selva alta, llanura amazónica, desierto costero, Lago Titicaca, ríos amazónicos y Fosa de Perú-Chile.
- **48 principales ciudades del Perú** con banners de población, rendimientos (*Alimentos, Producción, Oro/PBI, Ciencia, Cultura*), insignias de especialización (*Capital de la República*, *Ciudad minera*, *Polo agroexportador*, *Capital turística y gastronómica*, *Ciudad portuaria*, etc.) y **Vista de Ciudad** completa (*Ciudadanos*, *Distritos*, *Economía*, *Fuerza Laboral*, *Recursos* y *Comparar*).
- **18 lentes temáticos** agrupados en 7 categorías (*Población*, *Prosperidad*, *Conocimiento*, *Vida y Cultura*, *Religión y Tradición*, *Peligros Naturales* y *Territorio*), con histograma interactivo.
- **10 Asesores + Explorador** acoplados en tiempo real al mapa: *Energía y Recursos*, *Economía*, *Población*, *Prosperidad y Vivienda*, *Conocimiento*, *Territorio*, *Defensa*, *Comercio y Rutas*, *Cultura y Peligros* y el **Explorador** (tablas filtrables y diagramas de dispersión sobre las 25 regiones, 48 ciudades y 196 provincias).
- **Capas de mapa conmutables:** *Carreteras*, *Ferrocarriles*, *Puertos y aeropuertos*, *Defensa*, *Maravillas* y *Rutas comerciales* (28 corredores logísticos, mineros, energéticos y agroexportadores).
- **Almanaque integrado** con trazabilidad automática (`sources.json`: URLs, fechas y hashes SHA-256).

## Inicio rápido

Requisitos: [uv](https://docs.astral.sh/uv/) (Python 3.11+, **solo biblioteca estándar**, sin npm ni paso de build).

```bash
# Levantar el servidor local en http://127.0.0.1:8765
uv run python -m pipeline serve --port 8765

# Validar contratos de datos (docs/DATA_CONTRACTS.md) y ejecutar tests
uv run python -m pipeline check
uv run python -m unittest discover -s tests -v

# Empaquetar para despliegue estático (peruciv.zip + peruciv-source.zip)
uv run python -m pipeline package

# Reconstruir todo desde las fuentes públicas (usa caché en data/raw/)
uv run python -m pipeline all
```

## Fuentes de datos integradas (15 módulos)

| Fuente (`pipeline/sources/`) | Entidad | Archivos `web/data/` que alimenta |
|---|---|---|
| `peru_boundaries` | PNDA / INEI | `world.json`, `states.json`, `counties.json` (25 regiones, 196 provincias, UBIGEO) |
| `peru_socioeconomic` | INEI — Microdatos ENAHO 2025 (33,702 hogares en 196 provincias), PBI 2024 y Proyecciones 2025 | `nation.json`, `states.json`, `cities.json`, `counties.json`, `lenses.json`, `citizens.json` |
| `mtpe_employment` | MTPE — Planilla Electrónica Dic. 2025 (PNDA) | `districts.json`, `citizens.json` (61,250 registros formales en 25 departamentos) |
| `minem_generation` | MINEM (PNDA) | `resources.json`, `states.json` (centrales hidroeléctricas, térmicas/gas, solares y eólicas) |
| `minem_hydrocarbons` | MINEM (PNDA) | `resources.json`, `trade.json` (lotes de gas de Camisea y petróleo en Talara/Loreto) |
| `sernanp_visits` | SERNANP (PNDA) | `wonders.json` (Áreas Naturales Protegidas más visitadas) |
| `mincetur_sites` | MINCETUR (PNDA) | `wonders.json` (Machu Picchu, Sacsayhuamán, Chan Chan, Caral, Kuélap, Nasca, etc.) |
| `sunedu_universities` | SUNEDU (PNDA) | `wonders.json`, `districts.json` (96 universidades licenciadas con lat/lon) |
| `ositran_airports` | OSITRAN (PNDA) | `infrastructure.json`, `trade.json` (tráfico de pasajeros en aeropuertos) |
| `indeci_emergencies` | INDECI — SINPAD 2003–2025 (PNDA) | `disasters.json`, `lenses.json`, `counties.json` (142,139 emergencias registradas) |
| `minsa_anemia` | MINSA (PNDA) | `counties.json` (seguimiento de anemia infantil) |
| `mincul_rentoca` | Ministerio de Cultura — RENTOCA (PNDA) | `states.json`, `cities.json`, `counties.json`, `lenses.json` (40,214 agentes culturales) |
| `etopo` | AWS Terrain Tiles (SRTM + ETOPO1) | `world.json`, `lenses.json` (relieve andino y batimetría oceánica) |
| `natural_earth` | Natural Earth v5.1.2 (1:50m) | `world.json` (países vecinos, Lago Titicaca y ríos principales) |
| `natural_earth_roads` | Natural Earth v5.1.2 (1:10m) | `infrastructure.json`, `trade.json` (red vial y ferrocarriles) |

## Diseño del Modo Juego y Coordinación Multi-Agente (`Antigravity` + `Codex`)

Toda la documentación de diseño, evaluación cruzada y hoja de ruta para construir **PerúCiv · Estrategia Regional en Tiempo Real** vive en [`docs/game-design/`](docs/game-design/README.md):

- [`docs/game-design/README.md`](docs/game-design/README.md) — Estado técnico actual y protocolo de trabajo coordinado entre Antigravity y Codex.
- [`docs/game-design/01_propuesta_codex.md`](docs/game-design/01_propuesta_codex.md) — Propuesta base de Codex.
- [`docs/game-design/02_opinion_antigravity_y_plan_v2.md`](docs/game-design/02_opinion_antigravity_y_plan_v2.md) — Opinión de Antigravity sobre las ideas de Codex y Plan Consolidado (v2).
