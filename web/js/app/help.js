// Guía rápida de teclado y ratón.
import { icon } from "../ui/icon.js";

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
const MOD = isMac ? "⌘" : "Ctrl";

const ROWS = [
  ["Navegación", [
    [["Arrastrar", "←↑→↓", "WASD"], "Desplazar el mapa"],
    [["Rueda", "+", "–"], "Acercar y alejar"],
    [["Doble clic"], "Acercar en un punto"],
    [["Dos dedos"], "Pellizcar para zoom y arrastrar (táctil)"],
    [["Minimapa"], "Clic o arrastrar para saltar"],
  ]],
  ["Explorar", [
    [["Clic en ciudad"], "Abrir el panel / Vista de Ciudad"],
    [["Clic en región"], "Abrir ese departamento"],
    [["/", `${MOD} K`], "Buscar ciudades y departamentos"],
    [["L", "Shift L"], "Siguiente / anterior lente"],
    [["Leyenda"], "Pasar o arrastrar sobre la escala para filtrar"],
    [["R"], "Mostrar u ocultar recursos"],
  ]],
  ["Paneles", [
    [["?"], "Esta ayuda"],
    [["Esc"], "Cerrar ayuda, búsqueda, Almanaque o panel activo"],
  ]],
];

export function initHelp() {
  const modal = document.getElementById("help");
  if (!modal) return { open() {}, close() {}, get isOpen() { return false; } };
  const card = modal.querySelector(".help-card");
  let restore = null;
  card.innerHTML = `
    <button class="icon-btn help-close" data-close aria-label="Cerrar ayuda">${icon("close", "✕", { size: 13 })}</button>
    <h2 id="help-title">${icon("help", "?", { size: 22 })}<span>Controles</span></h2>
    <div class="help-cols">${ROWS.map(([title, rows]) => `
      <section><h3>${title}</h3>${rows.map(([keys, what]) => `
        <div class="help-row"><span class="keys">${keys.map((k) => `<kbd>${k}</kbd>`).join("")}</span><span>${what}</span></div>`).join("")}
      </section>`).join("")}</div>
    <p class="help-foot">Cada cifra proviene de fuentes públicas oficiales: abre el <b>Almanaque</b> para ver el catálogo completo
      (<code>datosabiertos.gob.pe</code>, INEI, MINEM, SERNANP, MINCETUR, SUNEDU, OSITRAN, INDECI, MTPE y MinCul).
      El enlace en la barra de direcciones guarda siempre la vista exacta.</p>`;

  const close = () => {
    if (modal.hidden) return;
    modal.hidden = true;
    if (restore && document.contains(restore)) restore.focus();
    restore = null;
  };
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest("[data-close]")) close();
  });
  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    card.querySelector("[data-close]").focus();
  });

  return {
    open() {
      if (!modal.hidden) return;
      restore = document.activeElement;
      modal.hidden = false;
      card.querySelector("[data-close]").focus();
    },
    close,
    toggle() { modal.hidden ? this.open() : close(); },
    get isOpen() { return !modal.hidden; },
  };
}
