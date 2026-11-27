import { add, compareId, compatible, days, get, index, nonnegative } from "./data.js";
import { dayOne, reprogramInheritedFunds } from "./day-one.js";
import { applyOxi, createCiprl } from "./oxi.js";
import { evaluateOffer } from "./offers.js";

export { loadScenario, schemaVersion, rulesVersion } from "./data.js";
export { available, routeMinutes } from "./network.js";

const bySequence = (a, b) => a.sequence - b.sequence || compareId(a, b);

export function createState(scenario, { emphasis = "balanced" } = {}) {
  const onboarding = dayOne(scenario, emphasis);
  const inheritedFunds = index(onboarding.inherited?.funds);
  const obligations = [...(scenario.obligations ?? []), ...(onboarding.inherited?.obligations ?? [])];
  const funds = scenario.funds.map(fund => ({
    ...fund, balance: get(inheritedFunds, fund.id)?.available ?? fund.balance, reserved: 0, accrued: 0, spent: 0, maintenanceReserved: add(
      ...obligations.filter(item => item.fundId === fund.id).map(item => item.reserved ?? 0),
    ),
  }));
  return structuredClone({
    ...onboarding, ciprl: createCiprl(scenario),
    ...scenario.version, scenarioId: scenario.id, date: scenario.startDate,
    nextSequence: 0, nextEventSequence: 0, sealed: false,
    actors: scenario.actors ?? [], funds: index(funds), nodes: index(scenario.nodes), edges: index(scenario.edges),
    projects: Object.create(null), agreements: Object.create(null),
    offers: index(scenario.offers.map(offer => ({ id: offer.id, status: "pending" }))),
    access: Object.fromEntries(scenario.sites.map(site => [site.id, site.access === true])),
    inspections: Object.create(null), reservations: [], obligations: structuredClone(obligations),
    pendingOrders: [], orderLog: [], closures: [], milestones: [],
  });
}

function applyEffect(state, effect) {
  switch (effect.type) {
    case "closeEdge":
    case "openEdge":
      state.edges[effect.edgeId].closed = effect.type === "closeEdge";
      break;
    case "edgeMinutes":
      state.edges[effect.edgeId].minutes = nonnegative(effect.minutes);
      break;
    case "nodeCapacity": {
      const node = state.nodes[effect.nodeId];
      for (const key of ["capacity", "protectedDemand", "priorCommitments"]) {
        if (Object.hasOwn(effect, key)) node[key] = nonnegative(effect[key]);
      }
      break;
    }
    case "access":
      Object.defineProperty(state.access, effect.siteId, {
        value: effect.enabled ?? true, enumerable: true, writable: true, configurable: true,
      });
      break;
    case "releaseOffer":
      state.reservations = state.reservations.filter(item => item.offerId !== effect.offerId);
      break;
    case "creditFund": {
      const fund = state.funds[effect.fundId];
      fund.balance = add(fund.balance, nonnegative(effect.amount));
      break;
    }
    default:
      throw new Error(`Efecto desconocido: ${effect.type}`);
  }
}

const margin = fund => add(fund.balance, -fund.reserved, -fund.maintenanceReserved);
const rejection = (reasonCode, detail = {}) => ({ accepted: false, reasonCode, detail });
const accepted = { accepted: true, reasonCode: "ACCEPTED", detail: {} };

function checkFund(state, fundId, actorId, rubrics, amount) {
  const fund = get(state.funds, fundId);
  if (!fund || fund.actorId !== actorId || !rubrics.includes(fund.rubric)) {
    return rejection("FUND_INELIGIBLE", {
      fundId: fundId ?? null, rubric: fund?.rubric ?? null, eligibleRubrics: [...rubrics],
      actorId, fundActorId: fund?.actorId ?? null,
    });
  }
  if (margin(fund) < amount) {
    return rejection("INSUFFICIENT_FUNDS", {
      fundId, metric: "margin", actual: margin(fund), required: amount, operator: ">=", unit: "céntimos",
    });
  }
}

function startWork(state, definition, order, registry) {
  if (!definition || definition.actorId !== order.actorId) return rejection("ACTOR_NOT_COMPETENT");
  if (get(registry, definition.id)) return rejection("ALREADY_STARTED");
  const payload = order.payload ?? {};
  if (definition.counterpartyId !== undefined && definition.counterpartyId !== payload.counterpartyId) {
    return rejection("COUNTERPARTY_MISMATCH");
  }
  const conditional = get(state.agreements, definition.requiresAgreementWhenSigned);
  const agreementId = definition.requiresAgreement ?? conditional?.id;
  if (agreementId && get(state.agreements, agreementId)?.status !== "delivered") {
    return rejection("AGREEMENT_REQUIRED", { agreementId });
  }
  if (agreementId && definition.requiresAccessSiteId && get(state.access, definition.requiresAccessSiteId) !== true) {
    return rejection("ACCESS_REQUIRED", { siteId: definition.requiresAccessSiteId });
  }
  const work = [...Object.values(state.projects), ...Object.values(state.agreements)];
  if (definition.teamId && work.some(item => item.teamId === definition.teamId && item.teamUntil > state.date)) {
    return rejection("TEAM_BUSY");
  }
  if (definition.exclusiveGroup && work.some(item => item.exclusiveGroup === definition.exclusiveGroup)) {
    return rejection("EXCLUSIVE_INTERVENTION");
  }

  let delivery = state.date;
  const phases = (definition.phases ?? []).map(phase => {
    delivery = days(delivery, nonnegative(phase.duration));
    return { date: delivery, cost: nonnegative(phase.cost ?? 0), effects: structuredClone(phase.effects ?? []) };
  });
  const investment = add(...phases.map(phase => phase.cost));
  const budget = investment ? checkFund(state, payload.fundId, order.actorId, definition.eligibleRubrics ?? [], investment) : undefined;
  if (budget) return budget;

  const maintenance = definition.maintenance;
  const amount = nonnegative(maintenance?.amount ?? 0);
  const maintenanceFundId = payload.maintenanceFundId ?? maintenance?.fundId ?? payload.fundId;
  if (amount) {
    const total = add(amount, maintenanceFundId === payload.fundId ? investment : 0);
    const failure = checkFund(state, maintenanceFundId, maintenance.actorId ?? order.actorId,
      maintenance.eligibleRubrics ?? [], total);
    if (failure) return failure;
    const fund = state.funds[maintenanceFundId];
    fund.maintenanceReserved = add(fund.maintenanceReserved, amount);
    state.obligations.push({
      workId: definition.id, fundId: maintenanceFundId, actorId: fund.actorId,
      amount, startDate: delivery, reserved: amount,
    });
  }
  if (investment) {
    const fund = state.funds[payload.fundId];
    fund.reserved = add(fund.reserved, investment);
  }
  const item = {
    id: definition.id, status: "active", delivery, fundId: payload.fundId ?? null,
    teamId: definition.teamId ?? null, exclusiveGroup: definition.exclusiveGroup ?? null,
    teamUntil: definition.teamDays === undefined ? delivery : days(state.date, nonnegative(definition.teamDays)),
    registry: registry === state.projects ? "projects" : "agreements",
    orderId: order.id,
  };
  Object.defineProperty(registry, item.id, { value: item, writable: true, enumerable: true, configurable: true });
  for (const phase of phases) state.milestones.push({ ...phase, workId: item.id, registry: item.registry });
  state.milestones.push({
    date: delivery, cost: 0, effects: structuredClone(definition.effects ?? []),
    workId: item.id, registry: item.registry, delivery: true,
  });
  return accepted;
}

function applyOrder(state, scenario, order) {
  const { projectId, agreementId, siteId } = order.payload ?? {};
  switch (order.type) {
    case "reserveOxi":
    case "commitOxi":
    case "issueCiprl":
    case "cancelOxi":
      return applyOxi(state, scenario, order, rejection, accepted);
    case "allocateDayOne": {
      if (state.date !== state.startDate) return rejection("DAY_ONE_CLOSED");
      const { actionId, fundId, amount } = order.payload ?? {};
      const action = (scenario.budgetActions ?? []).find(item => item.id === actionId);
      if (!action || action.actorId !== order.actorId || action.authorizationMissing === true) {
        return rejection("ACTOR_NOT_COMPETENT", {
          actionId: actionId ?? null, competentActorId: action?.actorId ?? null,
          legalBasis: action?.legalBasis ?? null,
        });
      }
      if (!Number.isSafeInteger(amount) || amount <= 0) return rejection("INVALID_AMOUNT");
      if (action.eligibleFundIds && !action.eligibleFundIds.includes(fundId)) {
        return rejection("FUND_INELIGIBLE", { fundId: fundId ?? null, actionId, legalBasis: action.legalBasis ?? null });
      }
      const failure = checkFund(state, fundId, order.actorId, action.eligibleRubrics ?? [], amount);
      if (failure) failure.detail.legalBasis = action.legalBasis ?? null;
      if (failure) return failure;
      state.funds[fundId].balance = add(state.funds[fundId].balance, -amount);
      state.allocations.push({ actionId, fundId, amount, orderId: order.id });
      return accepted;
    }
    case "startProject":
      return startWork(state, scenario.projects.find(item => item.id === projectId), order, state.projects);
    case "signAgreement":
      return startWork(state, scenario.agreements.find(item => item.id === agreementId), order, state.agreements);
    case "inspectSite": {
      const site = scenario.sites.find(item => item.id === siteId);
      if (!site || site.actorId !== order.actorId) return rejection("ACTOR_NOT_COMPETENT");
      if (get(state.access, siteId) !== true) return rejection("ACCESS_REQUIRED");
      if (!get(state.inspections, siteId)) Object.defineProperty(state.inspections, siteId, {
        value: state.date, enumerable: true, configurable: true, writable: true,
      });
      return accepted;
    }
    default:
      return rejection("UNKNOWN_ORDER");
  }
}

function closePeriod(state, type, emit) {
  const funds = Object.values(state.funds).sort(compareId).map(fund => ({
    id: fund.id, balance: fund.balance, reserved: fund.reserved,
    maintenanceReserved: fund.maintenanceReserved, accrued: fund.accrued, spent: fund.spent,
  }));
  const closure = { date: state.date, type, funds };
  state.closures.push(closure);
  emit(type, state.scenarioId, "CALENDAR", closure);
}

function openYear(state, scenario, emit) {
  reprogramInheritedFunds(state, scenario);
  for (const effect of get(scenario.annualEffects ?? {}, state.date) ?? []) applyEffect(state, effect);
  for (const obligation of state.obligations) {
    if (obligation.paid || obligation.startDate > state.date || obligation.dueYear > Number(state.date.slice(0, 4))) continue;
    const fund = get(state.funds, obligation.fundId);
    const amount = nonnegative(obligation.amount);
    const reserved = obligation.reserved ?? 0;
    if (!fund || add(margin(fund), reserved) < amount) {
      emit("MAINTENANCE_UNFUNDED", obligation.workId, "INSUFFICIENT_FUNDS", {
        fundId: obligation.fundId, required: amount,
        actual: fund ? add(margin(fund), reserved) : null, operator: ">=", unit: "céntimos",
      });
      continue;
    }
    obligation.reserved = 0;
    if (obligation.dueYear !== undefined) obligation.paid = true;
    fund.maintenanceReserved = add(fund.maintenanceReserved, -reserved);
    fund.balance = add(fund.balance, -amount);
    fund.accrued = add(fund.accrued, amount);
    fund.spent = add(fund.spent, amount);
    emit("MAINTENANCE_PAID", obligation.workId, "ANNUAL_OBLIGATION", { fundId: fund.id, amount });
  }
  state.reprogramYear = false;
}

function resolveMilestones(state, emit) {
  for (const milestone of state.milestones) {
    if (milestone.date !== state.date) continue;
    const work = state[milestone.registry][milestone.workId];
    if (milestone.cost) {
      const fund = state.funds[work.fundId];
      fund.reserved = add(fund.reserved, -milestone.cost);
      fund.balance = add(fund.balance, -milestone.cost);
      fund.accrued = add(fund.accrued, milestone.cost);
      fund.spent = add(fund.spent, milestone.cost);
    }
    for (const effect of milestone.effects) applyEffect(state, effect);
    if (milestone.delivery) work.status = "delivered";
    emit("WORK_MILESTONE", work.id, milestone.delivery ? "DELIVERED" : "PHASE_COMPLETE",
      { cost: milestone.cost, fundId: work.fundId }, [work.orderId]);
  }
  state.milestones = state.milestones.filter(item => item.date !== state.date);
}

function resolveOrders(state, orders, scenario, emit, dayOneOnly) {
  const results = [];
  const seen = new Map(state.orderLog.map(entry => [entry.order.id, entry.result]));
  const sequences = new Set(state.orderLog.filter(entry => entry.date === state.date &&
    entry.result.reasonCode !== "INVALID_ORDER_SEQUENCE" && entry.result.reasonCode !== "ORDER_DATE_MISMATCH")
    .map(entry => entry.order.sequence));
  const ordered = [...(dayOneOnly ? [] : state.pendingOrders), ...orders].sort((a, b) => {
    const left = Number.isSafeInteger(a.sequence) ? a.sequence : Infinity;
    const right = Number.isSafeInteger(b.sequence) ? b.sequence : Infinity;
    return left === right ? compareId(a, b) : left < right ? -1 : 1;
  });
  if (!dayOneOnly) state.pendingOrders = [];
  for (const order of ordered) {
    index([order]);
    if (seen.has(order.id)) {
      results.push({ id: order.id, ...seen.get(order.id) });
      continue;
    }
    let result;
    if (order.date !== state.date) result = rejection("ORDER_DATE_MISMATCH");
    else if (!Number.isSafeInteger(order.sequence) || order.sequence < 0 ||
      order.sequence === Number.MAX_SAFE_INTEGER || sequences.has(order.sequence)) {
      result = rejection("INVALID_ORDER_SEQUENCE");
    } else {
      sequences.add(order.sequence);
      state.nextSequence = Math.max(state.nextSequence, add(order.sequence, 1));
      result = dayOneOnly && order.type !== "allocateDayOne"
        ? rejection("DAY_ONE_ORDER_REQUIRED") : applyOrder(state, scenario, order);
    }
    state.orderLog.push({ date: state.date, order, result, ...(dayOneOnly ? { dayOneOnly } : {}) });
    seen.set(order.id, result);
    results.push({ id: order.id, ...result });
    emit(result.accepted ? "ORDER_ACCEPTED" : "ORDER_REJECTED", order.id, result.reasonCode, result.detail, [order.id]);
  }
  return results;
}

export function step(previous, orders, scenario, { dayOneOnly = false } = {}) {
  compatible(previous, { ...scenario.version, scenarioId: scenario.id });
  if (previous.startDate !== undefined) compatible(previous, { startDate: scenario.startDate });
  if (previous.sealed) {
    return { state: structuredClone(previous), events: [], results: orders.map(order => ({
      id: order.id, ...(previous.orderLog.find(entry => entry.order.id === order.id)?.result ??
        rejection("SCENARIO_SEALED")),
    })) };
  }
  const state = structuredClone(previous);
  const events = [];
  function emit(type, subjectId, reasonCode, detail = {}, causes = []) {
    const sequence = state.nextEventSequence;
    state.nextEventSequence = add(sequence, 1);
    events.push({ id: `${state.date}:${sequence}`, date: state.date, sequence,
      type, subjectId, reasonCode, detail: structuredClone(detail), causes: [...causes] });
  }

  if (dayOneOnly) {
    const results = resolveOrders(state, structuredClone(orders), scenario, emit, true);
    return { state, events, results: structuredClone(results) };
  }

  const scheduled = scenario.events.filter(event => event.date === state.date).sort(bySequence);
  for (const event of scheduled) {
    for (const effect of event.effects) applyEffect(state, effect);
    emit("CALENDAR_EVENT", event.subjectId ?? event.id, event.reasonCode ?? "SCHEDULED", {}, [event.id]);
  }
  if (state.reprogramYear) openYear(state, scenario, emit);

  resolveMilestones(state, emit);
  const results = resolveOrders(state, structuredClone(orders), scenario, emit);
  resolveMilestones(state, emit);

  for (const offer of scenario.offers.filter(item => item.date === state.date).sort(compareId)) {
    evaluateOffer(state, offer, emit);
  }

  if (state.date.endsWith("-12-31")) {
    closePeriod(state, "MONTH_CLOSED", emit);
    closePeriod(state, "YEAR_CLOSED", emit);
    state.reprogramYear = true;
  } else if (days(state.date, 1).slice(0, 7) !== state.date.slice(0, 7)) {
    closePeriod(state, "MONTH_CLOSED", emit);
  }
  if (state.date === scenario.endDate) {
    state.sealed = true;
    state.outcome = Object.fromEntries(scenario.goals.map(goal => [
      goal.id, get(state.offers, goal.offerId)?.siteId === goal.siteId,
    ]));
    emit("SCENARIO_ENDED", scenario.id, "END_DATE", state.outcome);
  } else {
    state.date = days(state.date, 1);
    state.nextSequence = 0;
  }
  return { state, events, results: structuredClone(results) };
}

export function save(state) {
  return JSON.stringify(state);
}

export function load(saved, scenario) {
  const state = JSON.parse(saved);
  compatible(state, { ...scenario.version, scenarioId: scenario.id });
  if (state.startDate !== undefined) compatible(state, { startDate: scenario.startDate });
  if (state.date < scenario.startDate || state.date > scenario.endDate) throw new Error("Fecha fuera del escenario");
  days(state.date, 0);
  if (!Array.isArray(state.orderLog) || !Array.isArray(state.pendingOrders)) throw new Error("Registro de órdenes inválido");
  return state;
}

// Cada entrada usa el día en que fue procesada, incluso si la fecha de la orden fue rechazada.
export function replay(scenario, orderLog, until = scenario.endDate, options) {
  days(until, 0);
  let state = createState(scenario, options);
  const byDate = new Map();
  for (const entry of orderLog) {
    if (!byDate.has(entry.date)) byDate.set(entry.date, []);
    byDate.get(entry.date).push(entry);
  }
  const events = [];
  while (!state.sealed && state.date <= until) {
    const entries = byDate.get(state.date) ?? [];
    for (const entry of entries.filter(item => item.dayOneOnly)) {
      const adjustment = step(state, [entry.order], scenario, { dayOneOnly: true });
      state = adjustment.state;
      events.push(...adjustment.events);
    }
    const result = step(state, entries.filter(item => !item.dayOneOnly).map(item => item.order), scenario);
    state = result.state;
    for (const event of result.events) events.push(event);
  }
  return { state, events };
}
