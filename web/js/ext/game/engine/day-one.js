import { add, date, get, index, nonnegative } from "./data.js";

const goals = {
  services: ["services"],
  investment: ["investment"],
  dialogue: ["dialogue"],
  balanced: ["services", "investment", "dialogue"],
};

export function dayOne(scenario, emphasis) {
  const priorities = get(goals, emphasis);
  if (!priorities) throw new Error("Énfasis de campaña inválido");
  const asOf = scenario.asOfBySource ?? {};
  for (const cut of Object.values(asOf)) date(cut);
  const inherited = scenario.inherited ?? null;
  if (inherited) {
    if (inherited.year !== Number(scenario.startDate.slice(0, 4))) {
      throw new Error("Ejercicio heredado incompatible con el inicio");
    }
    const funds = index(scenario.funds);
    const fiscal = index(inherited.funds);
    for (const row of inherited.funds) {
      const fund = get(funds, row.id);
      if (!fund || !get(asOf, row.sourceId)) throw new Error("Fondo heredado sin referencia");
      const { pia, pim, compromiso, devengado, available } = row;
      [pia, pim, compromiso, devengado, available].forEach(nonnegative);
      if (devengado > compromiso || compromiso > pim || available > pim - compromiso) {
        throw new Error("Disponibilidad fiscal inconsistente");
      }
    }
    index(inherited.portfolio.map(item => ({ id: item.cui })));
    for (const item of inherited.portfolio) {
      if (item.status !== "in_progress" || !get(asOf, item.sourceId) ||
          nonnegative(item.progressPermille) > 1000) throw new Error("Cartera heredada inválida");
      nonnegative(item.pending);
    }
    for (const item of inherited.obligations ?? []) {
      date(item.startDate);
      nonnegative(item.amount);
      if (item.dueYear !== undefined) nonnegative(item.dueYear);
      if (!get(fiscal, item.fundId) || nonnegative(item.reserved ?? 0) > item.amount ||
          typeof item.includedInCommitment !== "boolean" ||
          (item.includedInCommitment && (item.reserved || item.dueYear !== inherited.year))) {
        throw new Error("Obligación heredada inválida");
      }
    }
  }
  return {
    startDate: scenario.startDate, asOf, inherited,
    campaign: { emphasis, priorities }, allocations: [],
  };
}

export function reprogramInheritedFunds(state, scenario) {
  if (!state.inherited) return;
  const year = Number(state.date.slice(0, 4));
  const credits = get(scenario.annualBudgets ?? {}, String(year)) ?? {};
  for (const row of state.inherited.funds) {
    const fund = state.funds[row.id];
    const protectedBalance = add(fund.reserved, fund.maintenanceReserved);
    fund.balance = add(fund.carryForward === true ? fund.balance : Math.min(fund.balance, protectedBalance),
      nonnegative(get(credits, fund.id) ?? 0));
  }
}
