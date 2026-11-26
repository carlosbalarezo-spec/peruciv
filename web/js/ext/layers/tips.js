// Tooltips en español para las capas estáticas del mapa (puertos, aeropuertos, bases militares, maravillas y rutas comerciales).
import { esc, compact, int, pct } from "../../format.js";
import { FORT_KINDS, fortKind } from "../../render/art/sites.js";
import { MODE_STYLE } from "../../render/art/improvements.js";

const muted = (s) => `<span class="muted">${s}</span>`;
const num = (n) => (n == null || !Number.isFinite(n) ? "–" : compact(n));
const sign = (x) => (x > 0 ? "+" : x < 0 ? "−" : "±");

function usd(n) {
  if (n == null || !Number.isFinite(n)) return "–";
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}B`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(a >= 1e10 ? 1 : 2)} mil M`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(1)} M`;
  return `$${int(n)}`;
}

const HUB_NAME = { L: "Hub internacional principal", M: "Aeropuerto troncal regional", S: "Aeropuerto regional", N: "Aeródromo regional" };
const PORT_TYPE = { coastal: "Puerto marítimo", great_lakes: "Puerto lacustre", inland: "Puerto fluvial amazónico" };
const WONDER_LABEL = { natural: "Área Natural Protegida (SERNANP)", university: "Universidad Licenciada (SUNEDU)", landmark: "Patrimonio Cultural (MINCETUR)" };
const MODE_LABEL = { truck: "Carretera", rail: "Ferrocarril", water: "Marítimo / fluvial", air: "Aéreo", pipeline: "Ducto", multiple: "Multimodal" };

export const tips = {
  port(p) {
    const yr = p.year ?? "";
    const lines = [
      `<b>${esc(p.name)}</b> ${muted(`${esc(PORT_TYPE[p.type] || "Puerto")}, ${esc(p.state || "")}`)}`,
      `#${esc(p.rank)} por carga movilizada · <b>${num(p.tons)}</b> toneladas (${esc(yr)})`,
    ];
    if (p.foreign != null || p.domestic != null) lines.push(`Comercio exterior ${num(p.foreign)} · cabotaje ${num(p.domestic)}`);
    if (p.imports != null || p.exports != null) lines.push(`Importación ${num(p.imports)} · exportación ${num(p.exports)}`);
    lines.push(muted("Terminales portuarios supervisados por APN / OSITRAN."));
    return lines.join("<br>");
  },
  airport(a) {
    const lines = [`<b>${esc(a.id)} · ${esc(a.name)}</b> ${muted(esc([a.city, a.state].filter(Boolean).join(", ")))}`];
    lines.push(a.hub ? esc(HUB_NAME[a.hub] || a.hub) : "Terminal aéreo de carga");
    if (a.enplanements != null) {
      let ch = "";
      if (a.enplanements_prev > 0) {
        const r = a.enplanements / a.enplanements_prev - 1;
        ch = ` (${sign(r)}${Math.abs(r * 100).toFixed(1)}% vs. ${a.year - 1})`;
      }
      lines.push(`<b>${num(a.enplanements)}</b> pasajeros en ${esc(a.year)}${ch}`);
    }
    if (a.cargo_lbs != null) lines.push(`Carga aérea ${num(a.cargo_lbs)} lb`);
    lines.push(muted("Tráfico aéreo reportado por CORPAC / OSITRAN."));
    return lines.join("<br>");
  },
  fort(f, m) {
    const comp = m.data.military?.components?.find((c) => c.id === f.component);
    const name = comp?.name || FORT_KINDS[fortKind(f.component)]?.name || "Sede de Defensa";
    const tier = { major: "Sede principal", base: "Base", site: "Destacamento" }[f.tier] || "";
    const status = { act: "", semi: " · semiactiva", care: " · reserva" }[f.status] ?? "";
    const lines = [
      `<b>${esc(f.name)}</b> ${muted(esc(f.state || ""))}`,
      `${esc(name)}${f.joint ? " · comando conjunto" : ""} · ${esc(tier)}${esc(status)}`,
    ];
    if (f.area_km2 != null) lines.push(`Área operativa aprox. ${int(f.area_km2)} km²`);
    lines.push(muted("Directorio institucional de las FF.AA. del Perú (EP, MGP, FAP, CCFFAA)."));
    return lines.join("<br>");
  },
  range(r, m) {
    const comp = m.data.military?.components?.find((c) => c.id === r.component);
    return [
      `<b>${esc(r.name)}</b> ${muted(esc(r.state || ""))}`,
      `Zona operativa / polígono militar · ${esc(comp?.name || "")} · ${int(r.area_km2)} km²`,
      muted("Área militar estratégica representada sobre los hexágonos que abarca."),
    ].join("<br>");
  },
  wonder(x, m) {
    const k = WONDER_LABEL[x.kind] || "Maravilla del Perú";
    const rule = m.data.wonders?.rules?.find((r) => r.id === x.rule);
    const mt = x.metrics || {};
    const lines = [`<b>${esc(x.name)}</b> ${muted(esc([x.state].filter(Boolean).join("")))}`];
    if (x.kind === "university") {
      lines.push(`${esc(k)} · #${esc(x.rank)} en investigación`);
      if (mt.rd_usd != null) lines.push(`Inversión I+D ${usd(mt.rd_usd)} (${esc(mt.year)})${mt.federal_usd != null ? `, ${pct(mt.federal_usd / mt.rd_usd, 0)} fondos públicos` : ""}`);
      if (mt.enrollment != null) lines.push(`${int(mt.enrollment)} estudiantes (${esc(mt.enrollment_year || mt.year || "")})`);
    } else if (x.curated) {
      lines.push(`${esc(k)} · selección patrimonial`);
      if (mt.visits != null) lines.push(`${num(mt.visits)} visitas registradas (${esc(mt.year)})`);
      if (mt.designated) lines.push(`Patrimonio reconocido desde ${esc(mt.designated)}`);
    } else {
      lines.push(`${esc(k)} · #${esc(x.rank)} por visitas`);
      if (mt.visits != null) lines.push(`<b>${num(mt.visits)}</b> visitas (${esc(mt.year)})${mt.visits_of ? ` ${muted(`(${esc(mt.visits_of)})`)}` : ""}`);
      if (mt.area_km2 != null) lines.push(`${int(mt.area_km2)} km² protegidos`);
    }
    if (rule?.text) lines.push(muted(esc(rule.text)));
    return lines.join("<br>");
  },
  route(rt, m) {
    const r = rt.route;
    const t = m.data.trade || {};
    const a = rt.a?.short || rt.a?.name || r.a, b = rt.b?.short || rt.b?.name || r.b;
    const modes = Object.entries(r.modes || {}).filter(([, v]) => v >= 0.05).sort((p, q) => q[1] - p[1])
      .map(([k, v]) => `${esc(MODE_LABEL[k] || MODE_STYLE[k]?.label || k)} ${Math.round(v * 100)}%`).join(" · ");
    const com = t.commodities?.[r.top_commodity];
    const lines = [
      `<b>${esc(a)} ⇄ ${esc(b)}</b> ${muted(`corredor #${esc(r.rank)}`)}`,
      `<b>${usd(r.value_musd * 1e6)}</b> anuales · ${num(r.tons_k * 1e3)} toneladas (${esc(t.vintage || t.year || "")})`,
    ];
    if (modes) lines.push(modes);
    if (com) lines.push(`Carga principal: ${esc(com)}`);
    lines.push(muted("Flujo estimado en ambos sentidos entre zonas logísticas del Perú (MTC / MINCETUR / APN)."));
    return lines.join("<br>");
  },
};
