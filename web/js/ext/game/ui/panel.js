// Panel lateral del Gobernador: selector de escenario, Cartera, Ofertas y Registro.
import { esc } from "../../../format.js";
import { available, routeMinutes } from "../engine/index.js";
import { describeEvent, fmtMoney, fmtWater, reasonText } from "./format.js";

const totalCost = (def) => (def.phases || []).reduce((s, p) => s + (p.cost || 0), 0);
const totalDays = (def) => (def.phases || []).reduce((s, p) => s + (p.duration || 0), 0);

function renderPicker(dataset) {
  const cards = (dataset.scenarios || []).map((sc) => `
    <div class="gm-card">
      <div class="gm-card-head">
        <span class="gm-card-title">${esc(sc.name)}</span>
        <span class="gm-badge">${esc(sc.startDate)} → ${esc(sc.endDate)}</span>
      </div>
      <div class="gm-note">${sc.id === "ica-pisco-tutorial"
        ? "Tutorial corto (5–8 min): resuelve el cuello de botella del acceso al Terminal San Martín antes del día 90."
        : "Escenario principal: elige entre ampliar el nodo de agua, mejorar el corredor a Matarani o negociar acceso prioritario por etapas."}</div>
      <button type="button" class="gh-btn active gm-act" data-pick="${esc(sc.id)}">Iniciar mandato</button>
    </div>
  `).join("");
  return `<div class="gm-wrap">
    <div class="gm-head"><div><h2 class="gm-title">Modo Gobernar (Simulación)</h2><p class="gm-sub">Elige un escenario sobre el mapa real del Perú</p></div></div>
    ${cards}
    <p class="gm-note">Nota: Los plazos, costos y ofertas de este prototipo están marcados como <b>simulación</b> sobre la geometría oficial de peruciv.</p>
  </div>`;
}

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
  const pick = e.target.closest("[data-pick]");
  if (pick) return handlers.onPickScenario(pick.dataset.pick);
  const tab = e.target.closest("[data-tab]");
  if (tab) return handlers.onTab(tab.dataset.tab);
  const ord = e.target.closest("[data-order]");
  if (ord) return handlers.onOrder(ord.dataset.order, ord.dataset.id, ord.dataset.fund || "");
  if (e.target.closest("[data-back-picker]")) handlers.onShowPicker();
}

function panelBody(session) {
  if (session.tab === "ofertas") return (session.scenario.offers || []).map((o) => renderOfferCard(o, session.state)).join("");
  if (session.tab === "registro") return renderRegistro(session.state, session.events);
  return renderCartera(session.scenario, session.state);
}

export function createGamePanel(handlers) {
  let host = null;

  return {
    attach(el) {
      host = el;
      if (!host.dataset.gameBound) {
        host.dataset.gameBound = "1";
        host.addEventListener("click", (e) => handlePanelClick(e, handlers));
      }
    },
    detach() { host = null; },
    render(session, dataset) {
      if (!host) return;
      if (!session.scenario || !session.state) {
        host.innerHTML = renderPicker(dataset);
        return;
      }
      const tab = session.tab || "cartera";
      const tabBtn = (id, lbl) => `<button type="button" class="gm-tab${tab === id ? " active" : ""}" data-tab="${id}">${lbl}</button>`;
      host.innerHTML = `<div class="gm-wrap">
        <div class="gm-head">
          <div><h2 class="gm-title">${esc(session.scenario.name)}</h2><p class="gm-sub">Simulación · Controla el reloj arriba</p></div>
          <button type="button" class="gh-btn" data-back-picker="1">Escenarios</button>
        </div>
        <div class="gm-tabs">${tabBtn("cartera", "Cartera")}${tabBtn("ofertas", "Ofertas")}${tabBtn("registro", `Registro (${session.events.length})`)}</div>
        ${panelBody(session)}
      </div>`;
    },
  };
}
