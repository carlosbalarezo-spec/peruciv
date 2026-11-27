// Extensión del Modo Juego (Gobernador Regional RTS) sobre peruciv — Etapa 3A.
import { createState, load, loadScenario, save, step } from "./engine/index.js";
import { guardrailMessage } from "./ui/committee.js";
import { describeEvent } from "./ui/format.js";
import { createGameHud } from "./ui/hud.js";
import { FLASHBACK_FRAMES } from "./ui/onboarding.js";
import { createGameOverlay } from "./ui/overlay.js";
import { createGamePanel } from "./ui/panel.js";

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

function peruToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
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

function launchScenario(session, app, scenarioId, renderAll) {
  const ds = structuredClone(session.dataset);
  const target = ds.scenarios.find((s) => s.id === scenarioId);
  if (target) target.startMode = session.onboarding.dateMode === "current" ? "current" : "fixed";
  const opts = session.onboarding.dateMode === "current" ? { today: peruToday() } : {};
  session.scenario = loadScenario(ds, scenarioId, {}, opts);
  session.state = createState(session.scenario, { emphasis: session.onboarding.emphasis });
  session.govName = (session.onboarding.govName || "").trim() || "Regional";
  session.events = [];
  session.speed = 0;
  session.tab = "cartera";
  session.dayOneNotice = null;
  session.phase = (session.scenario.budgetActions || []).length ? "day1" : "playing";
  frameScenario(app, session.scenario);
  renderAll();
}

function runDayOneOrder(session, actionId, fundId, renderAll) {
  const act = (session.scenario.budgetActions || []).find((a) => a.id === actionId);
  if (!act) return;
  const ord = { id: `d1-${actionId}-${session.state.nextSequence}`, date: session.state.date, sequence: session.state.nextSequence, actorId: session.scenario.actors[0].id, type: "allocateDayOne", payload: { actionId, fundId, amount: 1000 } };
  const res = step(session.state, [ord], session.scenario, { dayOneOnly: true });
  session.state = res.state;
  session.dayOneNotice = guardrailMessage(act, res.results[0]);
  if (res.events.length) session.events.push(...res.events);
  renderAll();
}

function runOxiOrder(session, app, type, projectId, advanceDay) {
  if (!session.state || session.state.sealed || !projectId) return;
  const ord = { id: `oxi-${type}-${projectId}-${session.state.nextSequence}`, date: session.state.date, sequence: session.state.nextSequence, actorId: session.scenario.actors[0].id, type, payload: { projectId } };
  advanceDay([ord]);
  app.ui.toast(`OxI (${type}) procesado.`);
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

function handleStorage(act, session, app, stopTimer, renderAll) {
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
    session.phase = "playing";
    session.speed = 0;
    renderAll();
    app.ui.toast("Partida cargada.");
  }
}

function startFlashbackLoop(session, stopFlash, renderAll) {
  stopFlash();
  session.phase = "flashback";
  session.onboarding.frame = 0;
  renderAll();
  session.flashTimer = setInterval(() => {
    if (session.onboarding.frame + 1 < FLASHBACK_FRAMES.length) {
      session.onboarding.frame += 1;
      renderAll();
    } else {
      stopFlash();
      session.phase = "emphasis";
      renderAll();
    }
  }, 650);
}

function handleOnboardingAction(kind, val, ctx) {
  const { session, app, stopFlash, renderAll } = ctx;
  const ob = session.onboarding;
  if (kind === "name") { ob.govName = val; return; }
  if (kind === "region") { ob.regionId = val; return renderAll(); }
  if (kind === "dateMode") { ob.dateMode = val; return; }
  if (kind === "jump-aqp") { ob.regionId = "04"; return startFlashbackLoop(session, stopFlash, renderAll); }
  if (kind === "jump-ica") { ob.regionId = "11"; return startFlashbackLoop(session, stopFlash, renderAll); }
  if (kind === "start-flashback") return startFlashbackLoop(session, stopFlash, renderAll);
  if (kind === "skip-flashback") { stopFlash(); session.phase = "emphasis"; return renderAll(); }
  if (kind === "pick-emphasis") { ob.emphasis = val; return renderAll(); }
  if (kind === "begin-day1") {
    const reg = (session.dataset.regions || []).find((r) => r.id === ob.regionId);
    launchScenario(session, app, reg?.playableScenario || "arequipa-matarani", renderAll);
  }
}

function dispatchHud(act, val, ctx) {
  const { session, app, stopTimer, renderAll, advanceDay, setSpeed } = ctx;
  if (act === "speed") return setSpeed(Number(val));
  if (act === "step") return advanceDay();
  if (act === "restart" && session.scenario) return launchScenario(session, app, session.scenario.id, renderAll);
  if (act === "exit") return app.setMode(null);
  handleStorage(act, session, app, stopTimer, renderAll);
}

function panelHandlers(ctx) {
  const { session, app, stopTimer, stopFlash, renderAll, advanceDay } = ctx;
  return {
    onOnboarding: (k, v) => handleOnboardingAction(k, v, ctx),
    onDayOneAction: (id, fund) => runDayOneOrder(session, id, fund, renderAll),
    onDayOneDone: () => { session.phase = "playing"; renderAll(); },
    onOxi: (t, pid) => runOxiOrder(session, app, t, pid, advanceDay),
    onTab: (tab) => { session.tab = tab; renderAll(); },
    onShowPicker: () => { stopTimer(); stopFlash(); session.phase = "setup"; session.scenario = null; session.state = null; renderAll(); },
    onOrder: (k, id, f) => { if (session.state && !session.state.sealed) advanceDay([buildOrder(session, k, id, f)]); },
  };
}

export async function install(app) {
  injectCss();
  const session = {
    active: false, dataset: null, scenario: null, state: null, speed: 0, tab: "cartera", events: [], timer: 0, flashTimer: 0,
    phase: "setup", govName: "Carlos", dayOneNotice: null,
    onboarding: { govName: "Carlos", regionId: "04", dateMode: "current", emphasis: "balanced", frame: 0 },
  };
  const stopTimer = () => { clearInterval(session.timer); session.timer = 0; };
  const stopFlash = () => { clearInterval(session.flashTimer); session.flashTimer = 0; };
  const renderAll = () => {
    hud.render(session.phase === "playing" ? session : null);
    if (session.active) panel.render(session, session.dataset);
    app.requestDraw();
  };
  const advanceDay = (orders = []) => stepSession(session, app, orders, stopTimer, renderAll);
  const setSpeed = (spd) => {
    session.speed = spd;
    stopTimer();
    const ms = SPEEDS[spd] || 0;
    if (ms > 0 && session.active && session.state && !session.state.sealed) session.timer = setInterval(() => advanceDay(), ms);
    renderAll();
  };
  const ctx = { session, app, stopTimer, stopFlash, renderAll, advanceDay, setSpeed };
  const hud = createGameHud({ onAction: (act, val) => dispatchHud(act, val, ctx) });
  const panel = createGamePanel(panelHandlers(ctx));

  app.registerOverlay(createGameOverlay(() => session));
  app.registerMode(MODE, {
    async enter() {
      session.active = true;
      session.dataset ??= await app.loadData("game");
      panel.attach(app.ui.dock("left", { width: 410, label: "Gobernador Regional" }));
      renderAll();
    },
    exit() {
      stopTimer();
      stopFlash();
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
