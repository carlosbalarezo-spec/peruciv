// Flujo de inicio de partida: Nombre + 25 regiones por nivel + Flashback saltable + Énfasis de gobierno.
import { esc } from "../../../format.js";

const FLASHBACK_FRAMES = [
  { icon: "📣", title: "Recorrido territorial", text: "Asambleas provinciales, escucha de brechas de agua, caminos y seguridad." },
  { icon: "📋", title: "Plan de gobierno", text: "Equipo técnico prioriza metas dentro del marco constitucional y el Invierte.pe." },
  { icon: "🗳️", title: "Jornada electoral", text: "La ciudadanía acude a las urnas en todas las provincias de la región." },
  { icon: "🏛️", title: "Proclamación y credenciales", text: "El Jurado Electoral entrega credenciales. Comienza tu mandato regional." },
];

const EMPHASES = [
  { id: "services", label: "Servicios básicos", desc: "Prioriza agua potable, salud y cierre de brechas provinciales." },
  { id: "investment", label: "Inversión y corredores", desc: "Prioriza conectividad, energía y atracción de capital privado." },
  { id: "dialogue", label: "Prevención y diálogo", desc: "Prioriza seguridad ciudadana, actas sociales y continuidad vial." },
  { id: "balanced", label: "Agenda equilibrada", desc: "Balancea servicios públicos, desarrollo productivo y paz social." },
];

const fmtSolesM = (v) => (v == null ? "Sin dato" : `S/ ${(v / 1e6).toFixed(1)}M`);

function regionOptions(regions, selectedId) {
  const byLvl = new Map();
  for (const r of regions) {
    if (!byLvl.has(r.level)) byLvl.set(r.level, []);
    byLvl.get(r.level).push(r);
  }
  return [...byLvl.entries()].sort((a, b) => a[0] - b[0]).map(([lvl, list]) => {
    const opts = list.map((r) => {
      const tag = r.playableScenario ? " ★ Jugable 3A" : " (Diagnóstico)";
      return `<option value="${esc(r.id)}"${r.id === selectedId ? " selected" : ""}>${esc(r.name)}${tag}</option>`;
    }).join("");
    return `<optgroup label="${esc(list[0].levelLabel)}">${opts}</optgroup>`;
  }).join("");
}

function renderRegionSummary(reg) {
  if (!reg) return "";
  const m = reg.mef2026 || {};
  const pct = m.pim ? `${Math.round((m.dev / m.pim) * 100)}%` : "—";
  const status = reg.playableScenario
    ? `<span class="gm-badge ok">Escenario 3A activo</span>`
    : `<span class="gm-badge">Solo diagnóstico Atlas</span>`;
  return `<div class="gm-card">
    <div class="gm-card-head"><span class="gm-card-title">${esc(reg.name)} · ${esc(reg.levelLabel)}</span>${status}</div>
    <div class="gm-meta">
      <span>Población: <b>${((reg.atlas?.population || 0) / 1e6).toFixed(2)}M</b></span>
      <span>Energía: <b>${reg.atlas?.energyMw ?? 0} MW</b></span>
    </div>
    <div class="gm-meta">
      <span>PIA 2026: <b>${fmtSolesM(m.pia)}</b></span>
      <span>PIM 2026: <b>${fmtSolesM(m.pim)}</b></span>
      <span>Devengado: <b>${pct}</b></span>
    </div>
    ${reg.playableScenario ? "" : `<p class="gm-note">Esta región muestra sus datos reales MEF/INEI 2026. Para simular partidas completas en Etapa 3A elige <b>Arequipa</b> o <b>Ica</b> (o usa los botones abajo).</p>`}
  </div>`;
}

export function renderOnboardingSetup(dataset, ob) {
  const regions = dataset.regions || [];
  const reg = regions.find((r) => r.id === ob.regionId) || regions.find((r) => r.id === "04") || regions[0];
  const launchBtn = reg?.playableScenario
    ? `<button type="button" class="gh-btn active gm-act" data-ob="start-flashback">Iniciar campaña y proclamación</button>`
    : `<button type="button" class="gh-btn active gm-act" data-ob="jump-aqp">Jugar Arequipa–Matarani (3A)</button>
       <button type="button" class="gh-btn gm-act" data-ob="jump-ica">Jugar Tutorial Ica–Pisco</button>`;
  return `<div class="gm-wrap">
    <div class="gm-head"><div><h2 class="gm-title">Nueva Gestión Regional</h2><p class="gm-sub">Simulación cívica · Marco constitucional peruano</p></div></div>
    <div class="gm-field"><label for="ob-name">Nombre del Gobernador(a)</label><input id="ob-name" class="gm-input" data-ob-input="name" value="${esc(ob.govName)}" maxlength="40" placeholder="Tu nombre"></div>
    <div class="gm-field"><label for="ob-region">Región a gobernar (por nivel)</label><select id="ob-region" class="gm-select" data-ob-select="region">${regionOptions(regions, reg?.id)}</select></div>
    <div class="gm-field"><label for="ob-clock">Fecha de inicio</label><select id="ob-clock" class="gm-select" data-ob-select="dateMode">
      <option value="current"${ob.dateMode === "current" ? " selected" : ""}>Fecha actual (What-If desde hoy)</option>
      <option value="fixed"${ob.dateMode === "fixed" ? " selected" : ""}>Calendario base (2026-01-01)</option>
    </select></div>
    ${renderRegionSummary(reg)}
    ${launchBtn}
    <button type="button" class="gh-btn gm-act" data-ob="explore-atlas">Solo explorar el Atlas (sin partida)</button>
  </div>`;
}

export function renderFlashback(ob) {
  const f = FLASHBACK_FRAMES[Math.min(ob.frame, FLASHBACK_FRAMES.length - 1)];
  const stepLbl = `Escena ${ob.frame + 1} de ${FLASHBACK_FRAMES.length}`;
  return `<div class="gm-wrap">
    <div class="gm-flash">
      <div class="gm-flash-ic">${f.icon}</div>
      <h3 class="gm-flash-title">${esc(f.title)}</h3>
      <p class="gm-note">${esc(f.text)}</p>
      <span class="gm-badge">${stepLbl}</span>
    </div>
    <button type="button" class="gh-btn active gm-act" data-ob="skip-flashback">Ir a elección de énfasis</button>
  </div>`;
}

export function renderEmphasisStep(ob) {
  const opts = EMPHASES.map((e) => `
    <button type="button" class="gh-btn gm-scen-btn${ob.emphasis === e.id ? " active" : ""}" data-ob="pick-emphasis" data-val="${e.id}">
      <b>${esc(e.label)}</b><br><small>${esc(e.desc)}</small>
    </button>`).join("");
  return `<div class="gm-wrap">
    <div class="gm-head"><div><h2 class="gm-title">Énfasis del Mandato</h2><p class="gm-sub">Gobernador(a) ${esc(ob.govName || "Regional")} · Fija tus metas iniciales</p></div></div>
    ${opts}
    <button type="button" class="gh-btn active gm-act" data-ob="begin-day1">Asumir el cargo (Día 1)</button>
  </div>`;
}

export { FLASHBACK_FRAMES };
