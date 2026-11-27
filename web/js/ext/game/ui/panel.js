// Panel lateral del Gobernador: Onboarding, Día 1 Comité, Cartera, Ofertas, OxI y Registro.
import { esc } from "../../../format.js";
import { available, routeMinutes } from "../engine/index.js";
import { renderCommitteeView } from "./committee.js";
import { describeEvent, fmtMoney, fmtWater, reasonText } from "./format.js";
import { renderEmphasisStep, renderFlashback, renderOnboardingSetup } from "./onboarding.js";

const totalCost = (def) => (def.phases || []).reduce((s, p) => s + (p.cost || 0), 0);
const totalDays = (def) => (def.phases || []).reduce((s, p) => s + (p.duration || 0), 0);

function renderWorkCard(def, st, fundId, kind) {
  const active = kind === "project" ? st.projects?.[def.id] : st.agreements?.[def.id];
  let badge = `<span class="gm-badge">Disponible</span>`;
  if (active?.status === "delivered") badge = `<span class="gm-badge ok">Entregada</span>`;
  else if (active) badge = `<span class="gm-badge">En curso</span>`;
  const actBtn = active || st.sealed
    ? ""
    : `<button type="button" class="gh-btn active gm-act" data-order="${kind}" data-id="${esc(def.id)}" data-fund="${esc(fundId)}">${kind === "agreement" ? "Firmar convenio" : "Ejecutar obra"}</button>`;
  return `<div class="gm-card">
    <div class="gm-card-head"><span class="gm-card-title">${esc(def.name || def.id)}</span>${badge}</div>
    <div class="gm-meta"><span>Costo: <b>${fmtMoney(totalCost(def))}</b></span><span>Plazo: <b>${totalDays(def)} d</b></span><span>O&amp;M: <b>${fmtMoney(def.maintenance?.amount || 0)}/año</b></span></div>
    ${actBtn}
  </div>`;
}

function renderCartera(sc, st) {
  const fundId = sc.funds?.[0]?.id || "";
  const works = (sc.projects || []).map((p) => renderWorkCard(p, st, fundId, "project")).join("");
  const ags = (sc.agreements || []).map((a) => renderWorkCard(a, st, fundId, "agreement")).join("");
  const insp = (sc.sites || []).filter((s) => s.actorId && !st.inspections?.[s.id] && !st.sealed).map((s) => `
    <div class="gm-card">
      <div class="gm-card-head"><span class="gm-card-title">Inspección técnica de predio (${esc(s.id)})</span><span class="gm-badge">Requisito por etapas</span></div>
      <button type="button" class="gh-btn gm-act" data-order="inspect" data-id="${esc(s.id)}">Solicitar inspección</button>
    </div>`).join("");
  return `${works}${ags}${insp}`;
}

function candidateMinutes(c, st) {
  if (!c) return null;
  if (c.minutes != null) return c.minutes;
  return c.route ? routeMinutes(st.edges, c.route.from, c.route.to) : null;
}

function offerBadge(res, date) {
  if (res.status === "awarded") return `<span class="gm-badge ok">Ganada (${esc(res.siteId)})</span>`;
  if (res.status === "unawarded") return `<span class="gm-badge bad">Desierta</span>`;
  return `<span class="gm-badge">Decide: ${esc(date)}</span>`;
}

function offerReqRows(reqs, st, cand) {
  const row = (ok, lbl, val) => `<div class="gm-req ${ok ? "ok" : "bad"}"><span>${ok ? "✔" : "✘"} ${esc(lbl)}</span><b>${esc(val)}</b></div>`;
  const rows = [];
  if (reqs.access) {
    const hasAcc = !!(cand && st.access?.[cand.siteId]);
    rows.push(row(hasAcc, "Acceso habilitado", hasAcc ? "Sí" : "No"));
  }
  if (reqs.maxMinutes != null) {
    const mins = candidateMinutes(cand, st);
    rows.push(row(mins != null && mins <= reqs.maxMinutes, `Ruta ≤ ${reqs.maxMinutes} min`, mins == null ? "Cortada" : `${mins} min`));
  }
  if (reqs.water != null) {
    const waterAvail = cand?.waterNodeId ? available(st, cand.waterNodeId) : null;
    rows.push(row(waterAvail != null && waterAvail >= reqs.water, `Agua ≥ ${fmtWater(reqs.water)}`, fmtWater(waterAvail)));
  }
  return rows.join("");
}

function renderOfferCard(offer, st) {
  const res = st.offers?.[offer.id] || { status: "pending" };
  const cands = offer.candidates || [];
  const localCand = cands.find((c) => !String(c.id).includes("rival")) || cands[0];
  const rivalCand = cands.find((c) => String(c.id).includes("rival"));
  return `<div class="gm-card">
    <div class="gm-card-head"><span class="gm-card-title">${esc(offer.name || offer.id)}</span>${offerBadge(res, offer.date)}</div>
    <div class="gm-meta"><span>Rival: <b>${esc(rivalCand?.minutes ?? "—")} min</b></span></div>
    ${offerReqRows(offer.requirements || {}, st, localCand)}
    ${res.reasonCode ? `<p class="gm-note">Motivo: ${esc(reasonText(res.reasonCode))}</p>` : ""}
  </div>`;
}

function oxiButtons(p, st) {
  if (st.sealed) return "";
  const status = p ? p.status : "none";
  if (status === "none") return `<button type="button" class="gh-btn active gm-act" data-oxi="reserveOxi">Reservar cupo CIPRL</button>`;
  if (status === "reserved") return `<button type="button" class="gh-btn active gm-act" data-oxi="commitOxi">Firmar convenio OxI</button><button type="button" class="gh-btn gm-act" data-oxi="cancelOxi">Cancelar reserva</button>`;
  if (status === "committed") return `<button type="button" class="gh-btn active gm-act" data-oxi="issueCiprl">Emitir CIPRL</button><button type="button" class="gh-btn gm-act" data-oxi="cancelOxi">Cancelar (con liquidación)</button>`;
  return "";
}

function renderOxi(sc, st) {
  const limits = Object.values(st.ciprl?.limits || {});
  if (!limits.length) return `<p class="gm-note">Este escenario no usa tope OxI / CIPRL.</p>`;
  const limHtml = limits.map((l) => `<div class="gm-card"><div class="gm-card-head"><span class="gm-card-title">Tope CIPRL (${esc(l.id)})</span><span class="gm-badge ok">Libre: ${fmtMoney(l.free)}</span></div><div class="gm-meta"><span>Techo: <b>${fmtMoney(l.ceiling)}</b></span><span>Previo: <b>${fmtMoney(l.prior)}</b></span><span>Reservado: <b>${fmtMoney(l.reserved)}</b></span><span>Emitido: <b>${fmtMoney(l.issued)}</b></span></div></div>`).join("");
  const projs = (sc.oxiProjects || []).map((def) => {
    const p = st.ciprl?.projects?.[def.id];
    const total = Object.values(def.tranches || {}).reduce((a, b) => a + b, 0);
    return `<div class="gm-card" data-oxi-id="${esc(def.id)}"><div class="gm-card-head"><span class="gm-card-title">${esc(def.name)}</span><span class="gm-badge">${esc(p?.status || "disponible")}</span></div><div class="gm-meta"><span>Monto: <b>${fmtMoney(total)}</b></span><span>Obra: <b>${esc(def.workId)}</b></span></div>${oxiButtons(p, st)}</div>`;
  }).join("");
  return `${limHtml}${projs}`;
}

function renderRegistro(st, log) {
  const endCard = st.sealed
    ? `<div class="gm-card"><div class="gm-card-head"><span class="gm-card-title">Mandato finalizado</span><span class="gm-badge ${st.outcome?.investment ? "ok" : "bad"}">${st.outcome?.investment ? "Meta lograda" : "Meta no lograda"}</span></div><p class="gm-note">Fecha de cierre: ${esc(st.date)}. Puedes reiniciar o cambiar de escenario arriba.</p></div>`
    : "";
  const items = [...log].reverse().slice(0, 30).map((ev) => {
    const info = describeEvent(ev);
    return `<div class="gm-log-item ${info.cls}"><b>${esc(ev.date)}</b> — ${esc(info.text)}</div>`;
  }).join("");
  return `${endCard}<div class="gm-log">${items || '<p class="gm-note">Sin eventos aún. Ejecuta una obra o avanza el reloj.</p>'}</div>`;
}

function handlePanelClick(e, handlers) {
  const ob = e.target.closest("[data-ob]");
  if (ob) return handlers.onOnboarding(ob.dataset.ob, ob.dataset.val);
  const d1 = e.target.closest("[data-day1-act]");
  if (d1) return handlers.onDayOneAction(d1.dataset.day1Act, d1.dataset.fund || "");
  if (e.target.closest("[data-day1-done]")) return handlers.onDayOneDone();
  const oxi = e.target.closest("[data-oxi]");
  if (oxi) return handlers.onOxi(oxi.dataset.oxi, oxi.closest("[data-oxi-id]")?.dataset.oxiId || "");
  const tab = e.target.closest("[data-tab]");
  if (tab) return handlers.onTab(tab.dataset.tab);
  const ord = e.target.closest("[data-order]");
  if (ord) return handlers.onOrder(ord.dataset.order, ord.dataset.id, ord.dataset.fund || "");
  if (e.target.closest("[data-back-picker]")) handlers.onShowPicker();
}

function panelBody(session) {
  if (session.tab === "ofertas") return (session.scenario.offers || []).map((o) => renderOfferCard(o, session.state)).join("");
  if (session.tab === "oxi") return renderOxi(session.scenario, session.state);
  if (session.tab === "registro") return renderRegistro(session.state, session.events);
  return renderCartera(session.scenario, session.state);
}

function renderPhase(session, dataset) {
  if (session.phase === "setup") return renderOnboardingSetup(dataset, session.onboarding);
  if (session.phase === "flashback") return renderFlashback(session.onboarding);
  if (session.phase === "emphasis") return renderEmphasisStep(session.onboarding);
  const reg = (dataset.regions || []).find((r) => r.id === session.scenario?.regionId);
  if (session.phase === "day1") return renderCommitteeView(session, reg);
  return null;
}

export function createGamePanel(handlers) {
  let host = null;
  return {
    attach(el) {
      host = el;
      if (host.dataset.gameBound) return;
      host.dataset.gameBound = "1";
      host.addEventListener("click", (e) => handlePanelClick(e, handlers));
      host.addEventListener("input", (e) => e.target.matches("[data-ob-input='name']") && handlers.onOnboarding("name", e.target.value));
      host.addEventListener("change", (e) => e.target.dataset.obSelect && handlers.onOnboarding(e.target.dataset.obSelect, e.target.value));
    },
    detach() { host = null; },
    render(session, dataset) {
      if (!host) return;
      const phaseHtml = renderPhase(session, dataset);
      if (phaseHtml != null) { host.innerHTML = phaseHtml; return; }
      const tab = session.tab || "cartera";
      const tabBtn = (id, lbl) => `<button type="button" class="gm-tab${tab === id ? " active" : ""}" data-tab="${id}">${lbl}</button>`;
      host.innerHTML = `<div class="gm-wrap">
        <div class="gm-head">
          <div><h2 class="gm-title">${esc(session.scenario.name)}</h2><p class="gm-sub">Gob. ${esc(session.govName)} · Énfasis: ${esc(session.onboarding.emphasis)}</p></div>
          <button type="button" class="gh-btn" data-back-picker="1">Nueva</button>
        </div>
        <div class="gm-tabs">${tabBtn("cartera", "Cartera")}${tabBtn("ofertas", "Ofertas")}${tabBtn("oxi", "OxI")}${tabBtn("registro", `Reg. (${session.events.length})`)}</div>
        ${panelBody(session)}
      </div>`;
    },
  };
}
