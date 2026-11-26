import assert from "node:assert/strict";
import test from "node:test";
import { available, createState, load, loadScenario, replay, routeMinutes, save, step } from "./index.js";
import { days } from "./data.js";

const startDate = "2024-01-01";
const day = offset => days(startDate, offset);
const money = units => units * 100;
const fund = (id, balance, rubric = "capital", actorId = "region") => ({
  id, balance: money(balance), rubric, actorId,
});
const project = (id, duration, cost, effects, extra = {}) => ({
  id, actorId: "region", eligibleRubrics: ["capital"],
  phases: [{ duration, cost: money(cost) }], effects, ...extra,
});
const maintenance = amount => ({ amount: money(amount), eligibleRubrics: ["capital"] });
const edge = (id, from, to, minutes) => ({ id, from, to, minutes });
const local = { id: "local", siteId: "local", route: { from: "origin", to: "port" } };
const rival = { id: "rival", siteId: "rival", minutes: 85 };
const order = (projectId, offset = 0, fundId = "capital") => ({
  id: projectId, date: day(offset), sequence: 0, actorId: "region",
  type: "startProject", payload: { projectId, fundId },
});

function dataset({ projects = [], offers = [], nodes = [], edges = [], ...scenario } = {}) {
  return {
    schemaVersion: "0.1", rulesVersion: "0.1", datasetId: "simulation-test", worldRef: "grid-test",
    catalog: { projects, offers }, networks: { nodes, edges },
    scenarios: [{
      id: "sim", startDate, endDate: day(140),
      sites: [{ id: "local", actorId: "region", access: true }, { id: "rival", access: true }],
      funds: [fund("capital", 30)], projects: projects.map(item => item.id),
      offers: offers.map(item => item.id), ...scenario,
    }],
  };
}

function run(scenario, orders = [], frameSizes = [1], initial = createState(scenario), through = scenario.endDate) {
  let state = initial;
  const events = [];
  let frame = 0;
  while (!state.sealed && state.date <= through) {
    const count = frameSizes[frame++ % frameSizes.length];
    for (let tick = 0; tick < count && !state.sealed && state.date <= through; tick++) {
      const result = step(state, orders.filter(item => item.date === state.date), scenario);
      state = result.state;
      events.push(...result.events);
    }
  }
  return { state, events };
}

function tutorial(repairDay = 40, rivalMinutes = 85) {
  return loadScenario(dataset({
    edges: [edge("corridor", "origin", "access", 65), edge("access", "access", "port", 45)],
    offers: [{
      id: "cold", date: day(90), requirements: { access: true, maxMinutes: 90 },
      candidates: [local, { ...rival, minutes: rivalMinutes }],
    }],
    projects: [
      project("repair", repairDay, 25, [{ type: "edgeMinutes", edgeId: "access", minutes: 15 }],
        { exclusiveGroup: "access", maintenance: maintenance(2) }),
      project("schedule", 70, 10, [{ type: "edgeMinutes", edgeId: "access", minutes: 30 }],
        { exclusiveGroup: "access" }),
    ],
    goals: [{ id: "investment", offerId: "cold", siteId: "local" }],
  }), "sim");
}

for (const [label, choice, repairDay, rivalMinutes, winner, minutes, balance, reserved] of [
  ["reparación", "repair", 40, 85, "local", 80, 5, 2],
  ["reordenamiento", "schedule", 40, 85, "rival", 95, 20, 0],
  ["espera", null, 40, 85, "rival", 110, 30, 0],
  ["entrega el día 90", "repair", 90, 85, "local", 80, 5, 2],
  ["entrega el día 91", "repair", 91, 85, "rival", 110, 5, 2],
  ["oferta desierta", "schedule", 40, 100, undefined, 95, 20, 0],
]) {
  test(`Ica–Pisco · ${label}`, () => {
    const { state, events } = run(tutorial(repairDay, rivalMinutes), choice ? [order(choice)] : []);
    assert.equal(state.offers.cold.siteId, winner);
    assert.equal(state.outcome.investment, winner === "local");
    if (winner === "local") assert.equal(state.offers.cold.minutes, minutes);
    else {
      const failures = events.filter(event => event.type === "OFFER_INELIGIBLE");
      assert.equal(failures.find(event => event.detail.siteId === "local").detail.actual, minutes);
      if (!winner) assert.deepEqual(failures.map(event => event.detail.actual), [95, 100]);
    }
    assert.equal(state.funds.capital.balance, money(balance));
    assert.equal(state.funds.capital.maintenanceReserved, money(reserved));
  });
}

test("1×, 2× y 4× con pausas, guardado y reproducción generan el mismo estado y eventos", () => {
  const scenario = tutorial(90);
  const orders = [order("repair"), order("schedule", 1)];
  const original = run(scenario, orders);
  for (const speed of [1, 2, 4]) assert.deepEqual(run(scenario, orders, [speed, 0, 0, speed]), original);
  const partial = run(scenario, orders, [4], undefined, day(50));
  const restored = load(save(partial.state), scenario);
  const end = run(scenario, orders, [2], restored);
  assert.deepEqual(end.state, original.state);
  assert.deepEqual([...partial.events, ...end.events], original.events);
  assert.deepEqual(replay(scenario, end.state.orderLog), original);
  assert.equal(end.state.orderLog[1].result.reasonCode, "EXCLUSIVE_INTERVENTION");
});

test("valida versión y referencia exacta de los guardados y del dataset", () => {
  const raw = dataset();
  const scenario = loadScenario(raw, "sim");
  const saved = createState(scenario);
  for (const key of ["schemaVersion", "rulesVersion", "datasetId", "worldRef"]) {
    assert.throws(() => load(save({ ...saved, [key]: "other" }), scenario), new RegExp(key));
    assert.throws(() => loadScenario(raw, "sim", { [key]: "other" }), new RegExp(key));
  }
  for (const key of ["schemaVersion", "rulesVersion"]) {
    assert.throws(() => loadScenario({ ...raw, [key]: "0.2" }, "sim"), new RegExp(key));
  }
});

for (const [year, last] of [[2023, 28], [2024, 29], [2100, 28]]) {
  test(`cierre de febrero de ${year}`, () => {
    const scenario = loadScenario(dataset({ startDate: `${year}-02-27`, endDate: `${year}-03-01` }), "sim");
    const { state } = run(scenario);
    assert.deepEqual(state.closures.map(({ date, type }) => ({ date, type })), [
      { date: `${year}-02-${last}`, type: "MONTH_CLOSED" },
    ]);
  });
}

test("el 31 de diciembre cierra mes y ejercicio, luego se reprograma antes de las órdenes", () => {
  const january = "2025-01-01";
  const scenario = loadScenario(dataset({
    startDate: "2024-12-31", endDate: january, funds: [fund("capital", 0)],
    annualEffects: { [january]: [{ type: "creditFund", fundId: "capital", amount: money(5) }] },
    obligations: [{ workId: "existing", startDate: "2024-12-31", fundId: "capital", amount: money(2) }],
    projects: [project("repair", 0, 3, [])],
  }), "sim");
  const { events, state } = run(scenario, [{ ...order("repair"), date: january }]);
  assert.deepEqual(events.map(({ type }) => type), [
    "MONTH_CLOSED", "YEAR_CLOSED", "MAINTENANCE_PAID", "ORDER_ACCEPTED",
    "WORK_MILESTONE", "WORK_MILESTONE", "SCENARIO_ENDED",
  ]);
  assert.equal(state.funds.capital.balance, 0);
  assert.equal(state.closures[1].funds[0].spent, 0);
});

test("rechaza rubro inelegible, saldo insuficiente y secuencia duplicada; el ID es idempotente", () => {
  const scenario = loadScenario(dataset({
    funds: [fund("capital", 20), fund("locked", 100, "other")], projects: [project("repair", 1, 25, [])],
  }), "sim");
  const initial = createState(scenario);
  const orders = [
    { ...order("repair", 0, "locked"), id: "a" },
    { ...order("repair"), id: "b", sequence: 1 },
    { ...order("repair"), id: "c", sequence: 1 },
  ];
  const first = step(initial, orders, scenario);
  assert.deepEqual(first.results.map(item => item.reasonCode), [
    "FUND_INELIGIBLE", "INSUFFICIENT_FUNDS", "INVALID_ORDER_SEQUENCE",
  ]);
  const second = step(first.state, [orders[0]], scenario);
  assert.deepEqual(second.results, [first.results[0]]);
  assert.deepEqual(second.events, []);
  assert.deepEqual(second.state.funds, initial.funds);
  assert.equal(initial.orderLog.length, 0);
});

function arequipa(strategy, interrupted, regionalMaintenance = false) {
  const water = { id: "water", service: "water", capacity: 100000, protectedDemand: 82000, priorCommitments: 16000 };
  const works = [
    project("water", strategy === "staged" ? 115 : 95, 45,
      [{ type: "nodeCapacity", nodeId: "water", capacity: 108000, protectedDemand: 84000 }],
      { maintenance: maintenance(4), teamId: "files" }),
    project("road", 80, 40, [
      { type: "edgeMinutes", edgeId: "main", minutes: 175 },
      { type: "edgeMinutes", edgeId: "detour", minutes: 230 },
    ], { teamId: "files" }),
  ];
  const agreement = {
    ...project("fast-access", 10, 15, [{ type: "access", siteId: "local" }], {
      teamId: "files", teamDays: 10, counterpartyId: "municipality",
      maintenance: {
        ...maintenance(2), actorId: regionalMaintenance ? "region" : "municipality",
        fundId: regionalMaintenance ? "capital" : "municipal",
      },
    }),
  };
  agreement.phases.push({ duration: 20 });
  const events = [];
  if (strategy !== "staged") events.push({
    id: "ordinary", date: day(110), sequence: 0, effects: [{ type: "access", siteId: "local" }],
  });
  if (interrupted) events.push(
    { id: "closure", date: day(105), sequence: 0, effects: [{ type: "closeEdge", edgeId: "main" }] },
    { id: "reopening", date: day(135), sequence: 0, effects: [{ type: "openEdge", edgeId: "main" }] },
  );
  return loadScenario(dataset({
    projects: works, agreements: [agreement], events,
    funds: [fund("capital", 65), fund("municipal", 2, "capital", "municipality")],
    sites: [{ id: "local", actorId: "region" }, { id: "rival", access: true }],
    nodes: [water, { ...water, id: "rival-water", capacity: 110000 }],
    edges: [edge("main", "origin", "port", 205), edge("detour", "origin", "port", 265)],
    offers: [{
      id: "plant", date: day(120), requirements: { access: true, maxMinutes: 240, water: 7000 },
      scales: { reduced: { virtualMinutes: 10, water: 2000, inspectionBefore: day(60), fundedBy: day(125) } },
      candidates: [
        { ...local, waterNodeId: "water" },
        { ...local, id: "local-reduced", waterNodeId: "water", scale: "reduced", expansionId: "water" },
        { ...rival, minutes: 220, waterNodeId: "rival-water" },
      ],
    }],
  }), "sim");
}

const agreementOrder = {
  ...order("fast-access"), type: "signAgreement",
  payload: { agreementId: "fast-access", counterpartyId: "municipality", fundId: "capital" },
};
const staged = [agreementOrder, order("water", 10), {
  ...order("inspect", 31), type: "inspectSite", payload: { siteId: "local" },
}];

for (const [strategy, orders, openWinner, minutes, detour] of [
  ["water", [order("water")], "local", 205, 265],
  ["road", [order("road")], "rival", 175, 230],
  ["staged", staged, "local", 205, 265],
]) {
  test(`Arequipa · ${strategy} y desvío en [105, 135)`, () => {
    const open = run(arequipa(strategy, false), orders);
    assert.equal(open.state.offers.plant.siteId, openWinner);
    if (strategy === "staged") {
      assert.equal(open.state.offers.plant.score, 215);
      assert.equal(open.state.offers.plant.minutes, 205);
      assert.equal(open.state.funds.capital.balance, money(5));
      assert.equal(open.state.funds.capital.maintenanceReserved, money(4));
    }
    const scenario = arequipa(strategy, true);
    const through104 = run(scenario, orders, [4], undefined, day(104));
    const through105 = run(scenario, orders, [1], through104.state, day(105));
    const through134 = run(scenario, orders, [4], through105.state, day(134));
    const through135 = run(scenario, orders, [1], through134.state, day(135));
    const route = state => routeMinutes(state.edges, "origin", "port");
    assert.deepEqual([through104, through105, through134, through135].map(({ state }) => route(state)),
      [minutes, detour, detour, minutes]);
    assert.equal(through134.state.offers.plant.siteId, "rival");
    const failures = through134.events.filter(event => event.type === "OFFER_INELIGIBLE");
    assert.ok(failures.some(event => event.reasonCode === (strategy === "road"
      ? "WATER_BELOW_MINIMUM" : "ROUTE_ABOVE_MAXIMUM")));
  });
}

test("Arequipa · el O&M regional deja un faltante de una unidad y no compromete la obra", () => {
  const { state } = run(arequipa("staged", false, true), staged);
  const result = state.orderLog.find(entry => entry.order.id === "water").result;
  assert.equal(result.reasonCode, "INSUFFICIENT_FUNDS");
  assert.equal(result.detail.actual - result.detail.required, -money(1));
  assert.equal(state.projects.water, undefined);
  assert.equal(state.funds.capital.maintenanceReserved, money(2));
});

test("reservas incompatibles se arbitran por ID y el empate prioriza escala completa y luego ID", () => {
  const candidates = [
    { id: "a-reduced", siteId: "reduced", minutes: 70, scale: "reduced", waterNodeId: "shared" },
    { id: "z-full", siteId: "z", minutes: 80, waterNodeId: "shared" },
    { id: "b-full", siteId: "b", minutes: 80, waterNodeId: "shared" },
  ];
  const common = {
    date: day(0), requirements: { maxMinutes: 80, water: 7 }, scales: { reduced: { virtualMinutes: 10 } },
    candidates,
  };
  const scenario = loadScenario(dataset({
    endDate: day(0), offers: [{ id: "z-offer", ...common }, { id: "a-offer", ...common }],
    nodes: [{ id: "shared", service: "water", capacity: 12, protectedDemand: 2, priorCommitments: 3 }],
  }), "sim");
  const { state, events } = run(scenario);
  assert.equal(state.offers["a-offer"].siteId, "b");
  assert.equal(state.offers["z-offer"].status, "unawarded");
  assert.equal(available(state, "shared"), 0);
  assert.equal(events.filter(event => event.reasonCode === "WATER_BELOW_MINIMUM").length, 3);
});

test("una observación desconocida bloquea la oferta hasta seleccionar un supuesto explícito", () => {
  const raw = dataset({
    endDate: day(0),
    nodes: [{ id: "water", service: "water", capacityRef: "official", protectedDemand: 0, priorCommitments: 0 }],
    offers: [{
      id: "test", date: day(0), requirements: { maxMinutes: 90, water: 7 },
      candidates: [{ ...rival, waterNodeId: "water" }],
    }],
  });
  raw.observations = [
    { id: "official", value: null, provenance: "oficial" },
    { id: "assumption", value: 7, provenance: "supuesto" },
  ];
  const unknown = run(loadScenario(raw, "sim"));
  assert.equal(unknown.state.offers.test.status, "unawarded");
  assert.equal(unknown.events[0].reasonCode, "DATA_UNKNOWN");
  raw.scenarios[0].observationOverrides = { official: "assumption" };
  assert.equal(run(loadScenario(raw, "sim")).state.offers.test.status, "awarded");
});
