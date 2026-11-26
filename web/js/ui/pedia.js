// El Almanaque: qué significa cada cifra y de qué fuente oficial del Perú proviene.
import { resolveTables } from "../terrain.js";
import { esc } from "../format.js";
import { parseHex, luminance } from "../color.js";
import { icon, glyph } from "./icon.js";

const COVER_ICON = { forest_deciduous: "l-forest", forest_evergreen: "l-forest", forest_mixed: "l-forest", cropland: "l-farmland", pasture: "l-farmland", urban: "l-developed" };
const inkOn = (hex) => {
  try { return /^#[0-9a-f]{6}$/i.test(hex || "") && luminance(parseHex(hex)) > 0.4 ? "#1c1710" : "#f8f0d8"; } catch { return "#f8f0d8"; }
};
const CATEGORY = { energy: "Energía e Hidrocarburos", mineral: "Minería", agri: "Agricultura" };

export function initPedia(data) {
  const modal = document.getElementById("pedia");
  const card = modal.querySelector(".modal-card");
  const nav = document.getElementById("pedia-nav");
  const body = document.getElementById("pedia-body");
  const srcName = (id) => data.sources?.find((s) => s.id === id)?.title || id || "";
  let restoreFocus = null;

  const h2 = (ic, fb, text) => `<h2>${icon(ic, fb, { size: 24 })}<span>${esc(text)}</span></h2>`;

  const pages = {
    "Sobre este mapa": () => `
      ${h2("pedia", "📖", "Sobre este mapa")}
      <p>Este es el <b>Perú real</b>, representado como un mapa de estrategia 4X estilo <i>Civilization</i>. Cada casilla,
      ciudad, recurso, maravilla e indicador proviene de fuentes públicas oficiales de la <b>Plataforma Nacional de Datos Abiertos
      (datosabiertos.gob.pe)</b>, INEI, MINEM, SERNANP, MINCETUR, SUNEDU, OSITRAN, INDECI y Ministerio de Cultura.</p>
      <h4>Cómo está construido</h4>
      <p>El territorio peruano se proyecta en áreas iguales (Albers centrada en el Perú) y se divide en una malla de
      <b>${data.world.grid.cols}×${data.world.grid.rows} hexágonos</b> (${data.world.grid.radius * 2} km de esquina a esquina).
      Cada hexágono se asigna a uno de los <b>25 departamentos/regiones</b> (24 departamentos + Callao) y a una de las
      <b>196 provincias</b> según su código UBIGEO.</p>
      <p>Las <b>ciudades</b> representan las 48 principales áreas metropolitanas y capitales provinciales del país.</p>
      <h4>Controles</h4>
      <p>Arrastrar o flechas / WASD para mover · rueda, +/– o doble clic para acercar · clic en una ciudad o región para inspeccionarla ·
      <code>/</code> o Ctrl+K para buscar · <code>L</code> para cambiar de lente · <code>R</code> para mostrar/ocultar recursos · <code>?</code> ayuda · <code>Esc</code> cerrar.</p>`,
    Rendimientos: () => `
      ${h2("y-production", "⚙️", "Rendimientos")}
      <p>Los cinco rendimientos clásicos traducen estadísticas económicas y laborales reales del Perú (INEI / RENTOCA).
      <b>El Oro corresponde al Producto Bruto Interno (PBI)</b> anual.</p>
      <table>${data.nation.yields.map((y) => `<tr><td class="ic" style="color:${esc(y.color)}">${glyph(y, 26)}</td><td><b style="color:${esc(y.color)}">${esc(y.label)}${y.key === "gold" ? " (PBI)" : ""}</b><br>${esc(y.description)}</td></tr>`).join("")}</table>`,
    Regiones: () => `
      ${h2("terrain", "🗺️", "Departamentos y Provincias")}
      <p>Haz clic en cualquier hexágono de tierra sin ciudad para abrir el panel de su <b>departamento / región</b> (${esc(data.nation.vintage)};
      PBI: ${esc(data.nation.gdp_vintage || "INEI")}).</p>
      <p>Los puestos (<code>#1 de 25</code>) comparan los 24 departamentos y la Provincia Constitucional del Callao. En la Vista de Ciudad
      y en el <b>Explorador</b> puedes analizar las <b>196 provincias</b>.</p>`,
    Terreno: () => {
      const t = data.w?.tables || resolveTables(data.world.tables);
      const hasCover = Array.isArray(data.world.cover);
      const row = (x) => `<tr><td class="nm">${x.color ? `<span class="swatch" style="background:${esc(x.color)}"></span>` : ""}${
        COVER_ICON[x.key] ? icon(COVER_ICON[x.key], "", { size: 15 }) + " " : ""}<b>${esc(x.name)}</b></td><td>${esc(x.rule || "")}</td></tr>`;
      return `
      ${h2("terrain", "🗺️", "Terreno y Pisos Ecológicos")}
      <p>Cada hexágono resume la elevación terrestre (SRTM) y batimetría oceánica (ETOPO1, incluyendo la Fosa de Perú-Chile)
      junto con las regiones naturales del Perú (Costa, Yunga, Quechua, Suni, Puna, Janca, Selva Alta y Selva Baja).</p>
      <h4>${icon("l-forest", "🌲", { size: 16 })} Cobertura de suelo</h4>
      ${hasCover ? `<table>${t.cover.filter((x) => x.id > 0).map(row).join("")}</table>` : ""}
      <h4>Relieve</h4>
      <table>${t.relief.map(row).join("")}</table>
      <h4>${icon("r-hydro", "💧", { size: 16 })} Agua</h4>
      <table>${t.water.filter((x) => x.id > 0).map(row).join("")}</table>`;
    },
    Lentes: () => `
      ${h2("layers", "▤", "Lentes Temáticos")}
      <p>Los lentes recolorean los hexágonos del Perú según indicadores provinciales y departamentales (${esc(data.lenses.vintage)}).
      Desliza el cursor o arrastra sobre el histograma de la leyenda para filtrar rangos en el mapa.</p>
      ${(data.lenses.groups || [{ id: null, name: "" }]).map((g) => {
        const ls = data.lenses.lenses.filter((l) => !g.id || l.group === g.id);
        if (!ls.length) return "";
        return `${g.name ? `<h3 class="grp">${icon(`g-${g.id}`, "", { size: 16 })} ${esc(g.name)}</h3>` : ""}${ls.map((l) => `
          <div class="lens-entry"><div class="le-ic">${glyph(l, 26)}</div><div>
          <h4>${esc(l.name)}</h4><p>${esc(l.description)}<br>
          <i class="le-ramp" style="background:linear-gradient(90deg, ${(l.ramp || []).map(esc).join(",")})"></i>
          <span class="muted">Escala: ${esc(l.scale)} · ${esc(srcName(l.source))}</span></p></div></div>`).join("")}`;
      }).join("")}`,
    Recursos: () => {
      const r = data.resources;
      if (!r?.types?.length) return `${h2("resources", "⛏️", "Recursos")}<p class="muted">Sin capa de recursos.</p>`;
      const count = new Map();
      for (const it of r.items || []) count.set(it.type, (count.get(it.type) || 0) + 1);
      const cats = [...new Set(r.types.map((t) => t.category || "other"))];
      return `
      ${h2("resources", "⛏️", "Recursos Energéticos y Mineros")}
      <p>Muestra las principales centrales eléctricas del SEIN, lotes de gas natural y petróleo, y grandes unidades mineras del Perú (MINEM).
      Pulsa <b>R</b> para mostrarlos u ocultarlos.</p>
      ${cats.map((c) => `<h4>${esc(CATEGORY[c] || c)}</h4><table class="res-table">
        <tr><th></th><th>Tipo</th><th>Descripción</th><th>Sitios</th></tr>
        ${r.types.filter((t) => (t.category || "other") === c).map((t) => `<tr>
          <td class="ic"><span class="res-ic" style="background:${esc(t.color || "#24384f")};color:${inkOn(t.color)}">${glyph(t, 20)}</span></td>
          <td class="nm"><b>${esc(t.name)}</b>${t.unit ? `<br><span class="muted">${esc(t.unit)}</span>` : ""}</td>
          <td>${esc(t.description || "")}<br><span class="muted">Fuente: ${esc(srcName(t.source))}</span></td>
          <td class="num">${count.get(t.id) || 0}</td></tr>`).join("")}</table>`).join("")}`;
    },
    Fuentes: () => `
      ${h2("pedia", "📖", "Fuentes Oficiales")}
      ${data.sources.map((s) => `
        <h4>${esc(s.title)}</h4>
        <p>${esc(s.description)}<br>
        <span class="muted">${esc(s.publisher)} · ${esc(s.license)}${s.vintage ? " · " + esc(s.vintage) : ""} ·
        <a href="${esc(s.homepage)}" target="_blank" rel="noopener">enlace oficial</a></span></p>
        <table>${(s.files || []).map((f) => `<tr><td><code>${esc(f.url)}</code></td><td class="muted" style="white-space:nowrap">${esc((f.retrieved || "").slice(0, 10))}<br>${((f.bytes || 0) / 1e6).toFixed(1)} MB</td></tr>`).join("")}</table>`).join("")}`,
  };

  const ALIASES = {
    "About this map": "Sobre este mapa",
    Yields: "Rendimientos",
    States: "Regiones",
    Terrain: "Terreno",
    Lenses: "Lentes",
    Resources: "Recursos",
    Sources: "Fuentes",
  };

  const show = (name) => {
    name = ALIASES[name] || name;
    if (!pages[name]) name = "Sobre este mapa";
    body.innerHTML = pages[name]();
    body.scrollTop = 0;
    nav.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.page === name;
      b.classList.toggle("active", on);
      b.setAttribute("aria-current", on ? "page" : "false");
    });
  };
  nav.innerHTML = `<div class="hd">Almanaque</div>` + Object.keys(pages).map((p) => `<button data-page="${esc(p)}">${esc(p)}</button>`).join("");
  nav.onclick = (e) => {
    const b = e.target.closest("button[data-page]");
    if (b) show(b.dataset.page);
  };
  const close = () => {
    if (modal.hidden) return;
    modal.hidden = true;
    if (restoreFocus && document.contains(restoreFocus)) restoreFocus.focus();
    restoreFocus = null;
  };
  modal.onclick = (e) => {
    if (e.target === modal || e.target.closest("[data-close]")) close();
  };
  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const f = [...card.querySelectorAll("button, a[href], [tabindex]:not([tabindex='-1'])")].filter((x) => x.offsetParent);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  return {
    open(page = "Sobre este mapa") {
      if (modal.hidden) restoreFocus = document.activeElement;
      show(page);
      modal.hidden = false;
      (nav.querySelector("button.active") || card.querySelector("[data-close]"))?.focus();
    },
    close,
    get isOpen() {
      return !modal.hidden;
    },
  };
}
