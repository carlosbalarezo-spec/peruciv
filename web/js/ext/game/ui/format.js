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
  CIPRL_LIMIT_EXCEEDED: "Supera el margen libre del tope CIPRL",
  OXI_STAGE_REQUIRED: "Etapa OxI inválida para esta operación",
  OXI_DELIVERY_REQUIRED: "La obra asociada aún no ha sido entregada",
  DAY_ONE_CLOSED: "La ventana de asignación del Día 1 ya cerró",
};

export const reasonText = (code) => REASONS[code] || code || "—";

const EVENT_FMT = {
  ORDER_ACCEPTED: (d, t) => ({ cls: "ok", text: `Orden aceptada${t ? `: ${t}` : ""}` }),
  ORDER_REJECTED: (_d, _t, ev) => ({ cls: "bad", text: `Orden rechazada: ${reasonText(ev.reasonCode)}` }),
  WORK_MILESTONE: (_d, t) => ({ cls: "ok", text: `Hito completado${t ? `: ${t}` : ""}` }),
  OFFER_DECIDED: (d, t) => ({ cls: "ok", text: `Inversión adjudicada (${d.offerId || t}): ${d.siteId || ""} (${d.minutes ?? "?"} min)` }),
  OFFER_AWARDED: (d, t) => ({ cls: "ok", text: `Inversión adjudicada (${d.offerId || t}): ${d.siteId || ""} (${d.minutes ?? "?"} min)` }),
  OFFER_INELIGIBLE: (d, _t, ev) => ({ cls: "bad", text: `Sede ${d.siteId || ""} excluida (${d.offerId || ""}): ${reasonText(ev.reasonCode)}` }),
  OFFER_UNAWARDED: (d, t) => ({ cls: "bad", text: `Oferta ${d.offerId || t} declarada desierta` }),
  MONTH_CLOSED: (_d, _t, ev) => ({ cls: "", text: `Cierre mensual (${ev.date})` }),
  YEAR_CLOSED: (_d, _t, ev) => ({ cls: "", text: `Cierre de ejercicio anual (${ev.date})` }),
  MAINTENANCE_PAID: (d) => ({ cls: "", text: `Reserva de O&M aplicada (${fmtMoney(d.amount)})` }),
  SCENARIO_ENDED: (_d, _t, ev) => ({ cls: "ok", text: `Fin de mandato (${ev.date})` }),
};

export function describeEvent(ev) {
  const d = ev.detail || {};
  const tag = d.projectId || d.agreementId || d.workId || d.siteId || d.offerId || ev.orderId || "";
  const fn = EVENT_FMT[ev.type];
  if (fn) return fn(d, tag, ev);
  return { cls: "", text: `${ev.type}${ev.reasonCode ? `: ${reasonText(ev.reasonCode)}` : ""}` };
}
