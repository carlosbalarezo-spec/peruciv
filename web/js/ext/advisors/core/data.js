// The advisors' data model: three "levels" (states, metros, counties) of rows with typed fields, plus the links
// between rows and the hex map (row → highlight, cell → row). Built once from app.data (counties.json optional).
//
//   level = {id, label, noun, rows: [row], fields: [field], field(key), value(row, key),
//            highlight(rows, opts) → app.state.highlight, rowAtCell(cell) → row | null, focus(row), byKey: Map}
//   row   = {key, name, sub, level, ref, v: {fieldKey: value}}
//   field = {key, label, format, unit, higher_is, source, description, lens?, group, derived?}
import { fin, ratio } from "./util.js";
import { frameBox } from "./frame.js";

const COUNTY_LENS = {
  density: "density", income: "income", home_value: "home", poverty: "poverty", median_age: "age", foreign_born: "foreign_born",
  bachelors: "bachelors", broadband: "broadband", commute: "commute", homeownership: "homeownership", uninsured: "uninsured",
  forest: "forest", developed: "developed",
  // county lenses: Religion Census, ENAHO / INEI wellbeing (id amenities), FEMA disasters, ACS veterans
  faith: "faith", faith_tradition: "faith_tradition", amenities: "amenities", disasters: "disasters", veterans_pct: "veterans",
};
// County measures we can roll up to states and metros as population-weighted means.
const ROLLUP = ["density", "poverty", "median_age", "foreign_born", "bachelors", "broadband", "commute", "homeownership", "uninsured", "faith", "amenities"];
// Rolled-up means that only approximate the area's true value (a median, a mean of rates or of an index).
const APPROX = new Set(["median_age", "commute", "faith", "amenities"]);
// County counts summed to states and metros, with their share recomputed from the implied denominators
// (count ÷ share = the county's base population), so the area's share is exact, not a mean of county shares.
const SUMS = [["veterans", "veterans_pct"], ["armed_forces", "armed_forces_pct"]];
const LAND_KEYS = ["forest", "crop", "pasture", "grass", "shrub", "wetland", "developed"];
export const LAND_LABEL = {
  forest: "Selva y bosque", crop: "Cultivos", pasture: "Pastos", grass: "Puna y pajonal", shrub: "Matorral y desierto", wetland: "Humedal amazónico", developed: "Urbano",
};
export const LAND_COLOR = {
  forest: "#3f7a3a", crop: "#d2c457", pasture: "#93b852", grass: "#b9b06a", shrub: "#c9a874", wetland: "#4f9a86", developed: "#9a8f9e",
};
export { LAND_KEYS };

export function buildData(app) {
  const { cities = [], states = [], nation = {}, counties, resources, sources = [] } = app.data;
  const w = app.w;
  const grid = w.grid;
  const owner = w.raw.owner;
  const countyOf = w.raw.county || [];
  const n = grid.size;

  // --- cell indexes ---------------------------------------------------------------------------------------------
  const stateCells = new Map();
  const countyCells = new Map();
  for (let i = 0; i < n; i++) {
    const o = owner[i];
    if (!(o >= 0)) continue;
    if (!stateCells.has(o)) stateCells.set(o, []);
    stateCells.get(o).push(i);
    const c = countyOf[i];
    if (c >= 0) {
      if (!countyCells.has(c)) countyCells.set(c, []);
      countyCells.get(c).push(i);
    }
  }
  // cell → metro: footprints, smaller metros first so a bigger metro's majority wins; then every city's own cell.
  const cellMetro = new Map();
  for (let k = cities.length - 1; k >= 0; k--) for (const cell of cities[k].footprint || []) cellMetro.set(cell, cities[k]);
  for (const c of cities) if (c.cell != null) cellMetro.set(c.cell, c);

  const srcTitle = new Map(sources.map((s) => [s.id, s]));
  const nat = nation.nation || {};
  const vintage = nation.vintage || "INEI 2025";
  const countyVintage = counties?.vintage || "INEI ENAHO 2025";

  // --- fields ---------------------------------------------------------------------------------------------------
  const F = (key, label, format, o = {}) => ({ key, label, format, unit: o.unit || null, higher_is: o.higher_is || "neutral", source: o.source || "", description: o.description || "", lens: o.lens || null, group: o.group || "Economía", derived: !!o.derived });
  const econFields = (src) => [
    F("population", "Población", "int", { unit: "hab.", source: src, group: "Población", description: `Residentes proyectados (${vintage}).`, lens: "density" }),
    F("growth", "Crecimiento", "signed", { unit: "variación poblacional", higher_is: "neutral", source: "peru_socioeconomic", group: "Población", description: `Variación poblacional ${(nat.growth_years || []).join("–")} (proyecciones INEI).` }),
    F("gdp", "PBI", "money", { unit: "$ anuales", source: "peru_socioeconomic", description: `${nation.gdp_vintage || "INEI"}: PBI en dólares corrientes.` }),
    F("gdp_pc", "PBI per cápita", "usd", { unit: "$ por habitante", higher_is: "good", source: "peru_socioeconomic", description: "PBI ÷ habitantes." }),
    F("median_income", "Ingreso anual", "usd", { unit: "ingreso familiar anual", higher_is: "good", source: src, group: "Prosperidad", description: `Ingreso familiar anual equivalente en USD (${vintage}).`, lens: "income" }),
    F("median_rent", "Alquiler mensual", "usd", { unit: "alquiler mensual est.", source: src, group: "Prosperidad", description: `Alquiler mensual estimado en USD (${vintage}).` }),
    F("home_value", "Valor de vivienda", "usd", { unit: "valor referencial", source: src, group: "Prosperidad", description: `Valor referencial de la vivienda en USD (${vintage}).`, lens: "home" }),
    F("affordability", "Vivienda ÷ ingreso", "ratio", { unit: "años de ingreso", higher_is: "bad", group: "Prosperidad", description: "Valor de vivienda ÷ ingreso anual del hogar: cuántos años de ingreso equivale una vivienda.", derived: true }),
    F("rent_burden", "Alquiler ÷ ingreso", "pct", { unit: "alquiler × 12 ÷ ingreso", higher_is: "bad", source: src, group: "Prosperidad", description: "Alquiler anual ÷ ingreso familiar anual." }),
    F("unemployment", "Desempleo", "pct", { unit: "desocupados ÷ PEA", higher_is: "bad", source: src, group: "Prosperidad", description: `Tasa de desempleo abierto (${vintage}).` }),
    F("employed", "Ocupados", "int", { unit: "residentes ocupados", source: src, description: `Residentes ocupados según lugar de residencia (${vintage}).` }),
    ...(nation.yields || []).filter((y) => y.unit !== "usd").map((y) => F(`y_${y.key}`, `Ocupados en ${y.label}`, "int", { unit: "trabajadores", source: src, group: "Rendimientos", description: y.description })),
  ];
  const rollupFields = () => counties ? [...ROLLUP.map((k) => {
    const f = counties.fields.find((x) => x.key === k);
    if (!f) return null;
    const approx = APPROX.has(k);
    return F(k, f.label + (approx ? " ≈" : ""), f.format, {
      unit: f.unit, higher_is: f.higher_is, source: f.source || "peru_socioeconomic", group: groupOf(k), lens: COUNTY_LENS[k],
      description: k === "density" ? `Habitantes ÷ superficie terrestre de sus provincias (${countyVintage}).`
        : `${f.description} Promedio ponderado por población desde las provincias miembro${approx ? " (aproximación)" : ""} (${countyVintage}).`,
      derived: true,
    });
  }), ...SUMS.flatMap(([n, p]) => {
    const fn = counties.fields.find((x) => x.key === n), fp = counties.fields.find((x) => x.key === p);
    if (!fn || !fp) return [];
    return [
      F(n, fn.label, fn.format, { unit: fn.unit, source: fn.source, group: groupOf(n), description: `${fn.description} Suma de las provincias miembro (${countyVintage}).`, derived: true }),
      F(p, fp.label, fp.format, { unit: fp.unit, source: fp.source, group: groupOf(p), lens: COUNTY_LENS[p], description: `${fp.description} Suma provincial ÷ población base (${countyVintage}).`, derived: true }),
    ];
  })].filter(Boolean) : [];

  // --- roll-ups from counties -------------------------------------------------------------------------------------
  const roll = { states: new Map(), metros: new Map() };
  const cRows = [];
  if (counties) {
    const col = Object.fromEntries(counties.columns.map((k, j) => [k, j]));
    counties.rows.forEach((r, i) => cRows.push({ r, i }));
    const add = (map, key, r) => {
      if (key == null) return;
      let a = map.get(key);
      if (!a) map.set(key, (a = { pop: 0, land: 0, s: {}, wt: {}, n: {}, d: {}, dn: {}, dp: {}, zp: {} }));
      const pop = r[col.population];
      if (fin(pop)) a.pop += pop;
      if (fin(r[col.land_km2])) a.land += r[col.land_km2];
      for (const k of ROLLUP) {
        if (k === "density") continue;
        const v = r[col[k]];
        if (fin(v) && fin(pop) && pop > 0) {
          a.s[k] = (a.s[k] || 0) + v * pop;
          a.wt[k] = (a.wt[k] || 0) + pop;
        }
      }
      for (const [n, p] of SUMS) {
        if (col[n] == null) continue;
        const c = r[col[n]], s = col[p] != null ? r[col[p]] : null;
        if (!fin(c)) continue;
        a.n[n] = (a.n[n] || 0) + c;
        // A county with a zero count (share 0) has no implied base: it is estimated from its population at the
        // base-to-population ratio of the other counties (if every county is zero the share stays null, not 0).
        if (fin(s) && s > 0) {
          a.d[n] = (a.d[n] || 0) + c / s;
          a.dn[n] = (a.dn[n] || 0) + c;
          if (fin(pop)) a.dp[n] = (a.dp[n] || 0) + pop;
        } else if (c === 0 && fin(pop)) a.zp[n] = (a.zp[n] || 0) + pop;
      }
    };
    for (const { r } of cRows) {
      add(roll.states, r[col.state], r);
      add(roll.metros, r[col.cbsa], r);
    }
  }
  const rolled = (map, key) => {
    const a = map.get(key);
    const out = {};
    if (!a) return out;
    out.density = a.land > 0 ? a.pop / a.land : null;
    out.land_km2 = a.land || null;
    for (const k of ROLLUP) if (k !== "density") out[k] = a.wt[k] ? a.s[k] / a.wt[k] : null;
    for (const [n, p] of SUMS) {
      out[n] = a.n[n] ?? null;
      const zeroBase = a.zp[n] && a.dp[n] ? (a.zp[n] * a.d[n]) / a.dp[n] : 0;
      out[p] = a.d[n] > 0 ? a.dn[n] / (a.d[n] + zeroBase) : null;
    }
    return out;
  };

  const econValues = (o) => ({
    population: o.population ?? null,
    growth: o.growth ?? null,
    gdp: o.gdp ?? o.yields?.gold ?? null,
    gdp_pc: ratio(o.gdp ?? o.yields?.gold, o.population),
    median_income: o.median_income ?? null,
    median_rent: o.median_rent ?? null,
    home_value: o.home_value ?? null,
    affordability: ratio(o.home_value, o.median_income),
    rent_burden: o.rent_burden ?? null,
    unemployment: o.unemployment ?? null,
    employed: o.employed ?? null,
    ...Object.fromEntries((nation.yields || []).filter((y) => y.unit !== "usd").map((y) => [`y_${y.key}`, o.yields?.[y.key] ?? null])),
  });

  // --- resources by place ---------------------------------------------------------------------------------------
  const items = resources?.items || [];
  const typeById = new Map((resources?.types || []).map((t) => [t.id, t]));
  const mwByMetro = new Map();
  items.forEach((it) => {
    if (typeById.get(it.type)?.unit !== "MW" || !fin(it.value) || !it.cbsa) return;
    mwByMetro.set(it.cbsa, (mwByMetro.get(it.cbsa) || 0) + it.value);
  });

  // --- states ---------------------------------------------------------------------------------------------------
  const stateRows = (Array.isArray(states) ? states : []).map((s, idx) => ({
    key: s.abbr, name: s.name, sub: s.abbr, level: "states", ref: idx,
    v: {
      name: s.name, abbr: s.abbr, ...econValues(s), ...rolled(roll.states, s.abbr),
      ...Object.fromEntries(LAND_KEYS.map((k) => [`land_${k}`, s.land?.[k] ?? null])),
      energy_mw: s.energy ? s.energy.total : null,
    },
  }));
  const landFields = LAND_KEYS.map((k) => F(`land_${k}`, LAND_LABEL[k], "pct", { unit: "proporción del suelo", source: "etopo", group: "Territorio", description: `Proporción territorial de ${LAND_LABEL[k].toLowerCase()} (media sobre los hexágonos del área).`, lens: k === "forest" ? "forest" : k === "developed" ? "developed" : null }));
  const energyField = F("energy_mw", "Potencia mapeada", "mw", { unit: "MW en sitios mapeados", source: "minem_generation", group: "Energía", description: "Potencia instalada de las centrales eléctricas mapeadas como recursos (MINEM)." });
  const states_ = makeLevel({
    id: "states", label: "Departamentos", noun: "departamento",
    rows: stateRows,
    fields: [F("name", "Departamento", "text", { group: "Nombre" }), ...econFields("peru_socioeconomic"), ...rollupFields(), F("land_km2", "Superficie", "km2", { unit: "km²", source: "peru_boundaries", group: "Territorio", derived: true }), ...landFields, energyField],
    highlight: (rows) => ({ states: new Set(rows.map((r) => r.ref)) }),
    rowAtCell: (cell, byKey) => (owner[cell] >= 0 ? stateRows[owner[cell]] || null : null),
    focus: (row) => app.selectState(row.ref, { fly: true }),
    cellsOf: (row) => stateCells.get(row.ref) || [],
  });

  // --- metros ---------------------------------------------------------------------------------------------------
  const metroRows = cities.map((c) => ({
    key: c.id, name: c.name, sub: (c.states || []).join("–"), level: "metros", ref: c,
    v: {
      name: c.name, states: (c.states || []).join("–"), kind: c.metro === false ? "Micro" : "Metro",
      ...econValues(c), ...rolled(roll.metros, c.id), energy_mw: mwByMetro.get(c.id) ?? 0,
    },
  }));
  const metroByCity = new Map(metroRows.map((r) => [r.ref, r]));
  const metros = makeLevel({
    id: "metros", label: "Ciudades", noun: "ciudad",
    rows: metroRows,
    fields: [F("name", "Ciudad", "text", { group: "Nombre" }), F("states", "Región", "text", { group: "Nombre" }), F("kind", "Tipo", "text", { group: "Nombre", description: "Área metropolitana o capital/ciudad intermedia." }), ...econFields("peru_socioeconomic"), ...rollupFields(), F("land_km2", "Superficie", "km2", { unit: "km²", source: "peru_boundaries", group: "Territorio", derived: true }), energyField],
    highlight: (rows, o = {}) => {
      const cells = new Set();
      for (const r of rows) for (const c of r.ref.footprint || [r.ref.cell]) cells.add(c);
      return { cells, cities: rows.length <= (o.ringMax ?? 30) ? new Set(rows.map((r) => r.key)) : undefined };
    },
    rowAtCell: (cell) => { const c = cellMetro.get(cell); return c ? metroByCity.get(c) : null; },
    focus: (row) => app.selectCity(row.ref, { fly: true }),
    cellsOf: (row) => row.ref.footprint || [row.ref.cell],
  });

  // --- counties ---------------------------------------------------------------------------------------------------
  let counties_ = null;
  if (counties) {
    const cols = counties.columns;
    const cityName = new Map(cities.map((c) => [c.id, c.name]));
    // counties.json carries the faith_tradition category id; tables and filters read better with its name.
    const tradName = new Map((app.lensById?.get("faith_tradition")?.categories || []).map((c) => [c.id, c.name]));
    const countyRows = cRows.map(({ r, i }) => {
      const v = {};
      cols.forEach((k, j) => (v[k] = r[j]));
      v.metro = v.cbsa ? cityName.get(v.cbsa) || null : null;
      if (v.faith_tradition != null) v.faith_tradition = tradName.get(v.faith_tradition) || v.faith_tradition;
      return { key: v.geoid, name: shortCounty(v.name), full: v.name, sub: v.state, level: "counties", ref: i, v };
    });
    // counties.json rows follow world.json counties; map by geoid anyway in case they ever diverge.
    const worldIdx = new Map((w.raw.counties || []).map((c, k) => [c.geoid, k]));
    for (const row of countyRows) row.ref = worldIdx.get(row.key) ?? row.ref;
    const rowByWorld = new Map(countyRows.map((r) => [r.ref, r]));
    // Counties smaller than a hex own no cell: counties.json `cell` (the hex nearest the county's centre) stands in.
    const cellsOfRow = (r) => countyCells.get(r.ref) || (Number.isInteger(r.v.cell) ? [r.v.cell] : []);
    const fields = counties.fields.filter((f) => f.key !== "cbsa" && f.key !== "geoid" && f.key !== "cell").map((f) => ({
      ...F(f.key, f.key === "name" ? "Provincia" : f.label, f.format, { unit: f.unit, higher_is: f.higher_is, source: f.source, description: f.description, lens: COUNTY_LENS[f.key], group: groupOf(f.key) }),
    }));
    fields.splice(2, 0, F("metro", "Ciudad asociada", "text", { group: "Nombre", description: "Ciudad principal o área metropolitana a la que pertenece la provincia." }));
    counties_ = makeLevel({
      id: "counties", label: "Provincias", noun: "provincia",
      rows: countyRows, fields,
      highlight: (rows) => {
        const cells = new Set();
        for (const r of rows) for (const c of cellsOfRow(r)) cells.add(c);
        return { cells };
      },
      rowAtCell: (cell) => (countyOf[cell] >= 0 ? rowByWorld.get(countyOf[cell]) || null : null),
      focus: (row) => {
        let cells = cellsOfRow(row);
        // A county smaller than a hex owns no cell: frame its metro instead, or open its state.
        if (!cells.length && row.v.cbsa) cells = cities.find((c) => c.id === row.v.cbsa)?.footprint || [];
        if (!cells.length) return app.selectState(row.v.state, { fly: true });
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const c of cells) {
          const x = grid.cx(c), y = grid.cy(c);
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        const R = grid.R * 6;
        frameBox(app, { x0: x0 - R, y0: y0 - R, x1: x1 + R, y1: y1 + R }, { pad: 24, maxScale: 2.4 });
      },
      cellsOf: (row) => cellsOfRow(row),
    });
  }

  const countiesOffMap = counties_ ? counties_.rows.filter((r) => !counties_.cellsOf(r).length).length : 0; // no hex, not even a stand-in
  return {
    app, nation, nat, vintage, countyVintage, countiesOffMap,
    levels: { states: states_, metros, counties: counties_ },
    stateCells, countyCells, cellMetro, metroByCity,
    items, typeById,
    source: (id) => srcTitle.get(id) || null,
  };
}

/** "Los Angeles County" → "Los Angeles Co.", "Orleans Parish" → "Orleans Par." (tables and chart labels). */
export function shortCounty(name) {
  return String(name || "").replace(/ County$/, " Co.").replace(/ Parish$/, " Par.");
}

function groupOf(k) {
  if (["population", "density", "median_age", "foreign_born", "growth", "indigenous_lang"].includes(k)) return "Población";
  if (["income", "home_value", "poverty", "homeownership", "uninsured"].includes(k)) return "Prosperidad";
  if (["bachelors", "broadband"].includes(k)) return "Conocimiento";
  if (["commute", "water_access", "culture_org"].includes(k)) return "Vida cotidiana";
  if (["forest", "crop", "pasture", "developed", "land_km2"].includes(k)) return "Territorio";
  if (["name", "state", "metro"].includes(k)) return "Nombre";
  if (["faith", "faith_tradition"].includes(k)) return "Religión y Tradición";
  if (["amenities", "mhlth", "loneliness"].includes(k)) return "Bienestar";
  if (["disasters"].includes(k)) return "Peligros";
  if (["veterans", "veterans_pct", "armed_forces", "armed_forces_pct"].includes(k)) return "Defensa";
  return "Otros";
}

function makeLevel(def) {
  const fieldByKey = new Map(def.fields.map((f) => [f.key, f]));
  const byKey = new Map(def.rows.map((r) => [r.key, r]));
  return {
    ...def,
    byKey,
    field: (k) => fieldByKey.get(k) || null,
    value: (row, k) => row.v[k] ?? null,
    numericFields: () => def.fields.filter((f) => f.format !== "text"),
    /** Add fields after the fact (optional files that load on demand); a key already present is skipped. */
    addFields(list) {
      for (const f of list) {
        if (fieldByKey.has(f.key)) continue;
        def.fields.push(f);
        fieldByKey.set(f.key, f);
      }
    },
  };
}

// --- fields from files that load on demand ------------------------------------------------------------------------
// extendData(data, names) loads the named files (military, districts, citizens) through app.loadData and adds their
// columns to the levels once per data model. Missing files (null) add nothing. Returns the loaded files by name.
const F4 = (key, label, format, o = {}) => ({ key, label, format, unit: o.unit || null, higher_is: o.higher_is || "neutral", source: o.source || "", description: o.description || "", lens: o.lens || null, group: o.group || "Other", derived: !!o.derived });

export async function extendData(data, names) {
  const app = data.app;
  const files = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await app.loadData(n).catch(() => null)])));
  data.extended ??= new Set();
  for (const n of names) {
    if (data.extended.has(n) || !files[n]) continue;
    data.extended.add(n);
    try {
      if (n === "military") extendMilitary(data, files[n]);
      if (n === "districts") extendDistricts(data, files[n]);
      if (n === "citizens") extendCitizens(data, files[n]);
    } catch (err) {
      console.error(`advisors: could not add the ${n} columns`, err);
    }
  }
  return files;
}

function extendMilitary(data, mil) {
  const { states, metros } = data.levels;
  const v = mil.vintage || {};
  const instBy = (k) => {
    const m = new Map();
    for (const it of mil.installations || []) if (it[k]) m.set(it[k], (m.get(it[k]) || 0) + 1);
    return m;
  };
  const byState = instBy("state"), byMetro = instBy("cbsa");
  const src = { personnel: "peru_socioeconomic", spending: "peru_socioeconomic" };
  states.addFields([
    F4("mil_active", "Efectivos activos", "int", { unit: "personas", source: src.personnel, group: "Defensa", description: `Efectivos activos estimados de las FF.AA. en la región (${v.personnel || "MINDEF"}).` }),
    F4("mil_guard_reserve", "Reserva", "int", { unit: "personas", source: src.personnel, group: "Defensa", description: `Personal de reserva movilizable (${v.personnel || "MINDEF"}).` }),
    F4("mil_civilian", "Personal civil Defensa", "int", { unit: "personas", source: src.personnel, group: "Defensa", description: `Empleados civiles del sector Defensa (${v.personnel || "MINDEF"}).` }),
    F4("def_spending", "Presupuesto Defensa", "money", { unit: "$ anuales", source: src.spending, group: "Defensa", description: `Ejecución presupuestal del sector Defensa en la región (${v.spending || "MEF SIAF"}).` }),
    F4("def_per_resident", "Defensa $ por hab.", "usd", { unit: "$ por habitante", source: src.spending, group: "Defensa", description: `Presupuesto de Defensa ÷ habitantes (${v.spending || "MEF SIAF"}).` }),
    F4("def_pct_gdp", "Defensa % del PBI", "pct", { unit: "del PBI regional", source: src.spending, group: "Defensa", description: `Presupuesto de Defensa ÷ PBI regional (${v.spending || "MEF SIAF"}).` }),
    F4("installations", "Sedes militares", "int", { unit: "sedes FF.AA.", source: "peru_socioeconomic", group: "Defensa", description: `Bases navales, aéreas y cuarteles registrados (${v.installations || "Directorio FF.AA."}).` }),
  ]);
  for (const r of states.rows) {
    const s = mil.states?.[r.key];
    const p = s?.personnel, sp = s?.spending;
    Object.assign(r.v, {
      mil_active: p?.active?.total ?? null, mil_guard_reserve: p?.guard_reserve?.total ?? null, mil_civilian: p?.civilian?.total ?? null,
      def_spending: sp?.total ?? null, def_per_resident: sp?.per_resident ?? null, def_pct_gdp: sp?.pct_gdp ?? null,
      installations: s ? byState.get(r.key) || 0 : null,
    });
  }
  metros.addFields([
    F4("encampment", "Guarnición", "text", { source: "peru_socioeconomic", group: "Defensa", description: `Plaza fuerte o guarnición cuando la ciudad cumple la regla militar. ${mil.rules?.encampment || mil.rule || ""}` }),
    F4("installations", "Sedes militares", "int", { unit: "sedes FF.AA.", source: "peru_socioeconomic", group: "Defensa", description: `Sedes de las FF.AA. ubicadas en las provincias de la ciudad (${v.installations || "Directorio FF.AA."}).` }),
  ]);
  for (const r of metros.rows) {
    const c = mil.cities?.[r.key];
    r.v.encampment = c ? (c.tier === "fortress" ? "Plaza fuerte" : "Guarnición") + (c.naval ? " (naval)" : "") : null;
    r.v.installations = byMetro.get(r.key) || 0;
  }
}

function extendDistricts(data, d) {
  const { metros, counties } = data.levels;
  const cat = new Map((d.catalog || []).map((c) => [c.id, c]));
  const vint = d.vintage || "MTPE Planilla Electrónica";
  const lb = (x) => (x?.lower_bound ? " (al menos)" : "");
  metros.addFields([
    F4("city_type", "Vocación urbana", "text", { source: "mtpe_employment", group: "Distritos", description: `Insignia de especialización económica de la ciudad (${vint}).` }),
    F4("districts", "Distritos", "text", { source: "mtpe_employment", group: "Distritos", description: `Distritos productivos para los que califica la ciudad. ${d.rule?.text || ""}` }),
    F4("n_districts", "N.º de distritos", "int", { source: "mtpe_employment", group: "Distritos", description: "Cantidad de distritos especializados (hasta 5)." }),
    F4("qcew_jobs", "Empleos formales (MTPE)", "int", { unit: "puestos en planilla", source: "mtpe_employment", group: "Distritos", description: `Puestos formales privados registrados en planilla (${vint}).` }),
    F4("qcew_pay", "Remuneración anual (MTPE)", "usd", { unit: "$ anuales por puesto", source: "mtpe_employment", group: "Distritos", description: `Remuneración anual promedio equivalente en USD (${vint}).` }),
    F4("top_industry", "Sector más especializado", "text", { source: "mtpe_employment", group: "Distritos", description: "Rama de actividad con el mayor cociente de localización en la ciudad." }),
    F4("top_lq", "Cociente de localización (LQ)", "lq", { unit: "× promedio nacional", source: "mtpe_employment", group: "Distritos", description: "Participación del sector en la ciudad ÷ participación nacional." }),
  ]);
  for (const r of metros.rows) {
    const c = d.cities?.[r.key];
    const top = c?.top?.[0];
    Object.assign(r.v, {
      city_type: c?.badge?.label ?? null,
      districts: c ? (c.districts || []).map((x) => cat.get(x.id)?.name || x.id).join(", ") || null : null,
      n_districts: c ? (c.districts || []).length : null,
      qcew_jobs: c?.emp ?? null, qcew_pay: c?.avg_pay ?? null,
      top_industry: top ? `${d.industries?.[top.naics]?.title || top.naics}${lb(top)}` : null,
      top_lq: top?.lq ?? null,
    });
  }
  if (counties && d.counties) {
    counties.addFields([
      F4("districts", "Distritos", "text", { source: "mtpe_employment", group: "Distritos", description: `Distritos productivos para los que califica la provincia (${vint}).` }),
      F4("qcew_jobs", "Empleos formales (MTPE)", "int", { unit: "puestos en planilla", source: "mtpe_employment", group: "Distritos", description: `Puestos formales registrados en la provincia (${vint}).` }),
    ]);
    for (const r of counties.rows) {
      const c = d.counties[r.key];
      r.v.districts = c ? (c.districts || []).map((x) => cat.get(x[0])?.name || x[0]).join(", ") || null : null;
      r.v.qcew_jobs = c?.emp ?? null;
    }
  }
}

const CZ = [
  ["workforce", "executive", "Directivos y gerentes"], ["workforce", "engineer", "Ingenieros y científicos"], ["workforce", "healer", "Personal de salud"],
  ["workforce", "service", "Comercio y servicios"], ["workforce", "farmer", "Agro y pesca"], ["workforce", "builder", "Construcción y minería"],
  ["workforce", "maker", "Industria y transporte"],
  ["age", "child", "Menores (<18)"], ["age", "young", "Jóvenes (18–34)"], ["age", "elder", "Adultos mayores (65+)"],
  ["commute", "drove_alone", "Auto particular"], ["commute", "transit", "Transporte público"], ["commute", "walk", "A pie"], ["commute", "home", "Trabajo en casa"],
  ["education", "graduate", "Posgrado"],
  ["nativity", "born_in_state", "Nacidos en la región"], ["nativity", "foreign_born", "Nacidos en el exterior"],
];
function extendCitizens(data, cz) {
  const { metros } = data.levels;
  const vint = cz.vintage || "INEI 2025";
  const label = new Map(Object.entries(cz.groups || {}).flatMap(([row, list]) => list.map((g) => [`${row}.${g.key}`, g.label])));
  const rowDesc = cz.rows || {};
  const grp = { workforce: "Ciudadanos: ocupación", age: "Ciudadanos: edad", commute: "Ciudadanos: transporte", education: "Ciudadanos: educación", nativity: "Ciudadanos: origen" };
  metros.addFields([
    ...CZ.map(([row, key, lbl]) => F4(`cz_${key}`, lbl, "pct", {
      unit: `proporción de ${(rowDesc[row] || row).toLowerCase()}`, source: "peru_socioeconomic", group: grp[row],
      description: `${label.get(`${row}.${key}`) || lbl}: proporción dentro de ${(rowDesc[row] || row).toLowerCase()} (${vint}).`,
    })),
    F4("cz_median_age", "Edad mediana (ciudad)", "years", { unit: "años", source: "peru_socioeconomic", group: grp.age, description: `Edad mediana estimada de la ciudad (${vint}).` }),
    F4("cz_degree", "Grado univ. o más", "pct", { unit: "de adultos 25+", source: "peru_socioeconomic", group: grp.education, description: `Adultos de 25+ años con grado universitario o posgrado (${vint}).` }),
    F4("cz_specialist", "Perfil ciudadano destacado", "text", { source: "peru_socioeconomic", group: "Ciudadanos", description: `Categoría más sobrerrepresentada frente al promedio del Perú (≥ 1.45×).` }),
  ]);
  for (const r of metros.rows) {
    const c = cz.cities?.[r.key];
    for (const [row, key] of CZ) r.v[`cz_${key}`] = c?.[row]?.shares?.[key] ?? null;
    r.v.cz_median_age = c?.age?.median ?? null;
    r.v.cz_degree = c?.education?.bachelors_plus ?? null;
    const sp = (c?.specialists || []).find((s) => s.ratio >= 1);
    r.v.cz_specialist = sp ? `${label.get(`${sp.row}.${sp.key}`) || sp.key} ×${sp.ratio.toFixed(1)}` : null;
  }
}

/** The highlight for a set of rows of one level, with defaults (gold outline, other land dimmed when asked). */
export function rowsHighlight(level, rows, opts = {}) {
  if (!level || !rows || !rows.length) return null;
  const one = rows.length === 1 ? rows[0] : null;
  const label = opts.label ?? (one ? (one.level === "states" ? one.name : `${one.full || one.name}${one.sub ? `, ${one.sub}` : ""}`) : "");
  return { ...level.highlight(rows, opts), dimOthers: !!opts.dim, color: opts.color, label };
}
