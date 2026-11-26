import { add, compareId, get, nonnegative } from "./data.js";
import { available, routeMinutes } from "./network.js";

export function qualify(state, candidate, requirements) {
  const failures = [];
  const check = (reasonCode, metric, actual, required, operator, unit, refs = {}) => {
    const passed = actual !== null && (operator === ">=" ? actual >= required : actual <= required);
    if (!passed) failures.push({
      reasonCode: actual === null ? metric === "route" ? "NO_ROUTE" : "DATA_UNKNOWN" : reasonCode,
      metric, actual, required, operator, unit, ...refs,
    });
  };
  const minutes = candidate.route
    ? routeMinutes(state.edges, candidate.route.from, candidate.route.to)
    : candidate.minutes ?? null;
  if (minutes !== null) nonnegative(minutes);
  check("ROUTE_ABOVE_MAXIMUM", "route", minutes, nonnegative(requirements.maxMinutes), "<=", "min");
  if (requirements.access) {
    check("ACCESS_REQUIRED", "access", Number(get(state.access, candidate.siteId) === true), 1, ">=", "boolean");
  }
  if (requirements.inspectionBefore) {
    const inspected = get(state.inspections, candidate.siteId);
    check("INSPECTION_REQUIRED", "inspection", Number(Boolean(inspected && inspected < requirements.inspectionBefore)),
      1, ">=", "boolean");
  }
  if (requirements.fundedBy) {
    const projectId = candidate.expansionId;
    const project = get(state.projects, projectId);
    check("EXPANSION_NOT_FUNDED", "expansion", Number(Boolean(project && project.delivery <= requirements.fundedBy)),
      1, ">=", "boolean", { projectId: projectId ?? null });
  }

  const reserves = [];
  for (const [metric, unit] of [["water", "mL/s"], ["energy", "kW"]]) {
    const required = nonnegative(requirements[metric] ?? 0);
    if (!required) continue;
    const nodeId = candidate[metric + "NodeId"] ?? null;
    const node = get(state.nodes, nodeId);
    const amount = node?.service === metric ? available(state, nodeId) : null;
    check(metric === "water" ? "WATER_BELOW_MINIMUM" : "ENERGY_BELOW_MINIMUM",
      metric, amount, required, ">=", unit, { nodeId });
    reserves.push({ nodeId, amount: required });
  }
  return { minutes, failures, reserves };
}

export function evaluateOffer(state, offer, emit) {
  const eligible = [];
  for (const candidate of [...offer.candidates].sort(compareId)) {
    const scale = candidate.scale ?? "full";
    const requirements = { ...offer.requirements, ...get(offer.scales ?? {}, scale) };
    const result = qualify(state, candidate, requirements);
    const references = { siteId: candidate.siteId, candidateId: candidate.id, scale };
    if (result.failures.length) {
      for (const failure of result.failures) {
        const { reasonCode, ...detail } = failure;
        emit("OFFER_INELIGIBLE", offer.id, reasonCode, {
          ...references, ...detail, blocksComparison: true,
        });
      }
      continue;
    }
    const score = add(result.minutes, nonnegative(requirements.virtualMinutes ?? 0));
    eligible.push({ id: candidate.id, ...references, minutes: result.minutes, score, reserves: result.reserves });
  }

  eligible.sort((a, b) => a.score - b.score ||
    Number(b.scale === "full") - Number(a.scale === "full") ||
    (a.siteId < b.siteId ? -1 : Number(a.siteId > b.siteId)) || compareId(a, b));
  const winner = eligible[0];
  state.offers[offer.id] = winner ? { status: "awarded", ...winner } : { status: "unawarded" };
  if (winner) {
    for (const reserve of winner.reserves) state.reservations.push({ offerId: offer.id, ...reserve });
  }
  emit("OFFER_DECIDED", offer.id, winner ? "BEST_ELIGIBLE" : "NO_ELIGIBLE_CANDIDATE", state.offers[offer.id]);
}
