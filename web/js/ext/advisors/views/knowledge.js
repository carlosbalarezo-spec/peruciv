// Asesor de Conocimiento: educación superior, conectividad a internet en el hogar y empleo en Ciencia.
import { esc, fin, ratio, colorScale, robustDomain, RAMPS } from "../core/util.js";
import { money, pct, int, count3, fmtShort } from "../core/fmt.js";
import { barList, histogram, rampLegend } from "../core/charts.js";
import { createTable } from "../core/table.js";
import { createScatter } from "../core/scatter.js";
import { section, tiles, segmented, mapPicker, frameBtn, sourcesHtml, topBy } from "../core/view.js";
import { rowsHighlight } from "../core/data.js";
import { scienceLens } from "../core/lenses.js";

const METRO_MIN = 250000;

export function mount(ctx) {
  const { app, data, el, link } = ctx;
  const n = data.nat;
  const nation = app.data.nation;
  const { metros, counties } = data.levels;
  const sci = nation.yields?.find((y) => y.key === "science");
  const usSci = n.yields?.science;
  const usShare = ratio(usSci, n.employed);
  const wavg = (k) => {
    if (!counties) return null;
    let a = 0, w = 0;
    for (const r of counties.rows) if (fin(r.v[k]) && fin(r.v.population)) { a += r.v[k] * r.v.population; w += r.v.population; }
    return w ? a / w : null;
  };

  el.insertAdjacentHTML("beforeend", tiles([
    { label: "Ocupados en Ciencia", value: count3(usSci), sub: `${pct(usShare)} de los ocupados`, color: sci?.color },
    { label: "Educación superior", value: pct(wavg("bachelors")), sub: "adultos con ed. univ./técnica" },
    { label: "Internet en el hogar", value: pct(wavg("broadband")), sub: "hogares conectados (ENAHO)" },
  ]));

  const mapRow = document.createElement("div");
  mapRow.className = "adv-sec adv-mapsec";
  el.appendChild(mapRow);
  const picker = mapPicker(ctx, mapRow, {
    value: counties ? "bachelors" : "science",
    options: [
      ...(counties ? [{ value: "bachelors", label: "Ed. superior", lens: () => "bachelors" }] : []),
      { value: "science", label: "Empleo Ciencia", lens: () => scienceLens(data) },
      ...(counties ? [{ value: "broadband", label: "Internet", lens: () => "broadband" }] : []),
      { value: "terrain", label: "Terreno", lens: () => null },
    ],
  });

  const sBody = section(el, {
    title: "Fuerza laboral en Ciencia",
    note: `${esc(sci?.description || "Ocupados en servicios profesionales, científicos, técnicos, TI y educación superior.")} La clasificación proporcional filtra ciudades de ${count3(METRO_MIN)}+ hab.`,
  });
  const sHost = document.createElement("div");
  let mode = "share";
  segmented(sBody, { label: "Ordenar por", value: mode, options: [{ value: "share", label: "% del empleo" }, { value: "abs", label: "Total ocupados" }], onChange: (v) => { mode = v; drawSci(); } });
  const sMap = document.createElement("button");
  sMap.type = "button";
  sMap.className = "adv-mini";
  sMap.textContent = "Colorear mapa por empleo en ciencia";
  sMap.addEventListener("click", () => picker.set("science"));
  sBody.querySelector(".adv-seg")?.after(sMap);
  sBody.appendChild(sHost);
  const share = (r) => ratio(r.v.y_science, r.v.employed);
  function drawSci() {
    sHost.innerHTML = "";
    const list = mode === "abs" ? topBy(metros.rows, (r) => r.v.y_science, { n: 12 }) : topBy(metros.rows, share, { n: 12, min: METRO_MIN });
    barList(sHost, {
      rank: true, ariaLabel: "Ciudades líderes en ciencia",
      rows: list.map((x) => ({ key: x.r.key, label: x.r.name, sub: mode === "abs" ? pct(share(x.r)) : `×${(share(x.r) / usShare).toFixed(2)} Perú`, value: x.v, text: mode === "abs" ? count3(x.v) : pct(x.v), color: sci?.color, row: x.r })),
      onHover: (r) => link.hover(r ? rowsHighlight(metros, [r.row]) : null),
      onClick: (r) => metros.focus(r.row),
    });
  }
  drawSci();

  if (!counties) {
    el.insertAdjacentHTML("beforeend", `<p class="adv-empty pad">counties.json no está disponible.</p>`);
    el.insertAdjacentHTML("beforeend", sourcesHtml(data, ["peru_socioeconomic"], []));
    return {};
  }

  const dBody = section(el, {
    title: "Educación superior e ingresos",
    note: "Proporción de adultos con educación superior frente al ingreso familiar anual; el color indica hogares con internet. Arrastra para seleccionar en el mapa.",
  });
  const dCtl = document.createElement("div");
  dCtl.className = "adv-row";
  dBody.appendChild(dCtl);
  let level = "counties";
  segmented(dCtl, { label: "Ámbito", value: level, options: [{ value: "counties", label: "Provincias" }, { value: "metros", label: "Ciudades" }], onChange: (v) => { level = v; drawDeg(); } });
  const lv = () => data.levels[level];
  const inc = (r) => (level === "counties" ? r.v.income : r.v.median_income);
  const bbDom = robustDomain(counties.rows.map((r) => r.v.broadband), 0.02) || [0.15, 0.85];
  const bbColor = colorScale({ type: "seq", domain: bbDom, ramp: RAMPS.seq });
  const scatter = createScatter(dBody, {
    height: 300, points: [],
    x: { label: "Adultos con educación superior", fmt: (v) => fmtShort("pct", v) },
    y: { label: "Ingreso familiar anual", fmt: money, log: true },
    size: { label: "Población", fmt: count3, max: 14, min: 1.4 },
    color: (c) => bbColor(c), colorLabel: "Internet", colorFmt: (v) => pct(v),
    onHover: (p) => link.hover(p ? rowsHighlight(lv(), [p.row]) : null),
    onClick: (p) => lv().focus(p.row),
    onBrush: (set) => {
      const sel = set ? lv().rows.filter((r) => set.has(r.key)) : [];
      link.base(sel.length ? rowsHighlight(lv(), sel, { dim: true }) : null, { frame: sel.length > 1 });
      selInfo.innerHTML = sel.length ? `<b>${int(sel.length)}</b> ${level === "counties" ? "provincias" : "ciudades"} · ${count3(sel.reduce((a, r) => a + (r.v.population || 0), 0))} hab. ${frameBtn()}<button type="button" class="adv-mini" data-clear>Limpiar</button>` : "";
    },
  });
  dBody.insertAdjacentHTML("beforeend", rampLegend({ ramp: RAMPS.seq, domain: bbDom, fmt: (v) => fmtShort("pct", v), label: "Hogares con conexión a internet" }));
  const selInfo = document.createElement("div");
  selInfo.className = "adv-brushinfo";
  dBody.appendChild(selInfo);
  const clearSel = () => { scatter.setSelected(null); link.base(null); selInfo.innerHTML = ""; };
  selInfo.addEventListener("click", (e) => { if (e.target.closest("[data-clear]")) clearSel(); });
  function drawDeg() {
    clearSel();
    const rows = lv().rows;
    scatter.update({
      points: rows.map((r) => ({ key: r.key, x: r.v.bachelors, y: inc(r), s: r.v.population, c: r.v.broadband, label: r.name, sub: r.sub, row: r })),
      labels: topBy(rows, (r) => r.v.population, { n: 6 }).map((x) => x.r.key),
    });
  }
  drawDeg();

  const bBody = section(el, {
    title: "Brecha digital provincial",
    note: "Provincias según el porcentaje de hogares con acceso a internet fijo o móvil en el hogar (ENAHO 2025). Ordenadas de menor a mayor conectividad.",
  });
  const bHost = document.createElement("div");
  bBody.appendChild(bHost);
  const bbHist = histogram(bHost, {
    values: counties.rows.map((r) => ({ key: r.key, v: r.v.broadband })), bins: 26, domain: [0.05, 0.95], height: 120,
    fmt: (v) => fmtShort("pct", v), unitLabel: "provincias", label: "Histograma de conectividad provincial",
    colorOf: (_, t) => colorScale({ type: "seq", domain: [0, 1], ramp: RAMPS.seq })(t),
    onHover: (bin) => link.hover(bin ? rowsHighlight(counties, bin.keys.map((k) => counties.byKey.get(k)), { dim: true }) : null),
  });
  createTable(bBody, {
    caption: "Conectividad a internet por provincia", rank: true, maxHeight: 240, search: "Buscar provincias",
    rows: counties.rows.filter((r) => fin(r.v.broadband)),
    columns: [
      { key: "name", label: "Provincia", align: "l", value: (r) => r.name, html: (r) => `${esc(r.name)} <span class="sub">${esc(r.sub)}</span>` },
      { key: "population", label: "Hab.", value: (r) => r.v.population, text: (r) => count3(r.v.population) },
      { key: "broadband", label: "Internet", value: (r) => r.v.broadband, text: (r) => pct(r.v.broadband), bar: { max: 1, color: "rgba(74,134,214,.4)" } },
      { key: "bachelors", label: "Ed. sup.", value: (r) => r.v.bachelors, text: (r) => pct(r.v.bachelors) },
    ],
    sort: { key: "broadband", dir: "asc" },
    onHover: (r) => link.hover(r ? rowsHighlight(counties, [r]) : null),
    onClick: (r) => counties.focus(r),
  });

  el.insertAdjacentHTML("beforeend", sourcesHtml(data, ["peru_socioeconomic", "sunedu_universities"], [
    "Los trabajadores en Ciencia agrupan servicios profesionales, científicos, técnicos, telecomunicaciones/TI y docencia superior (INEI / MTPE).",
    "El acceso a internet en el hogar proviene del Módulo 100 de ENAHO 2025 (INEI).",
    "Las universidades licenciadas y su inversión en investigación pueden explorarse también en el asesor de Cultura y Peligros.",
  ]));

  return {
    onMapHover(h) {
      const r = h.cell >= 0 ? lv().rowAtCell(h.cell) : null;
      scatter.setHot(r ? r.key : null);
      const c = h.cell >= 0 ? counties.rowAtCell(h.cell) : null;
      bbHist.setHot(c ? bbHist.binOf(c.v.broadband)?.i ?? null : null);
    },
    onEscape() {
      if (scatter.selected) { clearSel(); return true; }
      return false;
    },
  };
}
