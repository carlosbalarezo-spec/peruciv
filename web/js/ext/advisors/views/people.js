// Asesor de Población: habitantes, crecimiento demográfico, densidad provincial, edad y migración.
import { esc, fin, colorScale, robustDomain, RAMPS } from "../core/util.js";
import { pct, int, signedPct, count3, fmtShort, fmtValue } from "../core/fmt.js";
import { barList, histogram, rampLegend } from "../core/charts.js";
import { createScatter } from "../core/scatter.js";
import { section, tiles, segmented, mapPicker, frameBtn, sourcesHtml, topBy } from "../core/view.js";
import { rowsHighlight } from "../core/data.js";
import { growthLens } from "../core/lenses.js";

const METRO_MIN = 250000;

export function mount(ctx) {
  const { data, el, link } = ctx;
  const n = data.nat;
  const { states, metros, counties } = data.levels;
  const yrs = n.growth_years || [];

  el.insertAdjacentHTML("beforeend", tiles([
    { label: "Habitantes", value: count3(n.population), sub: data.vintage },
    { label: `Crecimiento ${yrs.join("–")}`, value: signedPct(n.growth, 2), sub: "Proyecciones INEI" },
    { label: "Ciudades mapeadas", value: int(metros.rows.length), sub: counties ? `${int(counties.rows.length)} provincias` : "" },
  ]));

  let gLevel = "metros";
  const mapRow = document.createElement("div");
  mapRow.className = "adv-sec adv-mapsec";
  el.appendChild(mapRow);
  const lensOpt = (value, label, id) => ({ value, label, lens: () => id });
  const picker = mapPicker(ctx, mapRow, {
    value: "growth",
    options: [
      { value: "growth", label: "Crecimiento", lens: () => growthLens(data, gLevel) },
      ...(counties ? [lensOpt("density", "Densidad", "density"), lensOpt("age", "Edad", "age"), lensOpt("indigenous_lang", "Lengua orig.", "indigenous_lang")] : []),
      { value: "terrain", label: "Terreno", lens: () => null },
    ],
  });

  const gBody = section(el, {
    title: `Crecimiento demográfico (${yrs.join("–") || "2021–2025"})`,
    note: `Variación poblacional ${yrs.join("–")} según las proyecciones oficiales del INEI. En ciudades se muestran áreas de ${count3(METRO_MIN)}+ habitantes.`,
  });
  const gHost = document.createElement("div");
  segmented(gBody, { label: "Áreas", value: gLevel, options: [{ value: "metros", label: "Ciudades" }, { value: "states", label: "Departamentos" }], onChange: (v) => { gLevel = v; drawGrowth(); if (picker.value === "growth") picker.refresh(); } });
  gBody.appendChild(gHost);
  function drawGrowth() {
    gHost.innerHTML = "";
    const lv = gLevel === "metros" ? metros : states;
    const min = gLevel === "metros" ? METRO_MIN : 0;
    const fast = topBy(lv.rows, (r) => r.v.growth, { n: 8, min });
    const slow = topBy(lv.rows, (r) => r.v.growth, { n: 8, min, asc: true });
    const max = Math.max(...[...fast, ...slow].map((x) => Math.abs(x.v)));
    const mk = (list) => list.map((x) => ({ key: x.r.key, label: x.r.name, sub: gLevel === "metros" ? x.r.sub : "", value: x.v, text: signedPct(x.v), tone: x.v >= 0 ? "good" : "bad", row: x.r }));
    const opts = {
      diverging: true, max,
      onHover: (r) => link.hover(r ? rowsHighlight(lv, [r.row]) : null),
      onClick: (r) => lv.focus(r.row),
    };
    gHost.insertAdjacentHTML("beforeend", `<h4 class="adv-h4">Mayor crecimiento</h4>`);
    barList(gHost, { ...opts, rows: mk(fast), ariaLabel: "Mayor crecimiento" });
    gHost.insertAdjacentHTML("beforeend", `<h4 class="adv-h4">${slow.every((x) => x.v < 0) ? "En descenso poblacional" : "Menor crecimiento"}</h4>`);
    barList(gHost, { ...opts, rows: mk(slow), ariaLabel: "Menor crecimiento" });
  }
  drawGrowth();

  if (!counties) {
    el.insertAdjacentHTML("beforeend", `<p class="adv-empty pad">counties.json no está disponible.</p>`);
    el.insertAdjacentHTML("beforeend", sourcesHtml(data, ["peru_socioeconomic"], []));
    return {};
  }

  const dBody = section(el, {
    title: "Densidad provincial",
    note: "Las 196 provincias según habitantes por km² (escala logarítmica). Cambia a <i>habitantes</i> para ponderar por población: gran parte del Perú vive en las provincias costeras más densas. Haz clic en una barra para fijar esas provincias en el mapa.",
  });
  const dCtl = document.createElement("div");
  dCtl.className = "adv-row";
  dBody.appendChild(dCtl);
  let weighted = false, pinnedBin = null;
  segmented(dCtl, { label: "Contar", value: "counties", options: [{ value: "counties", label: "Provincias" }, { value: "people", label: "Habitantes" }], onChange: (v) => { weighted = v === "people"; drawHist(); } });
  const dLens = document.createElement("button");
  dLens.type = "button";
  dLens.className = "adv-mini";
  dLens.textContent = "Colorear mapa por densidad";
  dLens.addEventListener("click", () => picker.set("density"));
  dCtl.appendChild(dLens);
  const histHost = document.createElement("div");
  dBody.appendChild(histHost);
  const binInfo = document.createElement("div");
  binInfo.className = "adv-brushinfo";
  dBody.appendChild(binInfo);
  let hist = null;
  const peDensity = counties.rows.reduce((a, r) => a + (r.v.population || 0), 0) / counties.rows.reduce((a, r) => a + (r.v.land_km2 || 0), 0);
  const cByKey = counties.byKey;
  const densRamp = RAMPS.heat;
  function drawHist() {
    histHost.innerHTML = "";
    const vals = counties.rows.map((r) => ({ key: r.key, v: r.v.density, w: r.v.population }));
    const dom = [0.2, 10000];
    hist = histogram(histHost, {
      values: vals, log: true, bins: 26, domain: dom, weighted, height: 130,
      fmt: (v) => fmtShort("float", v), unitLabel: "provincias", weightFmt: (w) => `${count3(w)} hab.`,
      label: "Histograma de densidad poblacional provincial",
      colorOf: (_, t) => colorScale({ type: "seq", domain: [0, 1], ramp: densRamp })(t),
      markers: [{ v: peDensity, label: "Promedio Perú" }],
      onHover: (bin) => link.hover(bin ? rowsHighlight(counties, bin.keys.map((k) => cByKey.get(k)), { dim: true }) : null),
      onClick: (bin) => {
        pinnedBin = pinnedBin === bin.i ? null : bin.i;
        const rows = pinnedBin != null ? bin.keys.map((k) => cByKey.get(k)) : [];
        link.base(rows.length ? rowsHighlight(counties, rows, { dim: true }) : null, { frame: rows.length > 1 });
        binInfo.innerHTML = rows.length ? `<b>${int(rows.length)}</b> provincias de ${fmtShort("float", bin.x0)}–${fmtShort("float", bin.x1)} hab./km² · ${count3(rows.reduce((a, r) => a + (r.v.population || 0), 0))} hab. ${frameBtn()}<button type="button" class="adv-mini" data-clear>Limpiar</button>` : "";
      },
    });
  }
  binInfo.addEventListener("click", (e) => { if (e.target.closest("[data-clear]")) { pinnedBin = null; link.base(null); binInfo.innerHTML = ""; } });
  drawHist();

  const aBody = section(el, {
    title: "Edad mediana y lengua originaria",
    note: "Cada punto es una provincia: edad mediana en horizontal, proporción con lengua materna originaria (quechua, aimara o amazónica) en vertical, tamaño = población y color = densidad. Arrastra para seleccionar provincias en el mapa.",
  });
  const aCtl = document.createElement("div");
  aCtl.className = "adv-row";
  aBody.appendChild(aCtl);
  aCtl.innerHTML = `<span class="adv-note">Colorear mapa por</span><button type="button" class="adv-mini" data-map="age">edad mediana</button><button type="button" class="adv-mini" data-map="indigenous_lang">lengua originaria</button>`;
  aCtl.addEventListener("click", (e) => { const v = e.target.closest("[data-map]")?.dataset.map; if (v) picker.set(v); });
  const dDom = robustDomain(counties.rows.map((r) => r.v.density), 0.02, true) || [1, 2000];
  const dColor = colorScale({ type: "seq", domain: dDom, log: true, ramp: RAMPS.heat });
  const big = topBy(counties.rows, (r) => r.v.population, { n: 6 }).map((x) => x.r.key);
  const scatter = createScatter(aBody, {
    height: 310,
    points: counties.rows.map((r) => ({ key: r.key, x: r.v.median_age, y: r.v.indigenous_lang, s: r.v.population, c: r.v.density, label: r.name, sub: r.sub, row: r })),
    x: { label: "Edad mediana (años)", fmt: (v) => String(+v.toFixed(0)) },
    y: { label: "Lengua originaria", fmt: (v) => fmtShort("pct", v) },
    size: { label: "Población", fmt: count3, max: 14, min: 1.4 },
    color: (c) => dColor(c), colorLabel: "Densidad", colorFmt: (v) => `${fmtValue("float", v)} /km²`,
    labels: big,
    refX: fin(medianOf(counties.rows, "median_age")) ? [{ v: medianOf(counties.rows, "median_age"), label: "provincia mediana" }] : [],
    onHover: (p) => link.hover(p ? rowsHighlight(counties, [p.row]) : null),
    onClick: (p) => counties.focus(p.row),
    onBrush: (set) => {
      const sel = set ? counties.rows.filter((r) => set.has(r.key)) : [];
      link.base(sel.length ? rowsHighlight(counties, sel, { dim: true }) : null, { frame: sel.length > 1 });
      selInfo.innerHTML = sel.length ? selSummary(sel) : "";
    },
  });
  aBody.insertAdjacentHTML("beforeend", rampLegend({ ramp: RAMPS.heat, domain: dDom, log: true, fmt: (v) => fmtShort("float", v), label: "Habitantes por km²" }));
  const selInfo = document.createElement("div");
  selInfo.className = "adv-brushinfo";
  aBody.appendChild(selInfo);
  function selSummary(sel) {
    const pop = sel.reduce((a, r) => a + (r.v.population || 0), 0);
    const top = [...sel].sort((a, b) => (b.v.population || 0) - (a.v.population || 0)).slice(0, 5);
    return `<b>${int(sel.length)}</b> provincias · ${count3(pop)} hab. (${pct(pop / n.population)} del Perú)<br><span class="sub">Mayores: ${top.map((r) => `${esc(r.name)}, ${esc(r.sub)}`).join(" · ")}</span> ${frameBtn()}<button type="button" class="adv-mini" data-clear>Limpiar</button>`;
  }
  selInfo.addEventListener("click", (e) => { if (e.target.closest("[data-clear]")) { scatter.setSelected(null); link.base(null); selInfo.innerHTML = ""; } });

  el.insertAdjacentHTML("beforeend", sourcesHtml(data, ["peru_socioeconomic", "peru_boundaries"], [
    "El lente de crecimiento por ciudad colorea las áreas urbanas mapeadas; cambia el selector a Departamentos para colorear todo el territorio.",
    `Las proyecciones poblacionales (${esc(data.vintage)}) y los límites provinciales oficiales provienen del INEI / IGN.`,
  ]));

  return {
    onMapHover(h) {
      const r = h.cell >= 0 ? counties.rowAtCell(h.cell) : null;
      scatter.setHot(r ? r.key : null);
      hist?.setHot(r ? hist.binOf(r.v.density)?.i ?? null : null);
    },
    onEscape() {
      if (scatter.selected || pinnedBin != null) {
        scatter.setSelected(null); pinnedBin = null; link.base(null); selInfo.innerHTML = ""; binInfo.innerHTML = "";
        return true;
      }
      return false;
    },
  };
}

function medianOf(rows, k) {
  const s = rows.map((r) => r.v[k]).filter(fin).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
}
