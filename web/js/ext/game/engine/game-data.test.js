import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadScenario, replay, routeMinutes } from "./index.js";

const dataset = JSON.parse(readFileSync(new URL("../../../../data/game.json", import.meta.url), "utf8"));

function play(scenario, orders, until = scenario.endDate) {
  const result = replay(scenario, orders.map(order => ({ date: order.date, order })), until);
  assert.equal(result.state.orderLog.length, orders.length);
  for (const { order, result: decision } of result.state.orderLog) {
    assert.equal(decision.accepted, true, JSON.stringify({ order, decision }));
  }
  return result;
}

function order(type, actorId, payload, date = "2026-01-01") {
  return { id: type, type, actorId, date, sequence: 0, payload };
}

for (const [strategy, projectId, openWinner, openMinutes, closedMinutes] of [
  ["agua", "aqp-water-work", "site-aqp-local", 205, 265],
  ["corredor", "aqp-road-work", "site-aqp-rival", 175, 230],
  ["por etapas", "aqp-water-work", "site-aqp-local", 205, 265],
]) {
  for (const interrupted of [false, true]) {
    test(`Arequipa · ${strategy} con corredor ${interrupted ? "interrumpido" : "abierto"}`, () => {
      const scenario = loadScenario(dataset, "arequipa-matarani");
      if (interrupted) {
        scenario.events.push(
          { id: "closure", date: "2026-04-16", sequence: 0,
            effects: [{ type: "closeEdge", edgeId: "edge-aqp-main" }] },
          { id: "reopening", date: "2026-05-16", sequence: 0,
            effects: [{ type: "openEdge", edgeId: "edge-aqp-main" }] },
        );
      }

      const staged = strategy === "por etapas";
      const orders = [order("startProject", "gore-04", {
        projectId, fundId: "fund-gore-04",
      }, staged ? "2026-01-11" : scenario.startDate)];
      if (staged) {
        orders.push(
          order("signAgreement", "gore-04", {
            agreementId: "aqp-fast-access", counterpartyId: "muni-0401", fundId: "fund-gore-04",
          }),
          order("inspectSite", "gore-04", { siteId: "site-aqp-local" }, "2026-02-01"),
        );
      }

      const route = state => routeMinutes(state.edges, "aqp-origin", "matarani-port");
      const { state, events } = play(scenario, orders, "2026-05-01");
      const offer = state.offers["offer-aqp-agro"];
      assert.equal(route(state), interrupted ? closedMinutes : openMinutes);
      assert.equal(offer.siteId, interrupted ? "site-aqp-rival" : openWinner);
      assert.equal(offer.scale, "full");
      assert.equal(offer.score, offer.siteId === "site-aqp-rival" ? 220 : 205);
      if (interrupted || strategy === "corredor") {
        const reason = strategy === "corredor" ? "WATER_BELOW_MINIMUM" : "ROUTE_ABOVE_MAXIMUM";
        assert.ok(events.some(event => event.type === "OFFER_INELIGIBLE" &&
          event.detail.siteId === "site-aqp-local" && event.reasonCode === reason));
      }
      if (staged) {
        assert.equal(state.agreements["aqp-fast-access"].delivery, "2026-01-31");
        assert.equal(state.inspections["site-aqp-local"], "2026-02-01");
        // El catálogo v0.1 entrega el agua antes de la oferta, a diferencia de la traza de diseño.
        assert.equal(state.projects[projectId].delivery, "2026-04-16");
        assert.equal(state.funds["fund-gore-04"].maintenanceReserved, 400);
        assert.equal(state.funds["fund-muni-0401"].maintenanceReserved, 200);
      }
      const final = play(scenario, orders).state;
      assert.equal(final.sealed, true);
      assert.equal(route(final), openMinutes);
      assert.equal(final.outcome.investment, offer.siteId === "site-aqp-local");
    });
  }
}

for (const [label, project, duration, rivalMinutes, minutes, winner, margin] of [
  ["reparar", "repair", null, 85, 80, "local", 300],
  ["reordenar", "schedule", null, 85, 95, "rival", 2000],
  ["esperar", null, null, 85, 110, "rival", 3000],
  ["entrega el día 90", "repair", 90, 85, 80, "local", 300],
  ["entrega el día 91", "repair", 91, 85, 110, "rival", 300],
  ["oferta desierta", "schedule", null, 100, 95, null, 2000],
]) {
  test(`Ica–Pisco · ${label}`, () => {
    const scenario = loadScenario(dataset, "ica-pisco-tutorial");
    const [offer] = scenario.offers;
    if (rivalMinutes === 100) offer.candidates.find(candidate => candidate.id === "ica-rival").minutes = 100;
    if (duration !== null) {
      scenario.projects.find(item => item.id === "ica-repair-access").phases[0].duration = duration;
    }
    const orders = project ? [order("startProject", "gore-11", {
      projectId: `ica-${project}-access`, fundId: "fund-gore-11",
    })] : [];
    const { state, events } = play(scenario, orders, "2026-04-01");
    const decision = state.offers[offer.id];
    assert.equal(routeMinutes(state.edges, "ica-origin", "pisco-port"), minutes);
    assert.equal(decision.status, winner ? "awarded" : "unawarded");
    assert.equal(decision.siteId, winner ? `site-ica-${winner}` : undefined);
    const fund = state.funds["fund-gore-11"];
    assert.equal(fund.balance - fund.reserved - fund.maintenanceReserved, margin);
    const excluded = events.filter(event => event.type === "OFFER_INELIGIBLE");
    assert.deepEqual(excluded.map(event => [event.detail.siteId, event.reasonCode, event.detail.actual]),
      [
        ...(minutes > 90 ? [["site-ica-local", "ROUTE_ABOVE_MAXIMUM", minutes]] : []),
        ...(rivalMinutes > 90 ? [["site-ica-rival", "ROUTE_ABOVE_MAXIMUM", rivalMinutes]] : []),
      ]);
    const final = play(scenario, orders).state;
    assert.equal(final.sealed, true);
    assert.equal(final.outcome.investment, winner === "local");
  });
}
