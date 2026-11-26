// Asesor de Defensa: sedes de las FF.AA. del Perú (EP, MGP, FAP, CCFFAA), presupuesto y efectivos por departamento y guarniciones.
import { esc, fin, el as mk } from "../core/util.js";
import { int, pct, money, count3, dollars } from "../core/fmt.js";
import { stackedBars, sizeLegend, swatchLegend } from "../core/charts.js";
import { createTable } from "../core/table.js";
import { section, tiles, chips, segmented, mapPicker, sourcesHtml } from "../core/view.js";
import { rowsHighlight, extendData } from "../core/data.js";
import { countyLens, stateLens } from "../core/lenses.js";
import { frameBox, focusPoint } from "../core/frame.js";

const COMP_COLOR = {
  army: "#7d9a46", navy: "#3f6fc2", air_force: "#6fb3e0", marines: "#c24a3e",
  army_reserve: "#a8bd78", navy_reserve: "#8aa6db", air_force_reserve: "#a9d3ee", marine_reserve: "#e08f86",
  army_guard: "#d6b04a", air_guard: "#e6cf86", other: "#9a9aa8",
};
const COMP_SHORT = {
  army: "Ejército (EP)", navy: "Marina (MGP)", air_force: "Fuerza Aérea (FAP)", marines: "Infantería Marina",
  army_reserve: "Reserva EP", navy_reserve: "DICAPI", air_force_reserve: "Reserva FAP", marine_reserve: "FOES",
  army_guard: "CE-VRAEM", air_guard: "Aviación EP/MGP", other: "CCFFAA",
};
const COMP_GROUPS = [
  { id: "active", label: "FF.AA. Activas", ids: ["army", "navy", "air_force", "marines"] },
  { id: "reserve", label: "Reserva / DICAPI", ids: ["army_reserve", "navy_reserve", "air_force_reserve", "marine_reserve"] },
  { id: "guard", label: "Comandos Esp.", ids: ["army_guard", "air_guard"] },
  { id: "other", label: "Conjunto", ids: ["other"] },
];
const TIER_LABEL = { major: "Principal", base: "Base", site: "Puesto" };
const AREA_CAP = 3000;
const STEEL_RAMP = ["#141b26", "#2a3a52", "#46627f", "#6f91ad", "#a9c3d6", "#eef4f8"];
const SPEND_RAMP = ["#1b1410", "#3e2a1c", "#6e4626", "#a66f34", "#d9a457", "#f8e2a6"];

export async function mount(ctx) {
  const { app, data, el, link } = ctx;
  await extendData(data, ["military"]);
  const mil = app.data.military;
  if (!mil) {
    el.innerHTML = `<p class="adv-empty pad">military.json no está disponible.</p>`;
    return {};
  }
  const { states: stLevel, metros, counties } = data.levels;
  const comps = (mil.components || []).map((c) => ({ ...c, color: COMP_COLOR[c.id] || "#9a9aa8", short: COMP_SHORT[c.id] || c.name }));
  const compById = new Map(comps.map((c) => [c.id, c]));
  const insts = (mil.installations || []).map((it, i) => ({ ...it, key: it.id || String(i) }));
  const instByKey = new Map(insts.map((it) => [it.key, it]));
  const nat = mil.national || {};
  const vint = mil.vintage || {};
  const stateIdx = (abbr) => stLevel.byKey.get(abbr)?.ref ?? null;
  const stateName = (abbr) => stLevel.byKey.get(abbr)?.name || abbr;
  const instCells = (it) => (it.cells && it.cells.length ? it.cells : it.cell != null ? [it.cell] : []);
  const cellInst = new Map();
  for (const it of insts) for (const c of it.cells || []) if (!cellInst.has(c)) cellInst.set(c, it);
  const cellRange = new Map();
  for (const r of mil.ranges || []) for (const c of r.cells || []) if (!cellRange.has(c)) cellRange.set(c, r);

  const st = { comps: new Set(comps.map((c) => c.id)), tier: "big", state: null };

  const P = nat.personnel || {}, S = nat.spending || {};
  el.insertAdjacentHTML("beforeend", tiles([
    { label: "Efectivos activos", value: count3(P.active?.total), sub: `+ ${count3(P.guard_reserve?.total)} Reserva`, color: "#a9c3d6" },
    { label: "Presupuesto Defensa", value: money(S.total), sub: `${pct(S.pct_gdp)} del PBI · ${esc(vint.spending || "")}` },
    { label: "Licenciados FF.AA.", value: count3(nat.veterans), sub: "adultos estimados" },
  ]) + `<p class="adv-callout">No existe dotación pública desagregada por cuartel individual, por lo que en el mapa se escalan según su área operativa. Las cifras de efectivos y ejecución presupuestal se muestran a nivel departamental.</p>`);

  const mapRow = mk("div", "adv-sec adv-mapsec");
  el.appendChild(mapRow);
  const afLens = () => countyLens(data, "armed_forces_pct", {
    name: "Efectivos residentes", emoji: "🎖️", ramp: STEEL_RAMP,
    description: "Proporción estimada de efectivos de las FF.AA. entre la población de 16+ años por provincia.",
  });
  const perResLens = () => stateLens(data, "def-per-resident", (abbr) => mil.states?.[abbr]?.spending?.per_resident ?? null, {
    name: "Defensa $ por hab.", emoji: "💵", format: "usd", unit: "$ por habitante", ramp: SPEND_RAMP, source: "peru_socioeconomic",
    description: `Gasto ejecutado del sector Defensa por habitante según departamento (${vint.spending || "MEF SIAF"}).`,
  });
  mapPicker(ctx, mapRow, {
    value: "terrain",
    options: [
      { value: "terrain", label: "Terreno", lens: () => null },
      ...(app.lensById?.get("veterans") ? [{ value: "veterans", label: "Licenciados", lens: () => "veterans" }] : []),
      ...(counties ? [{ value: "af", label: "Efectivos", lens: afLens }] : []),
      { value: "dollars", label: "$ por hab.", lens: perResLens },
    ],
  });

  const iBody = section(el, {
    title: "Sedes e instalaciones militares", kicker: esc(vint.installations || "Directorio FF.AA."),
    note: `Principales bases navales, aéreas, divisiones de ejército y comandos especiales en el Perú: el área del círculo refleja su polígono operativo (tope en ${int(AREA_CAP)} km²). ${esc(mil.rules?.tier || "")}`,
  });
  const counts = new Map();
  for (const it of insts) counts.set(it.component, (counts.get(it.component) || 0) + 1);
  const compChips = chips(iBody, {
    label: "Instituciones",
    items: comps.filter((c) => counts.get(c.id)).map((c) => ({ key: c.id, label: c.short, color: c.color, count: counts.get(c.id) })),
    onChange: (on) => { st.comps = on; apply(); },
  });
  const qRow = mk("div", "adv-row");
  qRow.innerHTML = COMP_GROUPS.map((g) => `<button type="button" class="adv-mini" data-g="${g.id}">${esc(g.label)}</button>`).join("") + `<button type="button" class="adv-mini" data-g="all">Todas</button>`;
  iBody.appendChild(qRow);
  qRow.addEventListener("click", (e) => {
    const g = e.target.closest("[data-g]")?.dataset.g;
    if (!g) return;
    st.comps = g === "all" ? new Set(comps.map((c) => c.id)) : new Set(COMP_GROUPS.find((x) => x.id === g).ids);
    compChips.set(st.comps);
    apply();
  });
  const tRow = mk("div", "adv-row");
  iBody.appendChild(tRow);
  segmented(tRow, {
    label: "Jerarquía", value: st.tier,
    options: [{ value: "major", label: "Principales" }, { value: "big", label: "Principales y bases" }, { value: "all", label: "Todas las sedes" }],
    onChange: (v) => { st.tier = v; apply(); },
  });
  const stateChip = mk("div", "adv-row adv-filterbar");
  iBody.appendChild(stateChip);
  stateChip.addEventListener("click", (e) => { if (e.target.closest("[data-clear-state]")) setState(null); });
  const legend = mk("div");
  legend.innerHTML = sizeLegend([100, 1000, AREA_CAP], (v) => 14 * Math.sqrt(v / AREA_CAP), (v) => `${int(v)} km²`, "Área del círculo = superficie operativa");
  iBody.appendChild(legend);
  const instTable = createTable(iBody, {
    caption: "Sedes de las FF.AA.", search: "Buscar bases o departamentos", rank: true, maxHeight: 280,
    searchText: (r) => `${r.name} ${r.state} ${compById.get(r.component)?.name || ""}`,
    columns: [
      { key: "name", label: "Sede militar", align: "l", width: "minmax(0,1.9fr)", value: (r) => r.name, html: (r) => `<i class="dot" style="background:${esc(compById.get(r.component)?.color || "#999")}"></i>${esc(r.name)}${r.joint ? ` <span class="sub">conjunta</span>` : ""}`, tip: (r) => `${r.name} · ${compById.get(r.component)?.name || r.component}${r.status !== "act" ? ` · ${STATUS[r.status] || r.status}` : ""}` },
      { key: "component", label: "Arma", align: "l", width: "minmax(0,.9fr)", hideBelow: 400, value: (r) => compById.get(r.component)?.short, text: (r) => compById.get(r.component)?.short || r.component },
      { key: "tier", label: "Nivel", align: "l", width: "60px", value: (r) => ({ major: 0, base: 1, site: 2 })[r.tier], text: (r) => TIER_LABEL[r.tier] || r.tier },
      { key: "state", label: "Reg.", align: "l", width: "40px", value: (r) => r.state, text: (r) => r.state || "–" },
      { key: "area", label: "Área", width: "minmax(0,.8fr)", value: (r) => r.area_km2, text: (r) => (fin(r.area_km2) ? `${count3(r.area_km2)} km²` : "–"), title: "Superficie operativa estimada" },
    ],
    rows: [], sort: { key: "area", dir: "desc" },
    onHover: (r) => {
      link.hover(r ? { cells: new Set(instCells(r)), label: r.name } : null);
      bubbles.setHot(r ? r.key : null);
    },
    onClick: (r) => flyTo(r),
  });
  function flyTo(r) {
    if (r.cells && r.cells.length > 2) {
      const b = app.highlightBounds({ cells: new Set(r.cells) });
      if (b) return frameBox(app, b, { pad: 60, maxScale: 3 });
    }
    focusPoint(app, r.x, r.y, Math.min(app.cam.maxScale, Math.max(app.cam.scale, (app.cam.fitScale || 1) * 3)));
  }

  const sBody = section(el, {
    title: "Efectivos y presupuesto por departamento",
    note: `Distribución regional de efectivos (${esc(vint.personnel || "MINDEF")}) y ejecución presupuestal (${esc(vint.spending || "MEF SIAF")}). Haz clic en un departamento para ver su desglose y filtrar sus sedes.`,
  });
  const sCtl = mk("div", "adv-row");
  sBody.appendChild(sCtl);
  let metric = "troops", showAll = false;
  segmented(sCtl, {
    label: "Medida", value: metric,
    options: [{ value: "troops", label: "Efectivos" }, { value: "dollars", label: "Presupuesto $" }, { value: "perres", label: "$ por hab." }, { value: "gdp", label: "% del PBI" }],
    onChange: (v) => { metric = v; drawStates(); },
  });
  const allBtn = mk("button", "adv-mini");
  allBtn.type = "button";
  sCtl.appendChild(allBtn);
  allBtn.addEventListener("click", () => { showAll = !showAll; drawStates(); });
  const sHost = mk("div");
  sBody.appendChild(sHost);
  const sLegend = mk("div");
  sBody.appendChild(sLegend);
  const detail = mk("div", "adv-detail");
  sBody.appendChild(detail);
  let stacks = null;
  const METRICS = {
    troops: {
      keys: [{ key: "active", label: "Efectivos activos", color: "#6f91ad" }, { key: "guard", label: "Reserva", color: "#d6b04a" }, { key: "civ", label: "Personal civil", color: "#9a9aa8" }],
      parts: (s) => ({ active: s.personnel?.active?.total, guard: s.personnel?.guard_reserve?.total, civ: s.personnel?.civilian?.total }),
      total: (s) => s.personnel?.total, fmt: count3,
    },
    dollars: {
      keys: [{ key: "contracts", label: "Bienes y contratos", color: "#d9a457" }, { key: "payroll", label: "Planilla y haberes", color: "#6f91ad" }, { key: "grants", label: "Inversión / otros", color: "#8fcbb8" }],
      parts: (s) => ({ contracts: s.spending?.contracts, payroll: s.spending?.payroll, grants: s.spending?.grants }),
      total: (s) => s.spending?.total, fmt: money,
    },
    perres: { keys: [{ key: "v", label: "$ por habitante", color: "#d9a457" }], parts: (s) => ({ v: s.spending?.per_resident }), total: (s) => s.spending?.per_resident, fmt: dollars },
    gdp: { keys: [{ key: "v", label: "% del PBI regional", color: "#c46a4f" }], parts: (s) => ({ v: s.spending?.pct_gdp }), total: (s) => s.spending?.pct_gdp, fmt: (v) => pct(v) },
  };
  const milStates = Object.entries(mil.states || {}).filter(([, s]) => s);
  function drawStates() {
    const M = METRICS[metric];
    const rows = milStates
      .map(([abbr, s]) => ({ key: abbr, label: stateName(abbr), sub: "", parts: M.parts(s), total: M.total(s), text: M.fmt(M.total(s)) }))
      .filter((r) => fin(r.total))
      .sort((a, b) => b.total - a.total);
    const shown = showAll ? rows : rows.slice(0, 15);
    allBtn.textContent = showAll ? "Top 15" : `Las ${rows.length}`;
    sHost.innerHTML = "";
    stacks = stackedBars(sHost, {
      rows: shown, keys: M.keys, fmt: (v) => M.fmt(v), ariaLabel: "Defensa por departamento",
      onHover: (x) => {
        if (!x) return link.hover(null);
        const i = stateIdx(x.row.key);
        link.hover(i != null ? { states: new Set([i]), dimOthers: true, label: x.row.label } : null);
      },
      onClick: (x) => setState(st.state === x.row.key ? null : x.row.key, true),
    });
    if (st.state) stacks.setSelected(st.state);
    sLegend.innerHTML = M.keys.length > 1 ? swatchLegend(M.keys) : "";
  }

  function drawDetail() {
    const abbr = st.state;
    const s = abbr ? mil.states?.[abbr] : null;
    if (!abbr) { detail.innerHTML = ""; return; }
    if (!s) { detail.innerHTML = `<p class="adv-empty">Sin cifras detalladas para ${esc(stateName(abbr))}.</p>`; return; }
    const p = s.personnel, sp = s.spending;
    const branch = p ? [["Ejército (EP)", p.active?.army], ["Marina (MGP)", p.active?.navy], ["Infantería de Marina", p.active?.marines], ["Fuerza Aérea (FAP)", p.active?.air_force]] : [];
    const nInst = insts.filter((it) => it.state === abbr).length;
    detail.innerHTML = `<div class="adv-card-detail">
      <h4 class="adv-h4">${esc(stateName(abbr))}</h4>
      ${tiles([
        { label: "Efectivos activos", value: p ? int(p.active?.total) : "–", sub: p ? `${int(p.guard_reserve?.total)} reserva` : "" },
        { label: "Presupuesto Defensa", value: sp ? money(sp.total) : "–", sub: sp ? `${pct(sp.pct_gdp)} del PBI · ${dollars(sp.per_resident)}/hab.` : "" },
        { label: "Sedes militares", value: int(nInst), sub: "sedes registradas" },
      ])}
      ${p ? `<p class="adv-note"><b>Por institución:</b> ${branch.filter(([, v]) => fin(v) && v > 0).map(([k, v]) => `${esc(k)} ${int(v)}`).join(" · ")}. Personal civil: ${int(p.civilian?.total)}.</p>` : ""}
      ${sp ? `<p class="adv-note"><b>Destino del gasto:</b> bienes y contratos ${money(sp.contracts)}, personal y obligaciones ${money(sp.payroll)}, proyectos/otros ${money(sp.grants)}.</p>` : ""}
      ${sp?.top_vendors?.length ? `<p class="adv-note"><b>Entidades ejecutoras / industriales:</b> ${sp.top_vendors.map((v) => `${esc(v.name)} ${money(v.contracts)}`).join(" · ")}</p>` : ""}
    </div>`;
  }

  const gBody = section(el, {
    title: "Ciudades guarnición y plazas fuertes",
    note: `${esc(mil.rules?.encampment || mil.rule || "")}`,
  });
  const garrisons = Object.entries(mil.cities || {}).map(([id, c]) => ({ ...c, key: id, row: metros.byKey.get(id) })).filter((g) => g.row);
  const gTable = createTable(gBody, {
    caption: "Ciudades guarnición", rank: true, maxHeight: 250, search: "Buscar ciudades",
    searchText: (g) => g.row.name,
    columns: [
      { key: "name", label: "Ciudad", align: "l", width: "minmax(0,1.8fr)", value: (g) => g.row.name, html: (g) => `${esc(g.row.name)} <span class="sub">${esc(g.row.sub)}</span>`, tip: (g) => `${g.row.name}: ${(g.installations || []).map((id) => instByKey.get(id)?.name || id).join(", ")}` },
      { key: "tier", label: "Rango", align: "l", width: "minmax(0,.8fr)", value: (g) => (g.tier === "fortress" ? 0 : 1), text: (g) => `${g.tier === "fortress" ? "Plaza fuerte" : "Guarnición"}${g.naval ? " ⚓" : ""}` },
      { key: "af", label: "Efectivos", value: (g) => g.armed_forces, text: (g) => count3(g.armed_forces), title: "Efectivos residentes estimados (16+)" },
      { key: "share", label: "% pob.", value: (g) => g.share, text: (g) => pct(g.share), title: "Proporción sobre residentes de 16+ años", bar: { max: Math.max(...garrisons.map((g) => g.share || 0), 0.01), color: "rgba(135,150,171,.35)" } },
    ],
    rows: garrisons, sort: { key: "share", dir: "desc" },
    onHover: (g) => link.hover(g ? rowsHighlight(metros, [g.row]) : null),
    onClick: (g) => metros.focus(g.row),
  });
  gBody.insertAdjacentHTML("beforeend", `<p class="adv-note">⚓ naval: predominan bases de la Marina de Guerra del Perú (Callao, Paita, Iquitos, Puno, Chimbote).</p>`);

  const rBody = section(el, { title: "Zonas operativas y polígonos de entrenamiento", note: esc(mil.rules?.ranges || "") });
  const ranges = (mil.ranges || []).map((r) => ({ ...r, key: r.id }));
  const rTable = createTable(rBody, {
    caption: "Zonas operativas militares", rank: true, maxHeight: 240,
    columns: [
      { key: "name", label: "Zona / Polígono", align: "l", width: "minmax(0,2fr)", value: (r) => r.name, html: (r) => `<i class="dot" style="background:${esc(compById.get(r.component)?.color || "#999")}"></i>${esc(r.name)}` },
      { key: "state", label: "Reg.", align: "l", width: "40px", value: (r) => r.state, text: (r) => r.state || "–" },
      { key: "area", label: "Área", width: "minmax(0,.9fr)", value: (r) => r.area_km2, text: (r) => `${count3(r.area_km2)} km²`, bar: { max: Math.max(...ranges.map((r) => r.area_km2 || 0), 1), color: "rgba(194,74,62,.3)" } },
    ],
    rows: ranges, sort: { key: "area", dir: "desc" },
    onHover: (r) => link.hover(r ? { cells: new Set(r.cells || []), dimOthers: true, color: "#f09a7f", label: r.name } : null),
    onClick: (r) => { const b = app.highlightBounds({ cells: new Set(r.cells || []) }); if (b) frameBox(app, b, { pad: 60, maxScale: 2.6 }); },
  });

  const vBody = section(el, {
    title: "Licenciados de las FF.AA. y efectivos residentes",
    note: `Estimación territorial de licenciados del servicio militar y efectivos activos residentes (${esc(vint.acs || data.countyVintage)}).`,
  });
  let vLevel = "states";
  const vCtl = mk("div", "adv-row");
  vBody.appendChild(vCtl);
  segmented(vCtl, {
    label: "Ámbito", value: vLevel,
    options: [{ value: "states", label: "Departamentos" }, { value: "metros", label: "Ciudades" }, ...(counties ? [{ value: "counties", label: "Provincias" }] : [])],
    onChange: (v) => { vLevel = v; vTable.setRows(vRows()); },
  });
  const vRows = () => data.levels[vLevel].rows.filter((r) => fin(r.v.veterans_pct) && (vLevel !== "counties" || (r.v.population || 0) >= 10000));
  const vTable = createTable(vBody, {
    caption: "Licenciados y efectivos residentes", rank: true, maxHeight: 260, search: "Buscar lugares",
    columns: [
      { key: "name", label: "Lugar", align: "l", width: "minmax(0,1.7fr)", value: (r) => r.name, html: (r) => `${esc(r.name)}${r.level !== "states" && r.sub ? ` <span class="sub">${esc(r.sub)}</span>` : ""}` },
      { key: "veterans", label: "Licenciados", value: (r) => r.v.veterans, text: (r) => count3(r.v.veterans) },
      { key: "veterans_pct", label: "% Lic.", value: (r) => r.v.veterans_pct, text: (r) => pct(r.v.veterans_pct), bar: { max: 0.05, color: "rgba(135,150,171,.35)" }, title: "Licenciados sobre población adulta" },
      { key: "armed_forces_pct", label: "% Efect.", value: (r) => r.v.armed_forces_pct, text: (r) => pct(r.v.armed_forces_pct), title: "Efectivos activos sobre población 16+" },
    ],
    rows: vRows(), sort: { key: "armed_forces_pct", dir: "desc" },
    onHover: (r) => link.hover(r ? rowsHighlight(data.levels[vLevel], [r]) : null),
    onClick: (r) => data.levels[vLevel].focus(r),
  });

  el.insertAdjacentHTML("beforeend", sourcesHtml(data, ["peru_socioeconomic", "peru_boundaries"], [
    esc(mil.caveats || ""),
    "Las sedes corresponden a cuarteles generales, bases navales/fluviales, bases aéreas y comandos conjuntos públicos (EP, MGP, FAP, CCFFAA).",
    "El presupuesto sectorial refleja las asignaciones institucionales del Pliego Defensa (MEF Consulta Amigable) distribuidas según presencia operativa regional.",
  ].filter(Boolean)));

  const bubbles = ctx.bubbles("bases", {
    rMax: 14, minR: 2.6, alpha: 0.6,
    tip: (b) => {
      const it = b.it, c = compById.get(it.component);
      return `<b>${esc(it.name)}</b><br>${esc(c?.name || it.component)} · ${esc(TIER_LABEL[it.tier] || it.tier)}${fin(it.area_km2) ? ` · ${count3(it.area_km2)} km²` : ""}${it.state ? ` · ${esc(it.state)}` : ""}`;
    },
    onHover: (b) => {
      instTable.setHot(b ? b.key : null);
      link.hover(b && b.it.cells?.length ? { cells: new Set(b.it.cells), noBeacon: true } : null);
    },
    onClick: (b) => { instTable.setHot(b.key); flyTo(b.it); },
  });

  function visible() {
    return insts.filter((it) => st.comps.has(it.component) && (st.tier === "all" || it.tier === "major" || (st.tier === "big" && it.tier === "base")) && (!st.state || it.state === st.state));
  }
  function setState(abbr, fly = false) {
    st.state = abbr;
    stacks?.setSelected(abbr);
    if (!abbr) stacks?.setSelected(null);
    apply();
    drawDetail();
    const i = abbr ? stateIdx(abbr) : null;
    if (i != null && fly) {
      const b = app.highlightBounds({ states: new Set([i]) });
      if (b) frameBox(app, b, { pad: 30, maxScale: 2.6 });
    }
  }
  function apply() {
    const vis = visible();
    instTable.setRows(vis);
    bubbles.set(vis.map((it) => ({ key: it.key, x: it.x, y: it.y, value: fin(it.area_km2) ? Math.min(AREA_CAP, it.area_km2) : 0, color: compById.get(it.component)?.color || "#999", it })), { vMax: AREA_CAP });
    const i = st.state ? stateIdx(st.state) : null;
    link.base(i != null ? { states: new Set([i]), dimOthers: true } : null);
    stateChip.innerHTML = st.state
      ? `<span class="adv-fchip">Departamento: <b>${esc(stateName(st.state))}</b> · ${int(vis.length)} sedes<button type="button" data-clear-state aria-label="Quitar filtro de departamento">✕</button></span>`
      : "";
  }
  drawStates();
  apply();

  return {
    onMapHover(h) {
      const owner = h.cell >= 0 ? app.w.raw.owner[h.cell] : -1;
      const abbr = owner >= 0 ? stLevel.rows[owner]?.key : null;
      stacks?.setHot(abbr || null);
      const r = h.cell >= 0 ? cellRange.get(h.cell) : null;
      rTable.setHot(r ? r.id : null, !!r);
      const inst = h.item?.kind === "fort" ? instByKey.get(h.item.data?.id) : h.cell >= 0 ? cellInst.get(h.cell) : null;
      if (inst) instTable.setHot(inst.key);
      if (h.item?.kind === "range") rTable.setHot(h.item.data?.id ?? null);
      const m = h.cell >= 0 ? metros.rowAtCell(h.cell) : null;
      gTable.setHot(m && mil.cities?.[m.key] ? m.key : null, false);
      const vr = h.cell >= 0 ? data.levels[vLevel]?.rowAtCell(h.cell) : null;
      vTable.setHot(vr ? vr.key : null, false);
    },
    onMapClick(ev) {
      const fort = ev.item?.kind === "fort" ? instByKey.get(ev.item.data?.id) : null;
      if (fort) { instTable.setHot(fort.key); flyTo(fort); return true; }
      if (ev.city || ev.state == null) return false;
      const abbr = stLevel.rows[ev.state]?.key;
      if (!abbr) return false;
      setState(st.state === abbr ? null : abbr);
      return true;
    },
    onEscape() {
      if (st.state) { setState(null); return true; }
      return false;
    },
  };
}

const STATUS = { act: "Activa", semi: "Semiactiva", care: "En reserva" };
