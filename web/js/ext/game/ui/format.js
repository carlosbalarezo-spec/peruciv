// Utilidades de formato y traducción al español para el modo juego.

export const fmtMoney = (centimos) => {
  const u = (centimos ?? 0) / 100;
  return `${Number.isInteger(u) ? u : u.toFixed(1)} u.`;
};

export const fmtWater = (mls) => (mls == null ? "Desconocido" : `${(mls / 1000).toFixed(1)} l/s`);

const REASONS = {
  ACCEPTED: "Orden aceptada",
  FUND_INELIGIBLE: "Fuente presupuestal no elegible",
  INSUFFICIENT_FUNDS: "Margen presupuestal insuficiente",
  ACTOR_NOT_COMPETENT: "La entidad no tiene competencia",
  ALREADY_STARTED: "La obra o convenio ya fue iniciado",
  COUNTERPARTY_MISMATCH: "Contraparte incompatible",
  AGREEMENT_REQUIRED: "Requiere convenio previo entregado",
  TEAM_BUSY: "Equipo técnico ocupado con otro expediente",
  EXCLUSIVE_INTERVENTION: "Excluyente con otra intervención ya elegida",
  INVALID_ORDER_SEQUENCE: "Secuencia de orden inválida",
  ACCESS_REQUIRED: "Falta acceso habilitado al terminal/predio",
  ROUTE_ABOVE_MAXIMUM: "Tiempo de ruta supera el máximo exigido",
  WATER_BELOW_MINIMUM: "Saldo hídrico disponible insuficiente",
  INSPECTION_REQUIRED: "Falta inspección técnica antes del plazo",
  EXPANSION_UNFUNDED: "Falta ampliación hídrica financiada a tiempo",
  OBSERVATION_UNKNOWN: "Dato oficial desconocido sin supuesto activo",
};

export const reasonText = (code) => REASONS[code] || code || "—";

export function describeEvent(ev) {
  const d = ev.detail || {};
  const tag = d.projectId || d.agreementId || d.workId || d.siteId || d.offerId || ev.orderId || "";
  if (ev.type === "ORDER_ACCEPTED") return { cls: "ok", text: `Orden aceptada${tag ? `: ${tag}` : ""}` };
  if (ev.type === "ORDER_REJECTED") return { cls: "bad", text: `Orden rechazada: ${reasonText(ev.reasonCode)}` };
  if (ev.type === "WORK_MILESTONE") return { cls: "ok", text: `Hito completado${tag ? `: ${tag}` : ""}` };
  if (ev.type === "OFFER_DECIDED" || ev.type === "OFFER_AWARDED") {
    return { cls: "ok", text: `Inversión adjudicada (${d.offerId || tag}): ${d.siteId || ""} (${d.minutes ?? "?"} min)` };
  }
  if (ev.type === "OFFER_INELIGIBLE") return { cls: "bad", text: `Sede ${d.siteId || ""} excluida (${d.offerId || ""}): ${reasonText(ev.reasonCode)}` };
  if (ev.type === "OFFER_UNAWARDED") return { cls: "bad", text: `Oferta ${d.offerId || tag} declarada desierta` };
  if (ev.type === "MONTH_CLOSED") return { cls: "", text: `Cierre mensual (${ev.date})` };
  if (ev.type === "YEAR_CLOSED") return { cls: "", text: `Cierre de ejercicio anual (${ev.date})` };
  if (ev.type === "MAINTENANCE_PAID") return { cls: "", text: `Reserva de O&M aplicada (${fmtMoney(d.amount)})` };
  if (ev.type === "SCENARIO_ENDED") return { cls: "ok", text: `Fin de mandato (${ev.date})` };
  return { cls: "", text: `${ev.type}${ev.reasonCode ? `: ${reasonText(ev.reasonCode)}` : ""}` };
}
