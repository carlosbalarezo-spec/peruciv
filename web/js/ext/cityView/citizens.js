// Filas de "Ciudadanos" en la Vista de Ciudad: siluetas proporcionales desde citizens.json.
import { esc, int, pct } from "../../format.js";
import { compact } from "./fmt.js";
import { CATEGORY_COLOR, figureCanvas, loadPainter } from "./figures.js";

const ROWS = [
  { id: "workforce", title: "Fuerza laboral", sub: "por ocupación", noun: ["trabajador", "trabajadores"], n: null },
  { id: "age", title: "Generaciones", sub: "por grupo de edad", noun: ["residente", "residentes"], n: null },
  { id: "commute", title: "Transporte", sub: "cómo van al trabajo", noun: ["trabajador", "trabajadores"], n: null },
  { id: "education", title: "Educación", sub: "adultos de 25+ años", noun: ["adulto", "adultos 25+"], n: 10 },
  { id: "nativity", title: "Origen", sub: "lugar de nacimiento", noun: ["residente", "residentes"], n: 10 },
];

const PHRASE = {
  workforce: {
    executive: ["es directivo o gerente", "son directivos o gerentes"],
    engineer: ["es ingeniero, científico o especialista TI", "son ingenieros, científicos o especialistas TI"],
    scholar: ["trabaja en docencia, técnica o cultura", "trabajan en docencia, técnica o cultura"],
    healer: ["trabaja en el sector salud", "trabajan en el sector salud"],
    service: ["trabaja en comercio, gastronomía o servicios", "trabajan en comercio, gastronomía o servicios"],
    clerk: ["es empleado administrativo o de oficina", "son empleados administrativos o de oficina"],
    farmer: ["trabaja en agricultura, ganadería o pesca", "trabajan en agricultura, ganadería o pesca"],
    builder: ["trabaja en construcción, minería u oficios", "trabajan en construcción, minería u oficios"],
    maker: ["es operador industrial o conductor", "son operadores industriales o conductores"],
  },
  age: {
    child: ["es menor de 18 años", "son menores de 18 años"],
    young: ["es joven adulto (18–34)", "son jóvenes adultos (18–34)"],
    midlife: ["tiene entre 35 y 64 años", "tienen entre 35 y 64 años"],
    elder: ["tiene 65 años o más", "tienen 65 años o más"],
  },
  commute: {
    drove_alone: ["va en auto particular", "van en auto particular"],
    carpool: ["viaja en colectivo o vehículo compartido", "viajan en colectivo o vehículo compartido"],
    transit: ["usa transporte público (bus, combi o tren)", "usan transporte público (bus, combi o tren)"],
    walk: ["camina hacia su trabajo", "caminan hacia su trabajo"],
    other: ["va en mototaxi, taxi o bicicleta", "van en mototaxi, taxi o bicicleta"],
    home: ["trabaja desde casa", "trabajan desde casa"],
  },
  education: {
    less_than_hs: ["no completó secundaria", "no completaron secundaria"],
    high_school: ["tiene secundaria completa", "tienen secundaria completa"],
    some_college: ["tiene educación técnica o superior incompleta", "tienen educación técnica o superior incompleta"],
    bachelors: ["tiene grado universitario", "tienen grado universitario"],
    graduate: ["tiene maestría o doctorado", "tienen maestría o doctorado"],
  },
  nativity: {
    born_in_state: ["nació en este departamento", "nacieron en este departamento"],
    other_state: ["migró desde otra región del Perú", "migraron desde otras regiones del Perú"],
    native_abroad: ["es peruano retornado del exterior", "son peruanos retornados del exterior"],
    foreign_born: ["nació en otro país", "nacieron en otro país"],
  },
};

const SHORT = {
  workforce: { executive: "Directivos", engineer: "Ingenieros y TI", scholar: "Docentes/técnicos", healer: "Salud", service: "Comercio y serv.",
    clerk: "Oficina", farmer: "Agro y pesca", builder: "Construcción/mina", maker: "Industria/transp." },
  age: { child: "< 18", young: "18–34", midlife: "35–64", elder: "65+" },
  commute: { drove_alone: "Auto propio", carpool: "Colectivo", transit: "Transp. público", walk: "A pie", other: "Mototaxi / bici", home: "En casa" },
  education: { less_than_hs: "Sin secund.", high_school: "Secundaria", some_college: "Técnica", bachelors: "Universitaria", graduate: "Posgrado" },
  nativity: { born_in_state: "Esta región", other_state: "Otra región", native_abroad: "Retornado", foreign_born: "Extranjero" },
};

export function largestRemainder(counts, keys, n) {
  const tot = keys.reduce((a, k) => a + (counts[k] || 0), 0);
  if (!(tot > 0)) return null;
  const raw = keys.map((k) => ((counts[k] || 0) / tot) * n);
  const out = raw.map(Math.floor);
  let left = n - out.reduce((a, v) => a + v, 0);
  const order = raw.map((v, j) => [v - Math.floor(v), j]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < left; k++) out[order[k][1]]++;
  return Object.fromEntries(keys.map((k, j) => [k, out[j]]));
}

export function oneIn(share) {
  if (share == null || !Number.isFinite(share)) return null;
  if (share <= 0) return { text: "ninguno de los", plural: true };
  if (share < 0.001) return { text: "menos de 1 de cada 1,000", plural: false };
  if (share >= 0.3) {
    const k = Math.round(share * 10);
    return k >= 10 ? { text: "casi todos los", plural: true } : { text: `${k} de cada 10`, plural: k !== 1 };
  }
  const n = Math.round(1 / share);
  return { text: `1 de cada ${int(n)}`, plural: false };
}

function sentence(rowId, key, share, natShare, cityName, noun) {
  const a = oneIn(share);
  if (!a) return "";
  const ph = PHRASE[rowId]?.[key] || ["pertenece a este grupo", "pertenecen a este grupo"];
  const pe = oneIn(natShare);
  const lead = a.text.charAt(0).toUpperCase() + a.text.slice(1);
  return `${lead} ${noun[1]} en ${cityName} ${a.plural ? ph[1] : ph[0]}${pe ? ` (Perú: ${pe.text})` : ""}`;
}

function rowModel(rowDef, row, nat, groups, figuresN) {
  const keys = (groups[rowDef.id] || []).map((g) => g.key);
  const n = figuresN[rowDef.id] ?? rowDef.n ?? 10;
  const figs = row.figures || largestRemainder(row.counts || {}, keys, n);
  const natFigs = nat?.figures || (nat ? largestRemainder(nat.counts || {}, keys, n) : null);
  return { keys, n, figs, natFigs };
}

function specMap(city) {
  const m = new Map();
  for (const s of city?.specialists || []) m.set(`${s.row}|${s.key}`, s);
  return m;
}

export function citizensHtml(m, data) {
  const c = m.city;
  if (data === undefined) return `<p class="muted cv-note">Cargando composición ciudadana…</p>`;
  if (!data || !data.cities) return `<p class="muted cv-note">Composición ciudadana no disponible.</p>`;
  const row0 = data.cities[c.id];
  if (!row0) return `<p class="muted cv-note">Sin desagregación ciudadana para ${esc(c.name)}.</p>`;
  const nat = data.national || {};
  const groups = data.groups || {};
  const specs = specMap(row0);
  const label = Object.fromEntries(Object.entries(groups).map(([r, gs]) => [r, Object.fromEntries(gs.map((g) => [g.key, g.label]))]));

  const med = row0.age?.median, peMed = nat.age?.median;
  const ba = row0.education?.bachelors_plus, peBa = nat.education?.bachelors_plus;
  const fb = row0.nativity?.foreign_born ?? row0.nativity?.shares?.foreign_born;
  const peFb = nat.nativity?.foreign_born ?? nat.nativity?.shares?.foreign_born;
  const chip = (v, pe, fmt, lbl, tip) => (v == null ? "" : `<div class="cv-cz-chip" title="${esc(tip)}"><b>${fmt(v)}</b><span>${esc(lbl)}</span>${pe != null ? `<small>Perú ${fmt(pe)}</small>` : ""}</div>`);
  const top = (row0.specialists || []).find((s) => s.ratio >= (data.rule?.specialist_high ?? 1.45));
  const topRow = ROWS.find((r) => r.id === top?.row);
  const great = top && topRow ? `<div class="cv-great" style="--fc:${esc(CATEGORY_COLOR[top.row]?.[top.key] || "#c9a45c")}">
      <span class="cv-great-fig" data-great="${esc(top.row)}|${esc(top.key)}" aria-hidden="true"></span>
      <div><small>Perfil destacado</small><b>${esc(label[top.row]?.[top.key] || top.key)}</b>
      <span>${pct(top.share, 1)} de ${esc(topRow.noun[1])} aquí vs. ${pct(top.national, 1)} nacional (${top.ratio.toFixed(1)}× el promedio del Perú).</span></div></div>` : "";

  const rows = ROWS.map((rd) => {
    const row = row0[rd.id];
    const head = `<div class="cv-cz-h"><b>${esc(rd.title)}</b><span>${esc(rd.sub)}</span></div>`;
    if (!row) return `<div class="cv-cz-row missing" data-row="${rd.id}">${head}<p class="muted cv-note">Sin datos disponibles.</p></div>`;
    const { keys, n, figs } = rowModel(rd, row, nat[rd.id], groups, data.figures || {});
    if (!figs) return `<div class="cv-cz-row missing" data-row="${rd.id}">${head}<p class="muted cv-note">Sin conteos.</p></div>`;
    const per = row.total / n;
    const cells = [];
    for (const k of keys) {
      for (let j = 0; j < (figs[k] || 0); j++) {
        const sp = specs.get(`${rd.id}|${k}`);
        const mark = sp ? (sp.ratio >= 1 ? "up" : "down") : "";
        cells.push(`<span class="cv-fig${mark ? ` ${mark}` : ""}" tabindex="${j ? -1 : 0}" role="img" data-k="${esc(k)}" aria-label="${esc(label[rd.id]?.[k] || k)}"></span>`);
      }
    }
    const legend = keys.map((k) => {
      const sh = row.shares?.[k], pe = nat[rd.id]?.shares?.[k];
      const sp = specs.get(`${rd.id}|${k}`);
      const chev = sp ? `<em class="${sp.ratio >= 1 ? "up" : "down"}" title="${sp.ratio.toFixed(1)}× el promedio nacional">${sp.ratio >= 1 ? "▲" : "▼"}</em>` : "";
      return `<span class="cv-cz-k${figs[k] ? "" : " zero"}" data-k="${esc(k)}" title="${esc(label[rd.id]?.[k] || k)}: ${sh != null ? pct(sh, 1) : "–"}${pe != null ? ` (Perú ${pct(pe, 1)})` : ""}"><i style="background:${esc(CATEGORY_COLOR[rd.id]?.[k] || "#888")}"></i>${esc(SHORT[rd.id]?.[k] || k)} <small>${sh != null ? pct(sh, 0) : "–"}</small>${chev}</span>`;
    }).join("");
    const peBar = nat[rd.id]?.shares ? `<div class="cv-cz-us" title="Promedio del Perú en el mismo orden"><span>Perú</span><div>${keys.map((k) => {
      const s = nat[rd.id].shares[k] || 0;
      return s > 0 ? `<i style="flex:${s};background:${esc(CATEGORY_COLOR[rd.id]?.[k] || "#888")}" title="${esc(SHORT[rd.id]?.[k] || k)}: ${pct(s, 1)} en el Perú"></i>` : "";
    }).join("")}</div></div>` : "";
    const cap = `Cada figura ≈ ${compact(per)} ${rd.noun[1]} · ${compact(row.total)} en total`;
    const extra = rd.id === "age" && med != null ? ` · edad mediana ${med.toFixed(1)}${peMed != null ? ` (Perú ${peMed.toFixed(1)})` : ""}` : "";
    return `<div class="cv-cz-row" data-row="${rd.id}" style="--n:${n}">${head}
      <div class="cv-figs" role="group" aria-label="${esc(rd.title)}">${cells.join("")}</div>
      ${peBar}
      <div class="cv-cz-out" aria-live="polite" data-default="${esc(cap + extra)}">${esc(cap + extra)}</div>
      <div class="cv-cz-legend">${legend}</div>
    </div>`;
  }).join("");

  return `
    <div class="cv-cz-top">
      ${chip(med, peMed, (v) => v.toFixed(1), "edad mediana", "Edad mediana estimada (INEI)")}
      ${chip(ba, peBa, (v) => pct(v, 0), "grado univ.", "Adultos 25+ con grado universitario o posgrado (INEI)")}
      ${chip(fb, peFb, (v) => pct(v, 0), "nac. exterior", "Residentes nacidos en otro país")}
    </div>
    ${great}
    <div class="cv-cz">${rows}</div>
    <p class="cv-note">${esc(data.vintage || "INEI / MTPE 2025")}. Pasa el cursor sobre cada figura para comparar con el promedio nacional (▲▼ = ≥ 1.45× o ≤ 0.67×).</p>`;
}

export function mountCitizens(host, m, data) {
  if (!host || !data?.cities?.[m.city.id]) return;
  const row0 = data.cities[m.city.id];
  const nat = data.national || {};
  const dpr = Math.min(3, Math.max(1, Math.round((devicePixelRatio || 1) * 2) / 2));
  const paintAll = () => {
    host.querySelectorAll(".cv-cz-row[data-row]").forEach((rowEl) => {
      const rid = rowEl.dataset.row;
      rowEl.querySelectorAll(".cv-fig").forEach((el) => {
        const src = figureCanvas(rid, el.dataset.k, 36, dpr);
        const cv = document.createElement("canvas");
        cv.width = src.width;
        cv.height = src.height;
        cv.getContext("2d").drawImage(src, 0, 0);
        el.replaceChildren(cv);
      });
    });
    const g = host.querySelector("[data-great]");
    if (g) {
      const [rid, k] = g.dataset.great.split("|");
      const src = figureCanvas(rid, k, 36, dpr);
      const cv = document.createElement("canvas");
      cv.width = src.width;
      cv.height = src.height;
      cv.getContext("2d").drawImage(src, 0, 0);
      g.replaceChildren(cv);
    }
  };
  paintAll();
  loadPainter().then(() => { if (host.isConnected) paintAll(); });

  host.querySelectorAll(".cv-cz-row[data-row]").forEach((rowEl) => {
    const rid = rowEl.dataset.row;
    const rd = ROWS.find((r) => r.id === rid);
    const row = row0[rid];
    const out = rowEl.querySelector(".cv-cz-out");
    if (!row || !out) return;
    const show = (k) => {
      rowEl.querySelectorAll("[data-k]").forEach((el) => el.classList.toggle("lit", el.dataset.k === k));
      rowEl.classList.toggle("focus", !!k);
      if (!k) {
        out.textContent = out.dataset.default;
        out.classList.remove("on");
        return;
      }
      const sh = row.shares?.[k], pe = nat[rid]?.shares?.[k];
      out.innerHTML = `${esc(sentence(rid, k, sh, pe, m.city.name, rd.noun))}<small>${sh != null ? pct(sh, 1) : "–"} aquí${pe != null ? ` · ${pct(pe, 1)} en el Perú` : ""}${row.counts?.[k] != null ? ` · ≈${compact(row.counts[k])} personas` : ""}</small>`;
      out.classList.add("on");
    };
    let pinned = null;
    rowEl.addEventListener("pointerover", (e) => {
      const el = e.target.closest("[data-k]");
      if (el && rowEl.contains(el)) show(el.dataset.k);
    });
    rowEl.addEventListener("pointerleave", () => show(pinned));
    rowEl.addEventListener("focusin", (e) => {
      const el = e.target.closest("[data-k]");
      if (el) show(el.dataset.k);
    });
    rowEl.addEventListener("focusout", () => show(pinned));
    rowEl.addEventListener("click", (e) => {
      const el = e.target.closest("[data-k]");
      if (!el) return;
      pinned = pinned === el.dataset.k ? null : el.dataset.k;
      show(pinned);
    });
  });
}
