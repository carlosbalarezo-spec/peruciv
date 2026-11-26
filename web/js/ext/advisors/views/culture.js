// Asesor de Cultura y Peligros: maravillas del Perú (SERNANP, MINCETUR, SUNEDU), religión y tradición, bienestar y emergencias INDECI.
import { esc, fin, el as mk, colorScale } from "../core/util.js";
import { int, pct, money, count3 } from "../core/fmt.js";
import { barList, shareBar, histogram } from "../core/charts.js";
import { createTable } from "../core/table.js";
import { section, tiles, segmented, mapPicker, sourcesHtml } from "../core/view.js";
import { rowsHighlight } from "../core/data.js";
import { frameBox, focusPoint } from "../core/frame.js";

const KIND = {
  natural: { label: "Naturaleza (SERNANP)", color: "#6aa84f" },
  university: { label: "Universidades (SUNEDU)", color: "#4a86d6" },
  landmark: { label: "Patrimonio (MINCETUR)", color: "#e0b54c" },
};
const RULE_TITLE = {
  national_park: "Áreas Naturales Protegidas (SERNANP)",
  park_unit: "Santuarios y Reservas Nacionales",
  research_university: "Universidades Licenciadas (SUNEDU)",
  landmark: "Patrimonio Arqueológico y Cultural (MINCETUR)",
};
const DIS_COLOR = { hurricane: "#4f9ad6", flood: "#2fa4b8", fire: "#e8774a", severe_storm: "#9a7bc9", winter: "#c9dcef", other: "#9a9aa8" };

export async function mount(ctx) {
  const { app, data, el, link } = ctx;
  const disastersP = app.loadData("disasters").catch(() => null);
  const won = await app.loadData("wonders");
  const { states: stLevel, counties } = data.levels;
  const lensFaith = app.lensById?.get("faith"), lensTrad = app.lensById?.get("faith_tradition");
  const lensAmen = app.lensById?.get("amenities"), lensDis = app.lensById?.get("disasters");

  const wonders = (won?.wonders || []).map((w) => ({ ...w, key: w.id }));
  const byKind = (k) => wonders.filter((w) => w.kind === k).length;
  let adherents = null;
  if (counties) {
    let a = 0, p = 0;
    for (const r of counties.rows) if (fin(r.v.faith) && fin(r.v.population)) { a += (r.v.faith / 100) * r.v.population; p += r.v.population; }
    adherents = p ? (a / p) * 100 : null;
  }
  const tileEl = mk("div");
  el.appendChild(tileEl);
  const drawTiles = (dis) => {
    tileEl.innerHTML = tiles([
      { label: "Maravillas del Perú", value: int(wonders.length), sub: (() => { const byRule = (...ids) => wonders.filter((w) => ids.includes(w.rule)).length; return `${byRule("national_park", "park_unit")} ANP · ${byRule("research_university")} univ. · ${byRule("landmark")} sitios`; })() },
      { label: "Visitas a ANP", value: count3(won?.national?.park_visits), sub: `SERNANP ${won?.national?.park_visits_year || ""}` },
      dis?.noaa?.national
        ? { label: "Grandes desastres", value: int(dis.noaa.national.events), sub: `${dis.noaa.years?.join("–") || ""} · ${money(dis.noaa.national.cost_usd)}` }
        : { label: "Creyentes ≈", value: fin(adherents) ? `${adherents.toFixed(0)} / 100` : "–", sub: "habitantes (Censo INEI)" },
    ]);
  };
  drawTiles(null);

  const mapRow = mk("div", "adv-sec adv-mapsec");
  el.appendChild(mapRow);
  const picker = mapPicker(ctx, mapRow, {
    value: "terrain",
    options: [
      { value: "terrain", label: "Terreno", lens: () => null },
      ...(lensFaith ? [{ value: "faith", label: "Religión", lens: () => "faith" }] : []),
      ...(lensTrad ? [{ value: "trad", label: "Tradición", lens: () => "faith_tradition" }] : []),
      ...(lensAmen ? [{ value: "amen", label: "Bienestar", lens: () => "amenities" }] : []),
      ...(lensDis ? [{ value: "dis", label: "Emergencias", lens: () => "disasters" }] : []),
    ],
  });

  let wonderBars = [];
  const bubbles = ctx.bubbles("wonders", {
    rMax: 9, minR: 9, alpha: 0.28,
    tip: (b) => `<b>${esc(b.it.name)}</b><br>${esc(RULE_TITLE[b.it.rule] || b.it.kind)} #${b.it.rank} · ${esc(metricText(b.it))}`,
    onHover: (b) => { for (const w of wonderBars) w.setHot(b ? b.key : null); },
    onClick: (b) => flyTo(b.it),
  });
  if (won && wonders.length) {
    const wBody = section(el, {
      title: "Maravillas del Perú", kicker: "Elegidas con criterios públicos verificables",
      note: "Pasa el cursor sobre una maravilla para ubicarla en el mapa; haz clic para volar hacia ella. Las Áreas Naturales Protegidas (SERNANP) y sitios arqueológicos (MINCETUR) se ordenan por visitas registradas, y las universidades (SUNEDU) por actividad científica.",
    });
    let kind = "all";
    segmented(wBody, {
      label: "Categoría", value: kind,
      options: [{ value: "all", label: "Todas" }, ...Object.entries(KIND).filter(([k]) => byKind(k)).map(([k, v]) => ({ value: k, label: v.label }))],
      onChange: (v) => { kind = v; drawWonders(); },
    });
    const wHost = mk("div");
    wBody.appendChild(wHost);
    function drawWonders() {
      wHost.innerHTML = "";
      wonderBars = [];
      const vis = wonders.filter((w) => kind === "all" || w.kind === kind);
      for (const rule of won.rules || []) {
        const list = vis.filter((w) => w.rule === rule.id);
        if (!list.length) continue;
        wHost.insertAdjacentHTML("beforeend", `<h4 class="adv-h4">${esc(RULE_TITLE[rule.id] || rule.id)}</h4><p class="adv-note adv-rule">${esc(rule.text)}</p>`);
        const host = mk("div");
        wHost.appendChild(host);
        const val = (w) => (w.kind === "university" ? w.metrics?.rd_usd : w.metrics?.visits ?? null);
        wonderBars.push(barList(host, {
          rank: !rule.curated, compact: true, ariaLabel: RULE_TITLE[rule.id] || rule.id,
          rows: list.map((w) => ({ key: w.key, label: w.short || w.name, full: w.name, sub: w.state, value: val(w), text: metricText(w), color: KIND[w.kind]?.color })),
          onHover: (r) => {
            const w = r ? wonders.find((x) => x.key === r.key) : null;
            link.hover(w ? { cells: new Set(w.cells && w.cells.length ? w.cells : w.cell != null ? [w.cell] : []), label: w.short || w.name } : null);
            bubbles.setHot(w ? w.key : null);
          },
          onClick: (r) => flyTo(wonders.find((x) => x.key === r.key)),
        }));
      }
      bubbles.set(vis.filter((w) => fin(w.x) && fin(w.y)).map((w) => ({ key: w.key, x: w.x, y: w.y, value: 1, color: KIND[w.kind]?.color || "#ccc", it: w })), { vMax: 1 });
    }
    drawWonders();
    wBody.insertAdjacentHTML("beforeend", `<p class="adv-note">Marcadores en el mapa: <i class="dot" style="background:${KIND.natural.color}"></i>ANP SERNANP · <i class="dot" style="background:${KIND.university.color}"></i>universidad · <i class="dot" style="background:${KIND.landmark.color}"></i>patrimonio cultural.</p>`);
  } else el.insertAdjacentHTML("beforeend", `<p class="adv-empty pad">wonders.json no está disponible.</p>`);

  function flyTo(w) {
    if (!w) return;
    if (w.cells && w.cells.length > 2) {
      const b = app.highlightBounds({ cells: new Set(w.cells) });
      if (b) return frameBox(app, b, { pad: 60, maxScale: 3 });
    }
    focusPoint(app, w.x, w.y, Math.min(app.cam.maxScale, Math.max(app.cam.scale, (app.cam.fitScale || 1) * 3.2)));
  }

  let faithStates = null;
  if (counties && lensTrad) {
    const fBody = section(el, { title: "Religión y Tradición", kicker: "Censos Nacionales INEI" });
    fBody.insertAdjacentHTML("beforeend", `<p class="adv-callout adv-caveat">${esc(lensTrad.note || lensFaith?.note || "")}</p>`);
    const cats = lensTrad.categories || [];
    const catByName = new Map(cats.map((c) => [c.name, c]));
    const popBy = new Map();
    for (const r of counties.rows) {
      const c = catByName.get(r.v.faith_tradition);
      if (c && fin(r.v.population)) popBy.set(c.id, (popBy.get(c.id) || 0) + r.v.population);
    }
    fBody.insertAdjacentHTML("beforeend", `<h4 class="adv-h4">Población según el perfil religioso predominante en su provincia</h4>`);
    const tradRows = (id) => counties.rows.filter((r) => catByName.get(r.v.faith_tradition)?.id === id);
    shareBar(fBody, {
      parts: cats.map((c) => ({ key: c.id, label: c.name, value: popBy.get(c.id) || 0, color: c.color, text: `${count3(popBy.get(c.id) || 0)} hab.` })),
      onHover: (p) => link.hover(p ? rowsHighlight(counties, tradRows(p.key), { dim: true, label: p.label }) : null),
      onClick: () => picker.set("trad"),
    });
    fBody.insertAdjacentHTML("beforeend", `<p class="adv-note">Haz clic en la barra para colorear el mapa según el perfil religioso.</p>`);
    let order = "most";
    const sRow = mk("div", "adv-row");
    fBody.appendChild(sRow);
    sRow.insertAdjacentHTML("beforeend", `<span class="adv-note" style="margin:0">Departamentos por adscripción religiosa cada 100 hab. ≈</span>`);
    segmented(sRow, { label: "Orden", value: order, options: [{ value: "most", label: "Mayor" }, { value: "fewest", label: "Menor" }], onChange: (v) => { order = v; drawFaith(); } });
    const sHost = mk("div");
    fBody.appendChild(sHost);
    const fColor = colorScale({ type: "seq", domain: [0, 100], ramp: lensFaith?.ramp });
    function drawFaith() {
      sHost.innerHTML = "";
      const list = stLevel.rows.filter((r) => fin(r.v.faith)).sort((a, b) => (order === "most" ? b.v.faith - a.v.faith : a.v.faith - b.v.faith)).slice(0, 10);
      faithStates = barList(sHost, {
        rank: true, compact: true, max: 100, ariaLabel: "Departamentos por adscripción religiosa",
        rows: list.map((r) => ({ key: r.key, label: r.name, value: Math.min(100, r.v.faith), text: r.v.faith.toFixed(0), color: fColor(r.v.faith) })),
        onHover: (x) => link.hover(x ? rowsHighlight(stLevel, [stLevel.byKey.get(x.key)], { dim: true }) : null),
        onClick: (x) => { picker.set("faith"); stLevel.focus(stLevel.byKey.get(x.key)); },
      });
    }
    drawFaith();
  }

  let amenHist = null, amenTable = null;
  if (counties && lensAmen) {
    const aBody = section(el, { title: "Bienestar y Servicios Básicos", kicker: "ENAHO / INEI · RENTOCA" });
    aBody.insertAdjacentHTML("beforeend", `<p class="adv-callout adv-caveat">${esc(lensAmen.note || "")}</p><p class="adv-note">${esc(lensAmen.description || "")}</p>`);
    const rows = counties.rows.filter((r) => fin(r.v.amenities));
    const aColor = colorScale({ type: "seq", domain: lensAmen.domain || [80, 120], ramp: lensAmen.ramp });
    amenHist = histogram(aBody, {
      values: rows.map((r) => ({ key: r.key, v: r.v.amenities })), bins: 26, domain: lensAmen.domain ? [lensAmen.domain[0] - 8, lensAmen.domain[1] + 8] : undefined,
      fmt: (v) => v.toFixed(0), unitLabel: "provincias", label: "Histograma del índice de bienestar provincial",
      colorOf: (v) => aColor(v), markers: [{ v: 100, label: "media provincial" }],
      onHover: (bin) => link.hover(bin ? rowsHighlight(counties, bin.keys.map((k) => counties.byKey.get(k)), { dim: true }) : null),
    });
    amenTable = createTable(aBody, {
      caption: "Provincias por índice de bienestar", rank: true, maxHeight: 240, search: "Buscar provincias",
      rows: rows.filter((r) => (r.v.population || 0) >= 25000),
      columns: [
        { key: "name", label: "Provincia", align: "l", width: "minmax(0,1.6fr)", value: (r) => r.name, html: (r) => `${esc(r.name)} <span class="sub">${esc(r.sub)}</span>` },
        { key: "amenities", label: "Índice", value: (r) => r.v.amenities, text: (r) => r.v.amenities.toFixed(1), bar: { max: 130, color: "rgba(126,207,142,.3)" } },
        { key: "water_access", label: "Agua red", value: (r) => r.v.water_access, text: (r) => pct(r.v.water_access), title: "Hogares con acceso a agua por red pública" },
        { key: "culture_org", label: "RENTOCA", value: (r) => r.v.culture_org, text: (r) => int(r.v.culture_org), title: "Agentes y organizaciones culturales en RENTOCA (MinCul)", hideBelow: 380 },
      ],
      sort: { key: "amenities", dir: "desc" },
      onHover: (r) => link.hover(r ? rowsHighlight(counties, [r]) : null),
      onClick: (r) => counties.focus(r),
    });
    aBody.insertAdjacentHTML("beforeend", `<p class="adv-note">Provincias de 25,000+ habitantes. Incluye acceso a agua potable (ENAHO) y agentes culturales inscritos en RENTOCA (Ministerio de Cultura).</p>`);
  }

  const dSec = section(el, { title: "Emergencias y Desastres Naturales", kicker: "SINPAD (INDECI) · Grandes Megadesastres" });
  dSec.innerHTML = `<p class="adv-loading">Cargando registros históricos de emergencias…</p>`;
  const srcEl = mk("div");
  el.appendChild(srcEl);
  const drawSources = (dis) => {
    srcEl.innerHTML = sourcesHtml(data, [...(won?.sources || []), "peru_socioeconomic", "mincul_rentoca", ...(dis?.sources || ["indeci_emergencies"])], [
      "Las emergencias INDECI provienen del registro histórico SINPAD (2003–2025): contabilizan eventos reportados (lluvias intensas, huaicos, heladas, sismos, incendios), no pérdidas económicas directas.",
      "Los grandes megadesastres históricos del Perú (Fenómenos El Niño 1982–83, 1997–98, Niño Costero 2017, Sismos de Pisco 2007 y Áncash 1970, Yaku 2023) distribuyen su impacto entre los departamentos afectados: no deben sumarse entre regiones.",
      "Las visitas a ANP (SERNANP) y sitios turísticos/arqueológicos (MINCETUR) corresponden a registros oficiales de boletaje.",
    ]);
  };
  drawSources(null);
  let dState = null, dCounty = null;
  disastersP.then((dis) => {
    if (!active()) return;
    if (!dis) dSec.innerHTML = `<p class="adv-empty">disasters.json no está disponible.</p>`;
    else drawDisasters(dis);
    drawTiles(dis);
    drawSources(dis);
  });

  function drawDisasters(D) {
    dSec.innerHTML = "";
    const fema = D.fema || {}, noaa = D.noaa || {};
    dSec.insertAdjacentHTML("beforeend", `<p class="adv-callout adv-caveat">Un reporte en SINPAD registra un evento atendido por Defensa Civil (INDECI), desde heladas locales hasta grandes inundaciones.</p><p class="adv-note">${esc(fema.rule || "")}</p>`);
    const cols = fema.counties?.columns || [];
    const ci = Object.fromEntries(cols.map((k, j) => [k, j]));
    const cRows = new Map((fema.counties?.rows || []).map((r) => [r[ci.geoid], r]));
    const types = fema.types || [];
    const nat = {};
    for (const s of Object.values(fema.states || {})) for (const [k, v] of Object.entries(s.by_type || {})) nat[k] = (nat[k] || 0) + (v || 0);
    const natTotal = Object.values(fema.states || {}).reduce((a, s) => a + (s.total || 0), 0);
    dSec.insertAdjacentHTML("beforeend", `<h4 class="adv-h4">${int(natTotal)} emergencias registradas en SINPAD desde ${esc((fema.window || [])[0]?.slice(0, 4) || "2003")}, por tipo</h4>`);
    const typeCounties = (id) => counties ? counties.rows.filter((r) => { const x = cRows.get(r.key); return x && x[ci[id]] > 0; }) : [];
    shareBar(dSec, {
      parts: types.map((t) => ({ key: t.id, label: t.name, value: nat[t.id] || 0, color: DIS_COLOR[t.id] || "#999", text: int(nat[t.id] || 0) })),
      onHover: (p) => link.hover(p ? rowsHighlight(counties, typeCounties(p.key), { dim: true, label: `Provincias con emergencias de ${p.label.toLowerCase()}` }) : null),
      onClick: () => picker.set("dis"),
    });

    const abbrs = [...new Set([...Object.keys(fema.states || {}), ...Object.keys(noaa.states || {})])];
    const sum = (o) => Object.values(o || {}).reduce((a, v) => a + (fin(v) ? v : 0), 0);
    const sRows = abbrs.map((a) => {
      const f = fema.states?.[a], n = noaa.states?.[a], row = stLevel.byKey.get(a);
      return { key: a, name: row?.name || a, row, fema: f?.total ?? null, nEvents: n ? sum(n.count) : null, nCost: n ? sum(n.cost_usd) : null, n };
    });
    dSec.insertAdjacentHTML("beforeend", `<h4 class="adv-h4">Por departamento</h4>`);
    dState = createTable(dSec, {
      caption: "Emergencias y desastres por departamento", rank: true, maxHeight: 240, search: "Buscar departamentos",
      rows: sRows,
      columns: [
        { key: "name", label: "Departamento", align: "l", width: "minmax(0,1.4fr)", value: (r) => r.name, html: (r) => esc(r.name) },
        { key: "fema", label: "SINPAD", short: "Emergencias SINPAD", value: (r) => r.fema, text: (r) => (fin(r.fema) ? int(r.fema) : "–") },
        { key: "nEvents", label: "Megadesastres", short: "Eventos mayores", value: (r) => r.nEvents, text: (r) => (fin(r.nEvents) ? int(r.nEvents) : "–"), title: `Grandes eventos históricos que afectaron la región, ${(noaa.years || []).join("–")}` },
        { key: "nCost", label: "Impacto est.", short: "Impacto económico", value: (r) => r.nCost, text: (r) => money(r.nCost), bar: { max: Math.max(...sRows.map((r) => r.nCost || 0), 1), color: "rgba(232,119,74,.3)" }, title: `Participación estimada en pérdidas económicas (${noaa.unit || "USD"})` },
      ],
      sort: { key: "fema", dir: "desc" },
      onHover: (r) => link.hover(r?.row ? rowsHighlight(stLevel, [r.row], { dim: true }) : null),
      onClick: (r) => { if (r.row) stLevel.focus(r.row); },
    });
    dSec.insertAdjacentHTML("beforeend", `<p class="adv-note">${esc(noaa.rule || "")}</p>`);

    if (counties) {
      dSec.insertAdjacentHTML("beforeend", `<h4 class="adv-h4">Provincias con más emergencias reportadas</h4>`);
      const rows = counties.rows.filter((r) => cRows.has(r.key)).map((r) => ({ ...r, dx: cRows.get(r.key) }));
      dCounty = createTable(dSec, {
        caption: "Provincias por emergencias SINPAD", rank: true, maxHeight: 240, search: "Buscar provincias", rows,
        columns: [
          { key: "name", label: "Provincia", align: "l", width: "minmax(0,1.6fr)", value: (r) => r.name, html: (r) => `${esc(r.name)} <span class="sub">${esc(r.sub)}</span>` },
          { key: "total", label: "Emergencias", value: (r) => r.dx[ci.total], text: (r) => int(r.dx[ci.total]), bar: { max: Math.max(...rows.map((r) => r.dx[ci.total] || 0), 1), color: "rgba(207,106,74,.3)" } },
          { key: "top", label: "Principal", align: "l", width: "minmax(0,1fr)", hideBelow: 380, value: (r) => topType(r.dx), text: (r) => types.find((t) => t.id === topType(r.dx))?.name.split(/[ ,/]/)[0] || "–" },
          { key: "last", label: "Último", align: "l", width: "78px", value: (r) => r.dx[ci.last_date], text: (r) => r.dx[ci.last_date] || "–" },
        ],
        sort: { key: "total", dir: "desc" },
        onHover: (r) => link.hover(r ? rowsHighlight(counties, [counties.byKey.get(r.key)]) : null),
        onClick: (r) => counties.focus(counties.byKey.get(r.key)),
      });
      function topType(x) {
        let best = null, bv = 0;
        for (const t of types) if ((x[ci[t.id]] || 0) > bv) { bv = x[ci[t.id]]; best = t.id; }
        return best;
      }
    }

    const recent = fema.recent || [];
    if (recent.length) {
      dSec.insertAdjacentHTML("beforeend", `<h4 class="adv-h4">Eventos destacados recientes (hasta ${esc(fema.as_of || "")})</h4>`);
      createTable(dSec, {
        caption: "Emergencias recientes", maxHeight: 220, rowKey: (r) => r.disaster,
        rows: recent,
        columns: [
          { key: "date", label: "Fecha", align: "l", width: "78px", value: (r) => r.date, text: (r) => r.date },
          { key: "state", label: "Reg.", align: "l", width: "42px", value: (r) => r.state, text: (r) => r.state },
          { key: "type", label: "Evento", align: "l", width: "minmax(0,1.6fr)", value: (r) => r.title, html: (r) => `<i class="dot" style="background:${DIS_COLOR[r.type] || "#999"}"></i>${esc(r.title)}`, tip: (r) => `${r.incident_type || ""} · ${r.title}` },
          { key: "areas", label: "Prov.", value: (r) => r.areas, text: (r) => (r.statewide ? "regional" : int(r.areas)) },
        ],
        sort: { key: "date", dir: "desc" },
        onHover: (r) => {
          if (!r) return link.hover(null);
          const rows = counties ? (r.counties || []).map((g) => counties.byKey.get(g)).filter(Boolean) : [];
          const i = stLevel.byKey.get(r.state)?.ref;
          link.hover(rows.length ? rowsHighlight(counties, rows, { dim: true, label: `${r.title}, ${r.state}` }) : i != null ? { states: new Set([i]), dimOthers: true, label: r.state } : null);
        },
        onClick: (r) => {
          const rows = counties ? (r.counties || []).map((g) => counties.byKey.get(g)).filter(Boolean) : [];
          const b = rows.length ? app.highlightBounds(counties.highlight(rows)) : null;
          if (b) frameBox(app, b, { pad: 50, maxScale: 2.6 });
        },
      });
    }

    const years = noaa.national?.by_year || [];
    if (years.length) {
      dSec.insertAdjacentHTML("beforeend", `<h4 class="adv-h4">Grandes desastres por año, ${(noaa.years || []).join("–")} (${esc(noaa.unit || "USD")})</h4>`);
      dSec.appendChild(columnChart(years, (y) => y.events, (y) => `${y.year}: ${y.events} eventos, ${money(y.cost_usd)}`));
      const worst = noaa.national?.costliest || [];
      if (worst.length) {
        dSec.insertAdjacentHTML("beforeend", `<h4 class="adv-h4">Los de mayor impacto histórico</h4><ol class="adv-olist">${worst.map((e) => `<li><b>${esc(e.name)}</b> <span class="sub">${money(e.cost_usd)}${fin(e.deaths) ? ` · ${int(e.deaths)} fallecidos` : ""}</span></li>`).join("")}</ol>`);
      }
    }
  }

  return {
    onMapHover(h) {
      const owner = h.cell >= 0 ? app.w.raw.owner[h.cell] : -1;
      const sr = owner >= 0 ? stLevel.rows[owner] : null;
      faithStates?.setHot(sr ? sr.key : null);
      dState?.setHot(sr ? sr.key : null, false);
      const c = h.cell >= 0 && counties ? counties.rowAtCell(h.cell) : null;
      amenHist?.setHot(c && amenHist.binOf ? amenHist.binOf(c.v.amenities)?.i ?? null : null);
      amenTable?.setHot(c ? c.key : null, false);
      dCounty?.setHot(c ? c.key : null, false);
      if (h.item?.kind === "wonder") for (const w of wonderBars) w.setHot(h.item.data?.id ?? null);
    },
    onMapClick(ev) {
      if (ev.item?.kind !== "wonder") return false;
      flyTo(wonders.find((w) => w.id === ev.item.data?.id));
      return true;
    },
  };

  function active() { return el.isConnected; }
}

function metricText(w) {
  const m = w.metrics || {};
  if (w.kind === "university") return fin(m.rd_usd) ? `${money(m.rd_usd)} I+D` : "–";
  if (w.kind === "natural") return fin(m.visits) ? `${count3(m.visits)} visitas` : "–";
  if (fin(m.visits)) return `${count3(m.visits)} visitas`;
  return fin(m.designated) ? `patrimonio desde ${m.designated}` : "patrimonio";
}

function columnChart(items, val, label) {
  const W = 400, H = 110, m = { l: 4, r: 4, t: 6, b: 18 };
  const max = Math.max(1, ...items.map(val));
  const bw = (W - m.l - m.r) / items.length;
  const div = document.createElement("div");
  div.className = "adv-hist adv-cols-chart";
  const first = items[0]?.year, last = items[items.length - 1]?.year;
  div.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="none" role="img" aria-label="Eventos por año">
    ${items.map((it, i) => { const h = (val(it) / max) * (H - m.t - m.b); return `<g class="bin"><rect class="hit" x="${(m.l + i * bw).toFixed(2)}" y="${m.t}" width="${bw.toFixed(2)}" height="${H - m.t - m.b}"/><rect class="bar" x="${(m.l + i * bw + 0.4).toFixed(2)}" y="${(H - m.b - h).toFixed(2)}" width="${Math.max(0.5, bw - 0.8).toFixed(2)}" height="${h.toFixed(2)}" fill="#cf6a4a"/><title>${esc(label(it))}</title></g>`; }).join("")}
    <line x1="${m.l}" x2="${W - m.r}" y1="${H - m.b + 0.5}" y2="${H - m.b + 0.5}" class="axis"/>
    <text x="${m.l}" y="${H - 5}" class="tick">${first ?? ""}</text><text x="${W - m.r}" y="${H - 5}" text-anchor="end" class="tick">${last ?? ""}</text>
    <text x="${m.l + 2}" y="${m.t + 9}" class="tick">máx. ${max}</text>
  </svg>`;
  return div;
}
