import assert from "node:assert/strict";
import test from "node:test";
import { createState, load, loadScenario, replay, save, step } from "./index.js";

const template = {
  id: "3a", startMode: "current", startDate: "2026-01-01", endDate: "2026-01-04",
  asOfBySource: { mef: "2026-11-26" },
  funds: [
    { id: "canon", actorId: "gore", rubric: "capital", balance: 100 },
    { id: "ordinary", actorId: "gore", rubric: "current", balance: 100 },
  ],
  inherited: {
    year: 2026,
    funds: [
      { id: "canon", sourceId: "mef", pia: 100, pim: 110, compromiso: 60, devengado: 20, available: 45 },
      { id: "ordinary", sourceId: "mef", pia: 100, pim: 100, compromiso: 50, devengado: 20, available: 50 },
    ],
    portfolio: [{ cui: "1234567", sourceId: "mef", status: "in_progress", progressPermille: 450, pending: 40 }],
    obligations: [
      { workId: "1234567", fundId: "ordinary", startDate: "2026-12-31", dueYear: 2026,
        amount: 10, includedInCommitment: true },
      { workId: "1234567", fundId: "ordinary", startDate: "2027-01-01", dueYear: 2027,
        amount: 15, reserved: 5, includedInCommitment: false },
    ],
  },
  annualBudgets: { 2027: { ordinary: 20 } },
  budgetActions: [
    { id: "services", actorId: "gore", eligibleRubrics: ["current"], legalBasis: "Ley 27506" },
    { id: "enterprise", actorId: "gore", authorizationMissing: true, legalBasis: "Constitución, art. 60" },
    { id: "tax", actorId: "congress", legalBasis: "Constitución, art. 74" },
  ],
  ciprl: { limits: [{ id: "cap", actorId: "gore", sourceId: "mef", ceiling: 100, prior: 10 }] },
  oxiProjects: ["a", "b"].map(id => ({ id, actorId: "gore", limitId: "cap", tranches: { 2027: 30, 2028: 30 } })),
};
const dataset = {
  schemaVersion: "0.1", rulesVersion: "0.1", datasetId: "sim", worldRef: "sim",
  scenarios: [template, { id: "tutorial", startMode: "fixed", startDate: "2026-01-01", endDate: "2026-01-04" }],
};
const startDate = "2026-12-31";
const scenarioFor = today => loadScenario(dataset, template.id, {}, { today });
const command = (sequence, type, payload, currentDate = startDate) => ({
  id: `order-${sequence}`, sequence, date: currentDate, type, actorId: "gore", payload,
});

test("Día 1 conserva CUI, bloquea Canon y verifica competencia antes de tocar el margen", () => {
  const scenario = scenarioFor(startDate);
  const initial = createState(scenario, { emphasis: "services" });
  assert.deepEqual(initial.inherited.portfolio, template.inherited.portfolio);
  assert.equal(initial.funds.canon.balance, 45);
  assert.equal(initial.funds.ordinary.maintenanceReserved, 5);
  const allocations = [
    command(0, "allocateDayOne", { actionId: "services", fundId: "canon", amount: 1 }),
    command(1, "allocateDayOne", { actionId: "enterprise", fundId: "ordinary", amount: 1 }),
    command(2, "allocateDayOne", { actionId: "tax", fundId: "ordinary", amount: 1 }),
    command(3, "allocateDayOne", { actionId: "services", fundId: "ordinary", amount: 46 }),
  ];
  const { state, results } = step(initial, allocations, scenario, { dayOneOnly: true });
  assert.deepEqual(results.map(result => result.reasonCode),
    ["FUND_INELIGIBLE", "ACTOR_NOT_COMPETENT", "ACTOR_NOT_COMPETENT", "INSUFFICIENT_FUNDS"]);
  assert.equal(results[3].detail.actual, 45);
  assert.equal(results[1].detail.legalBasis, "Constitución, art. 60");
  const adjusted = step(state, [command(4, "allocateDayOne",
    { actionId: "services", fundId: "ordinary", amount: 45 })], scenario, { dayOneOnly: true });
  assert.equal(adjusted.state.date, startDate);
  assert.equal(adjusted.state.funds.ordinary.balance, 5);
  assert.equal(initial.funds.ordinary.balance, 50);
  const closed = step(load(save(adjusted.state), scenario), [], scenario).state;
  const opened = step(load(save(closed), scenario), [], scenario).state;
  assert.equal(opened.funds.canon.balance, 0);
  assert.equal(opened.funds.ordinary.balance, 0);
  assert.equal(opened.funds.ordinary.spent, 25);
  assert.equal(opened.funds.ordinary.maintenanceReserved, 0);
  assert.deepEqual(replay(scenario, opened.orderLog, "2027-01-01", { emphasis: "services" }).state, opened);
});

test("CIPRL comparte tope, libera la reserva previa a firma y retiene la posterior", () => {
  const scenario = scenarioFor(startDate);
  const actions = [
    ["reserveOxi", "a"], ["reserveOxi", "b"], ["cancelOxi", "a"], ["reserveOxi", "b"],
    ["commitOxi", "b"], ["issueCiprl", "b"], ["cancelOxi", "b"],
  ];
  const { state, results } = step(createState(scenario), actions.map(([type, projectId], i) =>
    command(i, type, { projectId })), scenario);
  assert.deepEqual(results.map(result => result.reasonCode), [
    "ACCEPTED", "CIPRL_LIMIT_EXCEEDED", "ACCEPTED", "ACCEPTED", "ACCEPTED",
    "OXI_DELIVERY_REQUIRED", "ACCEPTED",
  ]);
  const cap = state.ciprl.limits.cap;
  assert.equal(cap.free, 30);
  assert.equal(cap.reserved, 60);
  assert.deepEqual(cap.schedule, { 2027: 30, 2028: 30 });
  assert.equal(state.ciprl.projects.b.status, "cancelled_pending_settlement");
});

test("Guarda la fecha libre, el corte por fuente y cada énfasis de campaña", () => {
  const scenario = scenarioFor(startDate);
  assert.equal(scenario.endDate, "2027-01-03");
  for (const emphasis of ["services", "investment", "dialogue", "balanced"]) {
    const start = createState(scenario, { emphasis });
    const serialized = save(step(start, [], scenario).state);
    const resumed = load(serialized, scenarioFor(JSON.parse(serialized).startDate));
    assert.equal(resumed.startDate, startDate);
    assert.equal(resumed.date, "2027-01-01");
    assert.deepEqual(resumed.asOf, template.asOfBySource);
    assert.equal(resumed.campaign.emphasis, emphasis);
    assert.deepEqual(resumed.campaign.priorities,
      emphasis === "balanced" ? ["services", "investment", "dialogue"] : [emphasis]);
    assert.throws(() => load(serialized, scenarioFor("2026-12-30")), /startDate incompatible/);
  }
  assert.equal(loadScenario(dataset, "tutorial", {}, { today: startDate }).startDate, "2026-01-01");
});

test("La emisión CIPRL exige entrega y conserva el monto emitido al intentar cancelar", () => {
  const scenario = scenarioFor(startDate);
  scenario.projects.push({ id: "work-a", actorId: "gore", phases: [{ duration: 1 }] });
  scenario.oxiProjects[0].workId = "work-a";
  const firstDay = [
    command(0, "reserveOxi", { projectId: "a" }),
    command(1, "commitOxi", { projectId: "a" }),
    command(2, "startProject", { projectId: "work-a" }),
  ];
  const initial = step(createState(scenario), firstDay, scenario);
  assert.ok(initial.results.every(item => item.accepted));
  const date = initial.state.date;
  const { state, results } = step(load(save(initial.state), scenario), [
    command(3, "issueCiprl", { projectId: "a" }, date),
    command(4, "cancelOxi", { projectId: "a" }, date),
  ], scenario);
  assert.deepEqual(results.map(item => item.reasonCode), ["ACCEPTED", "OXI_STAGE_REQUIRED"]);
  assert.equal(state.ciprl.limits.cap.reserved, 0);
  assert.equal(state.ciprl.limits.cap.issued, 60);
  assert.equal(state.ciprl.limits.cap.free, 30);
});
