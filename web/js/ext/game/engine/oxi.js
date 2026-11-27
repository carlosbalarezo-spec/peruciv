import { add, get, index, nonnegative } from "./data.js";

export function createCiprl(scenario) {
  const limits = (scenario.ciprl?.limits ?? []).map(limit => {
    const { ceiling, prior } = limit;
    if (!get(scenario.asOfBySource ?? {}, limit.sourceId) ||
        nonnegative(prior) > nonnegative(ceiling)) throw new Error("Tope CIPRL inválido");
    return { ...limit, reserved: 0, issued: 0, free: ceiling - prior, schedule: {} };
  });
  return { limits: index(limits), projects: {} };
}

export function applyOxi(state, scenario, order, reject, accept) {
  const id = order.payload?.projectId;
  const definition = (scenario.oxiProjects ?? []).find(item => item.id === id);
  if (!definition || definition.actorId !== order.actorId) return reject("ACTOR_NOT_COMPETENT");
  const limit = get(state.ciprl?.limits ?? {}, definition.limitId);
  if (!limit || limit.actorId !== order.actorId) return reject("ACTOR_NOT_COMPETENT");
  const project = get(state.ciprl.projects, id);
  if (order.type === "reserveOxi") {
    if (project) return reject("ALREADY_STARTED");
    const tranches = Object.entries(definition.tranches).map(([year, amount]) => {
      if (!/^\d{4}$/.test(year) || year < state.date.slice(0, 4)) throw new Error("Ejercicio CIPRL inválido");
      return [year, nonnegative(amount)];
    });
    const total = add(...tranches.map(([, amount]) => amount));
    if (!total) throw new Error("Reserva CIPRL vacía");
    if (total > limit.free) return reject("CIPRL_LIMIT_EXCEEDED", {
      limitId: limit.id, actual: limit.free, required: total, unit: "céntimos",
    });
    limit.free -= total;
    limit.reserved = add(limit.reserved, total);
    for (const [year, amount] of tranches) limit.schedule[year] = add(limit.schedule[year] ?? 0, amount);
    Object.defineProperty(state.ciprl.projects, id, {
      value: { status: "reserved", total, tranches }, enumerable: true,
    });
    return accept;
  }
  if (!project) return reject("OXI_STAGE_REQUIRED");
  if (order.type === "commitOxi" && project.status === "reserved") {
    project.status = "committed";
  } else if (order.type === "issueCiprl" && project.status === "committed") {
    const work = get(state.projects, definition.workId);
    if (work?.status !== "delivered") return reject("OXI_DELIVERY_REQUIRED");
    project.status = "issued";
    limit.reserved -= project.total;
    limit.issued = add(limit.issued, project.total);
  } else if (order.type === "cancelOxi" && project.status === "reserved") {
    project.status = "cancelled";
    limit.reserved -= project.total;
    limit.free = add(limit.free, project.total);
    for (const [year, amount] of project.tranches) limit.schedule[year] -= amount;
  } else if (order.type === "cancelOxi" && project.status === "committed") {
    project.status = "cancelled_pending_settlement";
  } else {
    return reject("OXI_STAGE_REQUIRED", { status: project.status });
  }
  return accept;
}
