// Barra superior flotante del reloj RTS, tesorería y controles de partida.
import { esc } from "../../../format.js";
import { fmtMoney } from "./format.js";

function mainFund(state) {
  const funds = Object.values(state?.funds || {});
  return funds[0] || { balance: 0, reserved: 0, maintenanceReserved: 0 };
}

export function createGameHud(actions) {
  const el = document.createElement("div");
  el.id = "game-hud";
  el.hidden = true;
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", "Reloj y tesorería del juego");
  document.body.appendChild(el);

  el.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    actions.onAction(btn.dataset.act, btn.dataset.val);
  });

  function render(session) {
    if (!session?.active || !session.state) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const st = session.state;
    const f = mainFund(st);
    const avail = f.balance - f.reserved - f.maintenanceReserved;
    const sp = session.speed;
    const spdBtn = (v, lbl) => `<button type="button" class="gh-btn${sp === v ? " active" : ""}" data-act="speed" data-val="${v}">${lbl}</button>`;
    el.innerHTML = `
      <span class="gh-date">${esc(st.date)}</span>
      <div class="gh-speeds">
        ${spdBtn(0, "⏸")}
        ${spdBtn(1, "1×")}
        ${spdBtn(2, "2×")}
        ${spdBtn(4, "4×")}
        <button type="button" class="gh-btn" data-act="step" title="Avanzar 1 día">+1d</button>
      </div>
      <span class="gh-sep"></span>
      <div class="gh-stat"><small>Disponible</small><b>${fmtMoney(avail)}</b></div>
      <div class="gh-stat"><small>O&amp;M Res.</small><b>${fmtMoney(f.maintenanceReserved)}</b></div>
      <span class="gh-sep"></span>
      <button type="button" class="gh-btn" data-act="save">Guardar</button>
      <button type="button" class="gh-btn" data-act="load">Cargar</button>
      <button type="button" class="gh-btn" data-act="restart">Reiniciar</button>
      <button type="button" class="gh-btn" data-act="exit">Salir</button>
    `;
  }

  return {
    render,
    hide() { el.hidden = true; },
  };
}
