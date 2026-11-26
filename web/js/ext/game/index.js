// Extensión del Modo Juego (Gobernador Regional RTS) sobre peruciv.
import { createState, load, loadScenario, save, step } from "./engine/index.js";
import { createGameOverlay } from "./ui/overlay.js";
import { createGameHud } from "./ui/hud.js";
import { createGamePanel } from "./ui/panel.js";
import { describeEvent } from "./ui/format.js";

const MODE = "game";
const CSS_HREF = new URL("../../../css/game.css", import.meta.url).href;
const SAVE_PREFIX = "peruciv:save:";
const SPEEDS = { 0: 0, 1: 750, 2: 360, 4: 150 };

function injectCss() {
  if (document.getElementById("game-css")) return;
  const l = document.createElement("link");
  l.id = "game-css";
  l.rel = "stylesheet";
  l.href = CSS_HREF;
  document.head.appendChild(l);
}

function frameScenario(app, scenario) {
  const cells = [
    ...(scenario.edges || []).flatMap((e) => e.cells || []),
    ...(scenario.sites || []).filter((s) => s.cell != null).map((s) => s.cell),
  ];
  const grid = app?.w?.grid;
  if (!cells.length || !grid) return;
  const xs = cells.map((c) => grid.cx(c));
  const ys = cells.map((c) => grid.cy(c));
  const pad = grid.R * 3;
  app.fitBounds(Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad);
}

function buildOrder(session, kind, id, fundId) {
  const st = session.state;
  const sc = session.scenario;
  const base = { id: `${kind}-${id}-${st.date}-${st.nextSequence}`, date: st.date, sequence: st.nextSequence, actorId: sc.actors[0].id };
  if (kind === "project") return { ...base, type: "startProject", payload: { projectId: id, fundId } };
  if (kind === "agreement") {
    const ag = sc.agreements.find((a) => a.id === id);
    return { ...base, type: "signAgreement", payload: { agreementId: id, counterpartyId: ag.counterpartyId, fundId } };
  }
  return { ...base, type: "inspectSite", payload: { siteId: id } };
}

function handleStorageAction(act, session, app, stopTimer, renderAll) {
  if (!session.scenario) return;
  const key = SAVE_PREFIX + session.scenario.id;
  if (act === "save" && session.state) {
    localStorage.setItem(key, save(session.state));
    return app.ui.toast("Partida guardada en este navegador.");
  }
  if (act === "load") {
    const raw = localStorage.getItem(key);
    if (!raw) return app.ui.toast("No hay partida guardada para este escenario.");
    stopTimer();
    session.state = load(raw, session.scenario);
    session.speed = 0;
    renderAll();
    app.ui.toast("Partida cargada.");
  }
}

function stepSession(session, app, orders, stopTimer, renderAll) {
  if (!session.state || session.state.sealed) return stopTimer();
  const res = step(session.state, orders, session.scenario);
  session.state = res.state;
  if (res.events.length) session.events.push(...res.events);
  const bad = res.results?.find((r) => !r.accepted);
  if (bad) app.ui.toast(describeEvent({ type: "ORDER_REJECTED", reasonCode: bad.reasonCode }).text);
  if (session.state.sealed) stopTimer();
  renderAll();
}

function applySpeed(session, spd, stopTimer, onTick, renderAll) {
  session.speed = spd;
  stopTimer();
  const ms = SPEEDS[spd] || 0;
  if (ms > 0 && session.active && session.state && !session.state.sealed) {
    session.timer = setInterval(onTick, ms);
  }
  renderAll();
}

function beginScenario(session, app, scenarioId, stopTimer, renderAll) {
  stopTimer();
  session.scenario = loadScenario(session.dataset, scenarioId);
  session.state = createState(session.scenario);
  session.events = [];
  session.speed = 0;
  session.tab = "cartera";
  frameScenario(app, session.scenario);
  renderAll();
}

function dispatchHud(act, val, ctx) {
  const { session, app, stopTimer, renderAll, advanceDay, setSpeed, startScenario } = ctx;
  if (act === "speed") return setSpeed(Number(val));
  if (act === "step") return advanceDay();
  if (act === "restart" && session.scenario) return startScenario(session.scenario.id);
  if (act === "exit") return app.setMode(null);
  handleStorageAction(act, session, app, stopTimer, renderAll);
}

export async function install(app) {
  injectCss();
  const session = { active: false, dataset: null, scenario: null, state: null, speed: 0, tab: "cartera", events: [], timer: 0 };
  const stopTimer = () => { clearInterval(session.timer); session.timer = 0; };
  const renderAll = () => {
    hud.render(session);
    if (session.active) panel.render(session, session.dataset);
    app.requestDraw();
  };
  const advanceDay = (orders = []) => stepSession(session, app, orders, stopTimer, renderAll);
  const setSpeed = (spd) => applySpeed(session, spd, stopTimer, () => advanceDay(), renderAll);
  const startScenario = (id) => beginScenario(session, app, id, stopTimer, renderAll);

  const hud = createGameHud({
    onAction: (act, val) => dispatchHud(act, val, { session, app, stopTimer, renderAll, advanceDay, setSpeed, startScenario }),
  });

  const panel = createGamePanel({
    onPickScenario: startScenario,
    onTab: (tab) => { session.tab = tab; renderAll(); },
    onShowPicker: () => { stopTimer(); session.scenario = null; session.state = null; renderAll(); },
    onOrder: (kind, id, fundId) => { if (session.state && !session.state.sealed) advanceDay([buildOrder(session, kind, id, fundId)]); },
  });

  app.registerOverlay(createGameOverlay(() => session));
  app.registerMode(MODE, {
    async enter() {
      session.active = true;
      session.dataset ??= await app.loadData("game");
      panel.attach(app.ui.dock("left", { width: 400, label: "Gobernador Regional" }));
      if (!session.scenario && session.dataset?.scenarios?.length) startScenario(session.dataset.scenarios[0].id);
      else renderAll();
    },
    exit() {
      stopTimer();
      session.active = false;
      hud.hide();
      panel.detach();
      app.ui.undock("left");
      app.requestDraw();
    },
  });

  app.ui.addTopButton({
    id: "btn-game",
    icon: "🎮",
    label: "Gobernar",
    title: "Modo Juego (RTS): administra presupuesto, obras y ofertas regionales en tiempo real",
    onClick: () => app.setMode(app.mode === MODE ? null : MODE),
  });
}
