// Asesor de Economía: PBI por actividad económica, ciudades líderes, especialización sectorial y crecimiento vs. producción.
import { esc, fin, ratio, colorScale, robustDomain, RAMPS } from "../core/util.js";
import { money, dollars, pct, int, signedPct, count3, fmtShort } from "../core/fmt.js";
import { barList, rampLegend, sizeLegend } from "../core/charts.js";
import { createTable } from "../core/table.js";
import { createScatter } from "../core/scatter.js";
import { section, tiles, segmented, selectBox, sourcesHtml, frameBtn } from "../core/view.js";
import { rowsHighlight } from "../core/data.js";
import { icon } from "../../../ui/icon.js";
import { hasIcon } from "../../../icons.js";

export const METRO_MIN = 250000;
const short = (s) => String(s || "").replace(/\s*\(.*\)\s*$/, "");
const indIcon = (k) => (hasIcon(`i-${k}`) ? icon(`i-${k}`, "•", { size: 14 }) : k === "government" ? icon("i-public_admin", "🏛", { size: 14 }) : "");

export function mount(ctx) {
  const { app, data, el, link, params } = ctx;
  const nation = app.data.nation;
  const n = nation.nation || {};
  const metros = data.levels.metros;
  const rows = metros.rows;
  const gdpInd = n.gdp_by_industry || {};
  const jobInd = Object.keys(nation.industries || {});

  const topInd = Object.entries(gdpInd).filter(([, v]) => fin(v)).sort((a, b) => b[1] - a[1])[0];
  el.insertAdjacentHTML("beforeend", tiles([
    { label: `PBI ${n.gdp_year || ""}`, value: money(n.gdp), sub: "dólares corrientes" },
    { label: "Per cápita", value: money(ratio(n.gdp, n.population)), sub: "PBI ÷ habitantes" },
    { label: "Sector líder", value: topInd ? short(nation.gdp_industries?.[topInd[0]] || topInd[0]) : "–", sub: topInd ? `${pct(topInd[1] / n.gdp)} del PBI` : "" },
  ]));

  const indBody = section(el, {
    title: "PBI por actividad económica", kicker: "Perú",
    note: "Valor agregado por cada rama de actividad (INEI). Pasa el cursor sobre un sector para resaltar los departamentos donde tiene mayor peso económico; haz clic para ver qué ciudades se especializan en él.",
  });
  const indRows = Object.entries(gdpInd).filter(([, v]) => fin(v)).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({
    key: k, label: short(nation.gdp_industries?.[k] || k), full: nation.gdp_industries?.[k], value: v, text: money(v), sub: pct(v / n.gdp), icon: indIcon(k),
  }));
  const states = app.data.states || [];
  const indBars = barList(indBody, {
    rows: indRows, ariaLabel: "PBI por actividad económica",
    onHover: (r) => {
      if (!r) return link.hover(null);
      const top = states.map((s, i) => ({ i, v: ratio(s.gdp_by_industry?.[r.key], s.gdp) })).filter((x) => fin(x.v)).sort((a, b) => b.v - a.v).slice(0, 8);
      link.hover({ states: new Set(top.map((x) => x.i)), dimOthers: true });
    },
    onClick: (r) => { setIndustry(r.key === "government" ? "public_admin" : r.key); specBody.scrollIntoView({ behavior: "smooth", block: "start" }); },
  });

  const mapBody = section(el, {
    title: "Economía urbana en el mapa",
    note: "Cada círculo representa una ciudad: su área equivale al PBI total y su color al PBI per cápita. Pasa el cursor para ver cifras; haz clic para abrir la ciudad.",
  });
  const ppDomain = robustDomain(rows.filter((r) => r.v.population >= 100000).map((r) => r.v.gdp_pc), 0.03, true) || [3000, 15000];
  const ppColor = colorScale({ type: "seq", domain: ppDomain, ramp: RAMPS.gold });
  const gMax = Math.max(...rows.map((r) => r.v.gdp || 0));
  const bubbles = ctx.bubbles("gdp", {
    rMax: 30, minR: 1.5, alpha: 0.6,
    tip: (b) => `<b>${esc(b.row.name)}</b> <span class="sub">${esc(b.row.sub)}</span><br>PBI <b>${money(b.row.v.gdp)}</b> · per cápita <b>${money(b.row.v.gdp_pc)}</b><br>${count3(b.row.v.population)} hab.`,
    onHover: (b) => { table.setHot(b ? b.key : null); scatter.setHot(b ? b.key : null); link.hover(b ? rowsHighlight(metros, [b.row]) : null); },
    onClick: (b) => app.selectCity(b.row.ref),
  });
  const bubbleItems = rows.filter((r) => fin(r.v.gdp)).map((r) => ({ key: r.key, x: app.w.grid.cx(r.ref.cell), y: app.w.grid.cy(r.ref.cell), value: r.v.gdp, color: ppColor(r.v.gdp_pc), row: r }));
  bubbles.set(bubbleItems, { vMax: gMax });
  const showBubbles = document.createElement("label");
  showBubbles.className = "adv-check";
  showBubbles.innerHTML = `<input type="checkbox" checked> Mostrar círculos de PBI en el mapa`;
  showBubbles.querySelector("input").addEventListener("change", (e) => bubbles.set(e.target.checked ? bubbleItems : [], { vMax: gMax }));
  mapBody.appendChild(showBubbles);
  mapBody.insertAdjacentHTML("beforeend", rampLegend({ ramp: RAMPS.gold, domain: ppDomain, fmt: money, label: "PBI per cápita" })
    + sizeLegend([1e9, 1e10, 1e11].filter((v) => v <= gMax), (v) => 30 * Math.sqrt(v / gMax), money, "Área del círculo = PBI (en vista inicial)"));

  const lBody = section(el, {
    title: "Ciudades líderes",
    note: `El PBI per cápita y crecimiento clasifican ciudades de ${count3(METRO_MIN)}+ habitantes (las localidades pequeñas con un gran yacimiento o planta oscilan mucho).`,
  });
  const big = rows.filter((r) => (r.v.population || 0) >= METRO_MIN);
  segmented(lBody, {
    label: "Ordenar por", value: "gdp",
    options: [{ value: "gdp", label: "Mayor PBI" }, { value: "gdp_pc", label: "PBI per cápita" }, { value: "growth", label: "Mayor crecimiento" }],
    onChange: (v) => { table.setRows(v === "gdp" ? rows : big); table.setColumns(cols, { key: v, dir: "desc" }); },
  });
  const cols = [
    { key: "name", label: "Ciudad", align: "l", value: (r) => r.name, html: (r) => `${esc(r.name)} <span class="sub">${esc(r.sub)}</span>` },
    { key: "gdp", label: "PBI", value: (r) => r.v.gdp, text: (r) => money(r.v.gdp), bar: { max: gMax, color: "rgba(224,181,76,.35)" } },
    { key: "gdp_pc", label: "Per cápita", value: (r) => r.v.gdp_pc, text: (r) => money(r.v.gdp_pc) },
    { key: "growth", label: "Crecim.", value: (r) => r.v.growth, text: (r) => signedPct(r.v.growth) },
  ];
  const table = createTable(lBody, {
    caption: "Ciudades por PBI", columns: cols, rows, sort: { key: "gdp", dir: "desc" }, rank: true, maxHeight: 280,
    search: "Buscar ciudades",
    onHover: (r) => { link.hover(r ? rowsHighlight(metros, [r]) : null); bubbles.setHot(r ? r.key : null); scatter.setHot(r ? r.key : null); },
    onClick: (r) => app.selectCity(r.ref),
  });

  const specBody = section(el, {
    title: "Especialización productiva",
    note: `Cociente de localización (LQ): proporción de ocupados de la ciudad en el sector ÷ proporción nacional del Perú. ×2 significa el doble de concentración que el país. Ciudades de ${count3(METRO_MIN)}+ hab.; las más especializadas se resaltan en el mapa.`,
  });
  let industry = params.industry && jobInd.includes(params.industry) ? params.industry : "manufacturing";
  const indSel = selectBox(specBody, {
    label: "Sector", value: industry,
    options: jobInd.map((k) => ({ value: k, label: short(nation.industries[k]) })),
    onChange: (v) => setIndustry(v),
  });
  const specInfo = document.createElement("p");
  specInfo.className = "adv-note";
  specBody.appendChild(specInfo);
  const lq = (r, k = industry) => {
    const o = r.ref;
    const us = ratio(n.jobs?.[k], n.employed);
    return us ? ratio(ratio(o.jobs?.[k], o.employed), us) : null;
  };
  const specTable = createTable(specBody, {
    caption: "Ciudades más especializadas", rank: true, maxHeight: 260, rows: [],
    columns: [
      { key: "name", label: "Ciudad", align: "l", value: (r) => r.name, html: (r) => `${esc(r.name)} <span class="sub">${esc(r.sub)}</span>` },
      { key: "share", label: "% del empleo", value: (r) => ratio(r.ref.jobs?.[industry], r.ref.employed), text: (r) => pct(ratio(r.ref.jobs?.[industry], r.ref.employed)) },
      { key: "lq", label: "LQ", value: (r) => lq(r), text: (r) => (fin(lq(r)) ? `×${lq(r).toFixed(2)}` : "–"), bar: { max: 1, color: "rgba(74,134,214,.4)" } },
      { key: "workers", label: "Ocupados", value: (r) => r.ref.jobs?.[industry], text: (r) => count3(r.ref.jobs?.[industry]) },
    ],
    sort: { key: "lq", dir: "desc" },
    onHover: (r) => { link.hover(r ? rowsHighlight(metros, [r]) : null); scatter.setHot(r ? r.key : null); bubbles.setHot(r ? r.key : null); },
    onClick: (r) => app.selectCity(r.ref),
  });

  const scBody = section(el, {
    title: "Crecimiento frente a producción",
    note: "Cada punto es una ciudad: PBI per cápita en horizontal, crecimiento poblacional en vertical y tamaño = población. Arrastra un rectángulo para seleccionar ciudades y contornearlas en el mapa.",
  });
  const scCtl = document.createElement("div");
  scCtl.className = "adv-row";
  scBody.appendChild(scCtl);
  let colorBy = "lq", allMetros = false;
  selectBox(scCtl, {
    label: "Color", value: colorBy,
    options: [{ value: "lq", label: "Especialización (sector elegido)" }, { value: "unemployment", label: "Desempleo" }, { value: "median_income", label: "Ingreso anual" }, { value: "none", label: "Ninguno" }],
    onChange: (v) => { colorBy = v; drawScatter(); },
  });
  segmented(scCtl, { label: "Ciudades", value: "big", options: [{ value: "big", label: `${count3(METRO_MIN)}+` }, { value: "all", label: "Todas" }], onChange: (v) => { allMetros = v === "all"; drawScatter(); } });
  const legendEl = document.createElement("div");
  const scatter = createScatter(scBody, {
    points: [], height: 300,
    x: { label: "PBI per cápita", fmt: (v) => money(v), log: true },
    y: { label: "Crecimiento poblacional", fmt: (v) => fmtShort("signed", v) },
    size: { label: "Población", fmt: count3, max: 15, min: 2 },
    refY: [{ v: n.growth ?? 0, label: `Perú ${signedPct(n.growth)}` }],
    onHover: (p) => { link.hover(p ? rowsHighlight(metros, [p.row]) : null); bubbles.setHot(p ? p.key : null); table.setHot(p ? p.key : null, false); },
    onClick: (p) => app.selectCity(p.row.ref),
    onBrush: (set) => {
      const sel = set ? rows.filter((r) => set.has(r.key)) : [];
      link.base(sel.length ? rowsHighlight(metros, sel, { dim: true }) : specHighlight(), { frame: sel.length > 1 });
      bubbles.setSelected(set);
      brushInfo.innerHTML = sel.length ? brushSummary(sel) : "";
    },
  });
  scBody.appendChild(legendEl);
  const brushInfo = document.createElement("div");
  brushInfo.className = "adv-brushinfo";
  scBody.appendChild(brushInfo);
  function brushSummary(sel) {
    const pop = sel.reduce((a, r) => a + (r.v.population || 0), 0);
    const gdp = sel.reduce((a, r) => a + (r.v.gdp || 0), 0);
    return `<b>${sel.length}</b> ciudades seleccionadas · ${count3(pop)} hab. · ${money(gdp)} PBI (${pct(gdp / n.gdp)} del Perú) ${frameBtn()}<button type="button" class="adv-mini" data-clear>Limpiar</button>`;
  }
  brushInfo.addEventListener("click", (e) => { if (e.target.closest("[data-clear]")) { scatter.setSelected(null); link.base(specHighlight()); bubbles.setSelected(null); brushInfo.innerHTML = ""; } });

  function drawScatter() {
    const list = rows.filter((r) => allMetros || (r.v.population || 0) >= METRO_MIN);
    const cv = (r) => (colorBy === "lq" ? lq(r) : colorBy === "none" ? null : r.v[colorBy]);
    let color = null, legend = "";
    if (colorBy !== "none") {
      const dom = robustDomain(list.map(cv), 0.03, colorBy === "lq") || [0, 1];
      const spec = colorBy === "lq" ? { type: "seq", domain: [Math.max(0.2, dom[0]), Math.max(1.5, dom[1])], log: true, ramp: RAMPS.seq } : { type: "seq", domain: dom, ramp: colorBy === "unemployment" ? RAMPS.heat : RAMPS.gold };
      const cs = colorScale(spec);
      color = (c) => cs(c);
      const f = colorBy === "lq" ? (v) => `×${v.toFixed(1)}` : colorBy === "unemployment" ? (v) => pct(v) : money;
      legend = rampLegend({ ramp: spec.ramp, domain: spec.domain, fmt: f, log: spec.log, label: colorBy === "lq" ? `Especialización en ${short(nation.industries[industry]).toLowerCase()}` : colorBy === "unemployment" ? "Desempleo" : "Ingreso familiar anual" });
    }
    const labels = [...list].sort((a, b) => (b.v.population || 0) - (a.v.population || 0)).slice(0, 8).map((r) => r.key);
    scatter.update({
      points: list.filter((r) => fin(r.v.gdp_pc) && fin(r.v.growth)).map((r) => ({ key: r.key, x: r.v.gdp_pc, y: r.v.growth, s: r.v.population, c: cv(r), label: r.name, sub: r.sub, row: r })),
      color, labels, colorLabel: colorBy === "none" ? null : colorBy === "lq" ? "LQ" : colorBy === "unemployment" ? "Desempleo" : "Ingreso",
      colorFmt: colorBy === "lq" ? (v) => `×${(+v).toFixed(2)}` : colorBy === "unemployment" ? pct : dollars,
    });
    legendEl.innerHTML = legend;
  }

  let specTop = [];
  const specHighlight = () => (specTop.length ? rowsHighlight(metros, specTop, { ringMax: 15 }) : null);
  function setIndustry(k) {
    industry = k;
    indSel.set(k);
    const list = big.filter((r) => fin(lq(r))).sort((a, b) => lq(b) - lq(a));
    specTop = list.slice(0, 15);
    const maxLq = Math.max(1, ...list.slice(0, 40).map((r) => lq(r)));
    specTable.setColumns([
      { key: "name", label: "Ciudad", align: "l", value: (r) => r.name, html: (r) => `${esc(r.name)} <span class="sub">${esc(r.sub)}</span>` },
      { key: "share", label: "% del empleo", value: (r) => ratio(r.ref.jobs?.[industry], r.ref.employed), text: (r) => pct(ratio(r.ref.jobs?.[industry], r.ref.employed)) },
      { key: "lq", label: "LQ", value: (r) => lq(r), text: (r) => (fin(lq(r)) ? `×${lq(r).toFixed(2)}` : "–"), bar: { max: maxLq, color: "rgba(74,134,214,.45)" } },
      { key: "workers", label: "Ocupados", value: (r) => r.ref.jobs?.[industry], text: (r) => count3(r.ref.jobs?.[industry]) },
    ], { key: "lq", dir: "desc" });
    specTable.setRows(list);
    const us = ratio(n.jobs?.[k], n.employed);
    specInfo.innerHTML = `Perú: el <b>${pct(us)}</b> de los ocupados (${count3(n.jobs?.[k])} personas) trabaja en ${esc(short(nation.industries[k]).toLowerCase())}.`;
    if (!scatter.selected) link.base(specHighlight());
    indBars.setSelected(k === "public_admin" ? "government" : k);
    drawScatter();
  }
  setIndustry(industry);

  el.insertAdjacentHTML("beforeend", sourcesHtml(data, ["peru_socioeconomic", "mtpe_employment", "peru_boundaries"], [
    "El PBI se contabiliza donde se realiza la actividad económica (INEI Cuentas Departamentales), mientras que los residentes ocupados siguen su lugar de residencia.",
    `El PBI corresponde a ${esc(nation.gdp_vintage || "INEI 2024")} convertido a USD corrientes, mientras que la población proyectada es ${esc(nation.vintage || "INEI 2025")}.`,
    "Para ciudades intermedias, el PBI urbano se estima a partir del PBI departamental ponderado por población y estructura formal (MTPE).",
  ]));

  return {
    onMapHover(h) {
      const r = h.cell >= 0 ? metros.rowAtCell(h.cell) : null;
      scatter.setHot(r ? r.key : null);
      specTable.setHot(r ? r.key : null);
    },
    onEscape() {
      if (scatter.selected) { scatter.setSelected(null); link.base(specHighlight()); bubbles.setSelected(null); brushInfo.innerHTML = ""; return true; }
      return false;
    },
  };
}
