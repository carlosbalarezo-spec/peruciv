// Asesor de Prosperidad y Vivienda: ingresos familiares, valor de vivienda, pobreza monetaria, alquileres y desempleo.
import { esc, fin, colorScale, RAMPS } from "../core/util.js";
import { money, dollars, pct, int, count3, fmtShort } from "../core/fmt.js";
import { barList, histogram, rampLegend } from "../core/charts.js";
import { createTable } from "../core/table.js";
import { createScatter } from "../core/scatter.js";
import { section, tiles, segmented, lensButton, sourcesHtml, topBy, frameBtn } from "../core/view.js";
import { rowsHighlight } from "../core/data.js";

const METRO_MIN = 250000;
const BIG_METRO = 500000;

export function mount(ctx) {
  const { app, data, el, link } = ctx;
  const n = data.nat;
  const { states, metros, counties } = data.levels;

  el.insertAdjacentHTML("beforeend", tiles([
    { label: "Ingreso anual", value: dollars(n.median_income), sub: "por hogar (USD equiv.)" },
    { label: "Valor ref. vivienda", value: money(n.home_value), sub: `${(n.home_value / n.median_income).toFixed(1)}× el ingreso` },
    { label: "Desempleo", value: pct(n.unemployment), sub: data.vintage },
  ]));

  const aBody = section(el, {
    title: "Vivienda frente a ingresos",
    note: "Valor referencial de la vivienda frente al ingreso familiar anual (equivalente en USD). Las líneas punteadas marcan 3, 5 y 8 años de ingreso íntegro: por encima, acceder a una vivienda propia es más costoso. Arrastra un rectángulo para seleccionar en el mapa.",
  });
  const aCtl = document.createElement("div");
  aCtl.className = "adv-row";
  aBody.appendChild(aCtl);
  let level = counties ? "counties" : "metros";
  segmented(aCtl, { label: "Ámbito", value: level, options: [...(counties ? [{ value: "counties", label: "Provincias" }] : []), { value: "metros", label: "Ciudades" }], onChange: (v) => { level = v; drawAfford(); } });
  for (const [id, label] of [["income", "Lente de ingresos"], ["home", "Lente de vivienda"]]) {
    const b = lensButton(app, id, label);
    if (b) aCtl.appendChild(b);
  }
  const ratioDomain = [2, 10];
  const ratioColor = colorScale({ type: "seq", domain: ratioDomain, ramp: RAMPS.heat });
  const lv = () => data.levels[level];
  const inc = (r) => (level === "counties" ? r.v.income : r.v.median_income);
  const ratioOf = (r) => (fin(r.v.home_value) && fin(inc(r)) && inc(r) > 0 ? r.v.home_value / inc(r) : null);
  const scatter = createScatter(aBody, {
    height: 310, points: [],
    x: { label: "Ingreso familiar anual", fmt: money, log: true },
    y: { label: "Valor de vivienda", fmt: money, log: true },
    size: { label: "Población", fmt: count3, max: 14, min: 1.4 },
    refLines: [{ k: 3, label: "3×" }, { k: 5, label: "5×" }, { k: 8, label: "8×" }],
    color: (c) => ratioColor(c), colorLabel: "Vivienda ÷ ingreso", colorFmt: (v) => `×${(+v).toFixed(1)}`,
    onHover: (p) => { link.hover(p ? rowsHighlight(lv(), [p.row]) : null); affTable.setHot(p ? p.key : null, false); },
    onClick: (p) => lv().focus(p.row),
    onBrush: (set) => {
      const sel = set ? lv().rows.filter((r) => set.has(r.key)) : [];
      link.base(sel.length ? rowsHighlight(lv(), sel, { dim: true }) : null, { frame: sel.length > 1 });
      affTable.setSelected(set);
      selInfo.innerHTML = sel.length ? `<b>${int(sel.length)}</b> ${level === "counties" ? "provincias" : "ciudades"} seleccionadas · ${count3(sel.reduce((a, r) => a + (r.v.population || 0), 0))} hab. ${frameBtn()}<button type="button" class="adv-mini" data-clear>Limpiar</button>` : "";
    },
  });
  aBody.insertAdjacentHTML("beforeend", rampLegend({ ramp: RAMPS.heat, domain: ratioDomain, fmt: (v) => `×${v}`, label: "Valor de vivienda ÷ ingreso anual" }));
  const selInfo = document.createElement("div");
  selInfo.className = "adv-brushinfo";
  aBody.appendChild(selInfo);
  const clearSel = () => { scatter.setSelected(null); affTable.setSelected(null); link.base(null); selInfo.innerHTML = ""; };
  selInfo.addEventListener("click", (e) => { if (e.target.closest("[data-clear]")) clearSel(); });
  aBody.insertAdjacentHTML("beforeend", `<h4 class="adv-h4">Tabla de accesibilidad habitacional</h4>`);
  const affTable = createTable(aBody, {
    caption: "Relación vivienda / ingreso", rank: true, maxHeight: 260, rows: [], search: "Buscar lugares",
    columns: [
      { key: "name", label: "Lugar", align: "l", value: (r) => r.name, html: (r) => `${esc(r.name)} <span class="sub">${esc(r.sub)}</span>` },
      { key: "inc", label: "Ingreso", value: inc, text: (r) => money(inc(r)) },
      { key: "home", label: "Vivienda", value: (r) => r.v.home_value, text: (r) => money(r.v.home_value) },
      { key: "ratio", label: "Razón", value: (r) => ratioOf(r), html: (r) => fin(ratioOf(r)) ? `<span class="dot" style="background:${ratioColor(ratioOf(r))}"></span>×${ratioOf(r).toFixed(1)}` : "–" },
    ],
    sort: { key: "ratio", dir: "desc" },
    onHover: (r) => { link.hover(r ? rowsHighlight(lv(), [r]) : null); scatter.setHot(r ? r.key : null); },
    onClick: (r) => lv().focus(r),
  });
  function drawAfford() {
    clearSel();
    const rows = lv().rows.filter((r) => fin(ratioOf(r)));
    scatter.update({
      points: rows.map((r) => ({ key: r.key, x: inc(r), y: r.v.home_value, s: r.v.population, c: ratioOf(r), label: r.name, sub: r.sub, row: r })),
      labels: topBy(rows, (r) => r.v.population, { n: 6 }).map((x) => x.r.key),
    });
    affTable.setRows(rows);
  }
  drawAfford();

  let povHist = null;
  if (counties) {
    const pBody = section(el, {
      title: "Pobreza monetaria",
      note: "Las 196 provincias según el porcentaje de población bajo la línea oficial de pobreza monetaria (INEI ENAHO). Pasa el cursor sobre una barra para contornear esas provincias en el mapa.",
    });
    const pCtl = document.createElement("div");
    pCtl.className = "adv-row";
    pBody.appendChild(pCtl);
    const lb = lensButton(app, "poverty", "Lente de pobreza monetaria");
    if (lb) pCtl.appendChild(lb);
    const pHost = document.createElement("div");
    pBody.appendChild(pHost);
    const pePov = (() => {
      let a = 0, w = 0;
      for (const r of counties.rows) if (fin(r.v.poverty) && fin(r.v.population)) { a += r.v.poverty * r.v.population; w += r.v.population; }
      return w ? a / w : null;
    })();
    povHist = histogram(pHost, {
      values: counties.rows.map((r) => ({ key: r.key, v: r.v.poverty, w: r.v.population })), bins: 26, domain: [0, 0.65], height: 120,
      fmt: (v) => fmtShort("pct", v), unitLabel: "provincias", label: "Histograma de pobreza monetaria provincial",
      colorOf: (_, t) => colorScale({ type: "seq", domain: [0, 1], ramp: RAMPS.heat })(t),
      markers: fin(pePov) ? [{ v: pePov, label: `Perú ${pct(pePov)}` }] : [],
      onHover: (bin) => link.hover(bin ? rowsHighlight(counties, bin.keys.map((k) => counties.byKey.get(k)), { dim: true }) : null),
    });
    const povTable = createTable(pBody, {
      caption: "Pobreza monetaria por provincia", rank: true, maxHeight: 240, rows: counties.rows.filter((r) => fin(r.v.poverty)), search: "Buscar provincias",
      columns: [
        { key: "name", label: "Provincia", align: "l", value: (r) => r.name, html: (r) => `${esc(r.name)} <span class="sub">${esc(r.sub)}</span>` },
        { key: "population", label: "Hab.", value: (r) => r.v.population, text: (r) => count3(r.v.population) },
        { key: "poverty", label: "Pobreza", value: (r) => r.v.poverty, text: (r) => pct(r.v.poverty), bar: { max: 0.65, color: "rgba(232,119,74,.4)" } },
        { key: "income", label: "Ingreso", value: (r) => r.v.income, text: (r) => money(r.v.income) },
      ],
      sort: { key: "poverty", dir: "desc" },
      onHover: (r) => link.hover(r ? rowsHighlight(counties, [r]) : null),
      onClick: (r) => counties.focus(r),
    });
    ctx.cleanup(() => povTable.destroy());
  }

  const rBody = section(el, {
    title: "Carga de alquiler en ciudades",
    note: `Alquiler mensual estimado × 12 ÷ ingreso familiar anual, en ciudades de ${count3(METRO_MIN)}+ habitantes.`,
  });
  const rentRows = (list) => list.map((x) => ({ key: x.r.key, label: x.r.name, sub: `${dollars(x.r.v.median_rent)}/mes`, value: x.v, text: pct(x.v), row: x.r }));
  const rOpts = { onHover: (r) => link.hover(r ? rowsHighlight(metros, [r.row]) : null), onClick: (r) => metros.focus(r.row) };
  const hi = topBy(metros.rows, (r) => r.v.rent_burden, { n: 10, min: METRO_MIN });
  const lo = topBy(metros.rows, (r) => r.v.rent_burden, { n: 5, min: METRO_MIN, asc: true });
  const rmax = Math.max(...hi.map((x) => x.v));
  rBody.insertAdjacentHTML("beforeend", `<h4 class="adv-h4">Mayor carga relativa</h4>`);
  barList(rBody, { ...rOpts, rows: rentRows(hi), max: rmax, ariaLabel: "Mayor carga de alquiler" });
  rBody.insertAdjacentHTML("beforeend", `<h4 class="adv-h4">Menor carga relativa</h4>`);
  barList(rBody, { ...rOpts, rows: rentRows(lo), max: rmax, ariaLabel: "Menor carga de alquiler" });

  const uBody = section(el, { title: "Desempleo abierto", note: `Desocupados ÷ población económicamente activa (${esc(data.vintage)}). En ciudades se muestran áreas de ${count3(BIG_METRO)}+ hab.` });
  const uHost = document.createElement("div");
  let uLevel = "states";
  segmented(uBody, { label: "Áreas", value: uLevel, options: [{ value: "states", label: "Departamentos" }, { value: "metros", label: "Grandes ciudades" }], onChange: (v) => { uLevel = v; drawU(); } });
  uBody.appendChild(uHost);
  function drawU() {
    uHost.innerHTML = "";
    const lvU = uLevel === "states" ? states : metros;
    const min = uLevel === "states" ? 0 : BIG_METRO;
    const high = topBy(lvU.rows, (r) => r.v.unemployment, { n: 8, min });
    const low = topBy(lvU.rows, (r) => r.v.unemployment, { n: 8, min, asc: true });
    const max = Math.max(...high.map((x) => x.v));
    const mk = (list) => list.map((x) => ({ key: x.r.key, label: x.r.name, sub: uLevel === "metros" ? x.r.sub : "", value: x.v, text: pct(x.v), tone: x.v > n.unemployment * 1.03 ? "bad" : x.v < n.unemployment * 0.97 ? "good" : null, row: x.r }));
    const o = { max, onHover: (r) => link.hover(r ? rowsHighlight(lvU, [r.row]) : null), onClick: (r) => lvU.focus(r.row) };
    uHost.insertAdjacentHTML("beforeend", `<h4 class="adv-h4">Mayor tasa</h4>`);
    barList(uHost, { ...o, rows: mk(high) });
    uHost.insertAdjacentHTML("beforeend", `<h4 class="adv-h4">Menor tasa</h4>`);
    barList(uHost, { ...o, rows: mk(low) });
  }
  drawU();

  el.insertAdjacentHTML("beforeend", sourcesHtml(data, ["peru_socioeconomic", "mtpe_employment"], [
    "Los ingresos familiares y gastos de vivienda provienen de la Encuesta Nacional de Hogares (ENAHO / INEI), convertidos a dólares corrientes equivalentes.",
    "La pobreza monetaria mide si el gasto per cápita del hogar alcanza el costo de la canasta básica regional definida por el INEI.",
    "En el Perú rural el desempleo abierto suele ser bajo debido a la alta ocupación en agricultura familiar e informalidad; conviene leerlo junto a pobreza e ingresos.",
  ]));

  return {
    onMapHover(h) {
      const l = lv();
      const r = h.cell >= 0 ? l.rowAtCell(h.cell) : null;
      scatter.setHot(r ? r.key : null);
      affTable.setHot(r ? r.key : null);
      if (povHist && counties) {
        const c = h.cell >= 0 ? counties.rowAtCell(h.cell) : null;
        povHist.setHot(c ? povHist.binOf(c.v.poverty)?.i ?? null : null);
      }
    },
    onEscape() {
      if (scatter.selected) { clearSel(); return true; }
      return false;
    },
  };
}
