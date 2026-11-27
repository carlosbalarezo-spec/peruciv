// Día 1: Acta de entrega de cargo (MEF 2026) + Comité de Asesores como guardarraíl legal.
import { esc } from "../../../format.js";
import { fmtMoney, reasonText } from "./format.js";

const fmtSolesM = (v) => (v == null ? "—" : `S/ ${(v / 1e6).toFixed(1)}M`);

function renderMefBox(reg) {
  if (!reg?.mef2026) return "";
  const m = reg.mef2026;
  const cuis = (m.topCui || []).slice(0, 3).map((c) => `
    <div class="gm-cui"><b>CUI ${esc(c.cui)}</b> · PIM ${fmtSolesM(c.pim)} · ${esc(c.name.slice(0, 58))}</div>
  `).join("");
  return `<div class="gm-card">
    <div class="gm-card-head"><span class="gm-card-title">Acta de entrega · Cuentas MEF 2026</span><span class="gm-badge ok">Oficial</span></div>
    <div class="gm-meta"><span>PIA: <b>${fmtSolesM(m.pia)}</b></span><span>PIM: <b>${fmtSolesM(m.pim)}</b></span><span>Devengado: <b>${fmtSolesM(m.dev)}</b></span></div>
    ${cuis}
  </div>`;
}

function renderActionCard(act, st, fundId) {
  const done = (st.dayOne?.allocations || []).some((a) => a.actionId === act.id);
  const badge = done ? `<span class="gm-badge ok">Asignada (10 u.)</span>` : `<span class="gm-badge">Consultar / Asignar</span>`;
  return `<div class="gm-card">
    <div class="gm-card-head"><span class="gm-card-title">${esc(act.name)}</span>${badge}</div>
    <p class="gm-note">${esc(act.legalBasis || "")}</p>
    ${done ? "" : `<button type="button" class="gh-btn gm-act" data-day1-act="${esc(act.id)}" data-fund="${esc(fundId)}">Proponer ante Comité (10 u.)</button>`}
  </div>`;
}

export function renderCommitteeView(session, regionProfile) {
  const sc = session.scenario;
  const st = session.state;
  const fundId = sc.funds?.[0]?.id || "";
  const actions = (sc.budgetActions || []).map((a) => renderActionCard(a, st, fundId)).join("");
  const guard = session.dayOneNotice
    ? `<div class="gm-guard${session.dayOneNotice.ok ? " ok" : ""}"><b>${session.dayOneNotice.ok ? "✔ Comité aprueba:" : "⛔ Guardarraíl legal:"}</b> ${esc(session.dayOneNotice.text)}</div>`
    : "";
  return `<div class="gm-wrap">
    <div class="gm-head"><div><h2 class="gm-title">Día 1 · Comité de Asesores</h2><p class="gm-sub">Gobernador(a) ${esc(session.govName)} · Margen libre: ${fmtMoney(st.funds[fundId]?.balance || 0)}</p></div></div>
    ${renderMefBox(regionProfile)}
    ${guard}
    <p class="gm-note">Prueba qué decisiones permite la Constitución y la Ley del Canon, y cuáles bloquean tus asesores jurídicos y de presupuesto:</p>
    ${actions}
    <button type="button" class="gh-btn active gm-act" data-day1-done="1">Cerrar Día 1 y empezar gestión</button>
  </div>`;
}

export function guardrailMessage(act, result) {
  if (result.accepted) return { ok: true, text: `Asignación aprobada (${act.name}). ${act.legalBasis || ""}` };
  return { ok: false, text: `${reasonText(result.reasonCode)} — ${act.legalBasis || "Fuera de competencia o rubro."}` };
}
