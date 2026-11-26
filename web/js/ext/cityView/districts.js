// Sección "Distritos" en la Vista de Ciudad: especialización sectorial formal (MTPE) y guarniciones (military.json).
import { esc, int, pct } from "../../format.js";
import { compact, money } from "./fmt.js";
import { icon } from "../../ui/icon.js";
import { hasIcon } from "../../icons.js";

const FALLBACK = {
  campus: ["y-science", "🎓"], commercial_hub: ["i-finance", "💰"], industrial_zone: ["i-manufacturing", "🏭"],
  harbor: ["i-transportation", "⚓"], theater_square: ["i-arts", "🎭"], entertainment_complex: ["i-accommodation", "🎡"],
  aerodrome: ["i-transportation", "✈️"], government_plaza: ["i-public_admin", "🏛"], encampment: [null, "⛺"],
  aqueduct: ["i-utilities", "💧"],
};
const SHORT = {
  campus: "Campus", commercial_hub: "Comercio", industrial_zone: "Industria", harbor: "Puerto", theater_square: "Cultura",
  entertainment_complex: "Turismo", aerodrome: "Aeródromo", government_plaza: "Gobierno", encampment: "Guarnición",
  aqueduct: "Energía",
};
const TIER = { garrison: "Guarnición", fortress: "Plaza Fuerte" };

const catCache = new WeakMap();
function catalog(ddata) {
  let m = catCache.get(ddata);
  if (!m) catCache.set(ddata, (m = new Map((ddata?.catalog || []).map((c) => [c.id, c]))));
  return m;
}

export function iconFor(id, cat) {
  if (cat?.icon && hasIcon(cat.icon)) return cat.icon;
  const f = FALLBACK[id]?.[0];
  return f && hasIcon(f) ? f : null;
}

const instCache = new WeakMap();
function installationsById(mil) {
  let m = instCache.get(mil);
  if (!m) instCache.set(mil, (m = new Map((mil?.installations || []).map((i) => [i.id, i]))));
  return m;
}

export function cityDistricts(ddata, mil, id) {
  const cat = catalog(ddata);
  const row = ddata?.cities?.[id] || null;
  const mc = mil?.cities?.[id] || null;
  const out = [];
  for (const d of row?.districts || []) {
    const c = cat.get(d.id) || {};
    const spec = d.via === "specialty" && d.sub;
    out.push({
      ...d, name: c.name || d.id, color: c.color || "#5a6a7a", icon: iconFor(d.id, c), emoji: FALLBACK[d.id]?.[1] || "◆",
      cat: c, subName: d.sub ? c.sub?.[d.sub] || ddata.industries?.[d.sub]?.title || d.sub : null,
      short: spec ? c.sub?.[d.sub] || SHORT[d.id] : SHORT[d.id] || c.name || d.id,
      mapLq: spec ? d.sub_lq : d.lq,
      military: d.id === "encampment" ? mc : null,
    });
  }
  if (mc && !out.some((d) => d.id === "encampment")) {
    const c = cat.get("encampment") || {};
    out.push({
      id: "encampment", name: c.name || "Guarnición Militar", color: c.color || "#8a4a3a", icon: iconFor("encampment", c), emoji: "⛺",
      cat: c, lq: null, emp: null, short: TIER[mc.tier] || "Guarnición", mapLq: null, military: mc, militaryOnly: true,
    });
  }
  for (const d of out) {
    if (d.military) d.tierLabel = TIER[d.military.tier] || d.military.tier;
  }
  return out;
}

export function badgeOf(ddata, id) {
  if (!ddata) return ddata;
  const row = ddata.cities?.[id];
  if (!row) return null;
  if (!row.badge) return { label: "Economía diversificada", text: "Ningún distrito supera el umbral de especialización.", color: "#6a7484", icon: null, district: null };
  const c = catalog(ddata).get(row.badge.district) || {};
  return { ...row.badge, color: c.color || "#6a7484", icon: iconFor(row.badge.district, c), emoji: FALLBACK[row.badge.district]?.[1] };
}

export function badgeHtml(m, ddata) {
  const b = badgeOf(ddata, m.city.id);
  if (!b) return "";
  return `<span class="cv-type${b.district ? "" : " plain"}" style="--tc:${esc(b.color)}" title="Especialidad: ${esc(b.text || b.label)} (${esc(ddata.vintage || "MTPE")})">
    <span class="cv-type-ic">${icon(b.icon, b.emoji || "◆", { size: 13 })}</span>${esc(b.label)}</span>`;
}

const ge = (lb) => (lb ? "≥" : "");
const signed = (x) => (x == null ? "–" : `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1)}%`);

function lqTag(lq, lb, tip) {
  if (lq == null) return "";
  const cls = lq >= 1.25 ? "hi" : lq <= 0.75 ? "lo" : "mid";
  return `<span class="cv-lq ${cls}" title="${esc(tip || `Cociente de localización: ${lq.toFixed(2)}× la proporción nacional`)}">×${ge(lb)}${lq.toFixed(1)}</span>`;
}

function districtCard(d, row, ddata, mil) {
  const c = d.cat || {};
  const lb = !!d.lower_bound;
  const facts = [];
  if (d.emp != null) {
    facts.push(`<div><span>Empleos formales</span><b>${ge(lb)}${compact(d.emp)}</b><small>${d.share != null ? `${pct(d.share, 1)} de la ciudad` : ""}</small></div>`);
  }
  if (d.avg_pay != null) {
    facts.push(`<div><span>Remun. anual</span><b>${money(d.avg_pay)}</b><small>${row?.avg_pay != null ? `ciudad ${money(row.avg_pay)}` : ""}</small></div>`);
  }
  if (d.strength != null) {
    facts.push(`<div title="Empleos por encima del promedio nacional"><span>Sobre norma</span><b>${ge(lb)}${compact(Math.max(0, d.strength))}</b><small>puestos</small></div>`);
  }
  let spec = "";
  if (d.sub && d.subName) {
    const slb = !!d.sub_lower_bound;
    spec = `<p class="cv-dc-sub">${d.via === "specialty" ? "Califica por" : "Especialidad líder"}: <b>${esc(d.subName)}</b> ${lqTag(d.sub_lq, slb)}${
      d.sub_emp != null ? ` <small>${ge(slb)}${compact(d.sub_emp)} puestos</small>` : ""}</p>`;
  }
  let milHtml = "";
  if (d.military) {
    const mc = d.military;
    const inst = installationsById(mil);
    const names = (mc.installations || []).map((i) => inst.get(i)?.name).filter(Boolean);
    milHtml = `<div class="cv-dc-mil">
      <p><b>${esc(d.tierLabel)}</b>${mc.naval ? " (naval)" : ""}: ≈${int(mc.armed_forces)} efectivos estimados (${pct(mc.share, 1)} de adultos 16+).</p>
      ${names.length ? `<p class="cv-dc-inst">${names.slice(0, 5).map((n) => `<span>${esc(n)}</span>`).join("")}</p>` : ""}
    </div>`;
  }
  const title = d.militaryOnly || d.military ? `${esc(d.name)} · ${esc(d.tierLabel)}` : esc(d.name);
  return `<div class="cv-dc" style="--dc:${esc(d.color)}" title="${esc(c.description || "")}">
    <div class="cv-dc-h"><span class="cv-dc-hex">${icon(d.icon, d.emoji, { size: 18 })}</span>
      <div class="cv-dc-t"><b>${title}</b><small>${esc(c.description || "")}</small></div>
      ${d.lq != null ? lqTag(d.lq, lb) : ""}</div>
    ${facts.length ? `<div class="cv-dc-f">${facts.join("")}</div>` : ""}
    ${spec}${milHtml}
  </div>`;
}

function topTable(row, ddata) {
  const top = row?.top || [];
  if (!top.length) return "";
  const max = Math.max(...top.map((t) => t.lq || 0), 1);
  return `<h4 class="cv-h4">Sectores más especializados <span class="muted">por cociente de localización</span></h4>
  <div class="cv-top" role="table" aria-label="Sectores más especializados">
    <div class="cv-top-r cv-top-hd" role="row"><span role="columnheader">Sector</span><span role="columnheader">Empleos</span><span role="columnheader">×Perú</span><span role="columnheader">Remun.</span><span role="columnheader">1 año</span></div>
    ${top.map((t) => {
      const title = ddata.industries?.[t.naics]?.title || `CIIU ${t.naics}`;
      const lb = !!t.lower_bound;
      return `<div class="cv-top-r" role="row" title="${esc(title)}">
        <span role="cell" class="cv-top-n">${esc(title)}<i style="width:${((Math.log(1 + (t.lq || 0)) / Math.log(1 + max)) * 100).toFixed(1)}%"></i></span>
        <span role="cell">${ge(lb)}${compact(t.emp)}</span>
        <span role="cell"><b>${t.lq != null ? `${ge(lb)}${t.lq.toFixed(1)}` : "–"}</b></span>
        <span role="cell">${money(t.avg_pay)}</span>
        <span role="cell" class="${t.oty_pct == null ? "" : t.oty_pct >= 0 ? "good" : "bad"}">${signed(t.oty_pct)}</span></div>`;
    }).join("")}
  </div>`;
}

export function districtsHtml(m, ddata, mil) {
  if (ddata === undefined) return `<p class="muted cv-note">Cargando distritos…</p>`;
  if (!ddata) return `<p class="muted cv-note">Datos de distritos no disponibles.</p>`;
  const id = m.city.id;
  const row = ddata.cities?.[id] || null;
  const list = cityDistricts(ddata, mil, id);
  const b = badgeOf(ddata, id);
  let lead;
  if (!row) {
    lead = `<p class="cv-lead">Sin registros de planilla formal para ${esc(m.city.name)}.</p>`;
  } else {
    lead = `<p class="cv-lead">${b?.district ? `<b class="cv-type-l" style="--tc:${esc(b.color)}">${esc(b.label)}</b> · ${esc(b.text || "")}. ` : ""}${
      int(row.emp)} puestos formales estimados, remuneración anual media ${money(row.avg_pay)} (Perú ${money(ddata.national?.avg_pay)}).</p>`;
  }
  const cards = list.length
    ? `<div class="cv-dcs">${list.map((d) => districtCard(d, row, ddata, mil)).join("")}</div>`
    : `<p class="muted cv-note">Economía diversificada similar al promedio nacional.</p>`;
  return `${lead}
    ${cards}
    ${topTable(row, ddata)}
    <div class="cv-schematic">
      <p><b>◆ En el mapa</b> cada distrito aparece como una placa sobre un hexágono cercano a la ciudad (posición esquemática).</p>
    </div>
    <details class="cv-more cv-rule"><summary>Cómo se eligen los distritos</summary>
      <p>${esc(ddata.rule?.text || "")}</p>
    </details>
    <p class="cv-note">Fuente: ${esc(ddata.vintage || "MTPE Planilla Electrónica 2025")}. ×N = cociente de localización frente al promedio del Perú.</p>`;
}
