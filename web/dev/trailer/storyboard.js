// Storyboard del tráiler de peruciv: todos los datos en pantalla provienen en vivo de web/data/*.json.
export const CONFIG = {
  title: "República del Perú",
  subtitle: "como un juego de estrategia — construido con datos públicos reales",
  url: "peruciv",
  cta: "Código abierto · Datos Abiertos del Perú",
};

import {
  titleCard, endCard, caption, chip, lensLegend, cityPanel, caravans, routeGlow, pulseRing, vignette, darken,
  win, smooth, easeInOut, lerp, clamp01,
} from "./overlays.js";
import { badgeOf, cityDistricts } from "../../js/ext/cityView/districts.js";

export const FPS = 30;
export const W = 1920, H = 1080;
const FADE = 0.45;

const money = (v) => {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}B`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)} mil M`;
  return `$${(v / 1e6).toFixed(0)} M`;
};
const moneyShort = (v) => (v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${(v / 1e6).toFixed(0)}M`);
const people = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)} millones` : `${Math.round(v / 1e3)} mil`);
const peopleShort = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : `${Math.round(v / 1e3)}K`);
const int = (v) => Math.round(v).toLocaleString("en-US");
function oneIn(share) {
  if (!(share > 0)) return "ninguno";
  if (share >= 0.3) return `${Math.round(share * 10)} de cada 10`;
  return `1 de cada ${Math.round(1 / share)}`;
}
const stripParen = (s) => String(s || "").replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
function srcLabel(s) {
  if (!s) return "";
  return stripParen(s.title);
}

function camAt(a, b, k) {
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), rpx: Math.exp(lerp(Math.log(a.rpx), Math.log(b.rpx), k)) };
}
function camZoom(a, b, k) {
  const rpx = Math.exp(lerp(Math.log(a.rpx), Math.log(b.rpx), k));
  const u = Math.abs(1 / b.rpx - 1 / a.rpx) < 1e-9 ? k : (1 / rpx - 1 / a.rpx) / (1 / b.rpx - 1 / a.rpx);
  return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), rpx };
}
function camFly(a, b, k, h = 4) {
  const c = camAt(a, b, k);
  return { ...c, rpx: c.rpx / (1 + h * Math.sin(Math.PI * k)) };
}
const smoother = (k) => { k = clamp01(k); return k * k * k * (k * (6 * k - 15) + 10); };
const glide = (k) => 0.35 * clamp01(k) + 0.65 * smooth(k);
const easeOutQ = (k) => 1 - (1 - clamp01(k) ** 1.3) ** 4;

function gatherFacts(stage) {
  const { data, w } = stage;
  const g = w.grid;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < g.size; i++) {
    if (w.raw.owner[i] < 0) continue;
    const x = g.cx(i), y = g.cy(i);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const land = { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  const css = { w: W / stage.dpr, h: H / stage.dpr };
  const homeRpx = Math.min((css.w * 0.94) / (x1 - x0 + 2 * g.R), (css.h * 0.9) / (y1 - y0 + 2 * g.R)) * g.R;
  const src = new Map(data.sources.map((s) => [s.id, s]));
  const city = (name) => {
    const c = data.cities.find((x) => x.name === name) || data.cities[0];
    return { ...c, x: g.cx(c.cell), y: g.cy(c.cell) };
  };
  return { land, homeRpx, src, city, css };
}

export function buildStoryboard(stage, cfg = CONFIG) {
  const { data } = stage;
  const F = gatherFacts(stage);
  const { land, homeRpx, src } = F;
  const shots = [];
  const shot = (s) => { shots.push(s); return s; };
  const WIDE = { banners: false, resources: false, labels: false };

  const T_ROCK = 3.1, T_NY = 5.8, T_LENS = 9.8, T_IMP = 15.3, T_CITY = 19.9, T_TRADE = 24.6, T_END = 27.4, T_OUT = 30;

  // 1. Título sobre todo el Perú
  shot({
    id: "title", t0: 0, t1: T_ROCK + 0.2,
    render: (t) => [{ view: { ...camAt({ x: land.cx, y: land.cy, rpx: homeRpx * 0.98 }, { x: land.cx + 20, y: land.cy - 10, rpx: homeRpx * 1.1 }, t / 3.3), ...WIDE } }],
    overlay(ctx, t) {
      darken(ctx, W, H, 0.42);
      vignette(ctx, W, H, 0.85);
      titleCard(ctx, W, H, cfg, win(t, -0.5, T_ROCK + 0.15, 0.9, 0.4), clamp01((t + 0.4) / 1.6));
    },
  });

  // 2. Cordillera de los Andes (Cusco / Valle Sagrado)
  const etopo = src.get("etopo"), boundsSrc = src.get("peru_boundaries");
  const cusco = F.city("Cusco");
  const ROCK_T = T_NY - T_ROCK;
  shot({
    id: "andes", t0: T_ROCK, trans: "dip", t1: T_NY,
    render: (t) => [{ view: camAt({ x: cusco.x - 60, y: cusco.y - 50, rpx: 26 }, { x: cusco.x + 20, y: cusco.y + 10, rpx: 34 }, glide(t / (ROCK_T + 0.2))) }],
    overlay(ctx, t) {
      caption(ctx, W, H, {
        kicker: "Terreno",
        title: "Cada hexágono con datos reales",
        sub: "Andes, Amazonía y costa desértica a 12 km de resolución",
        source: [etopo, boundsSrc].filter(Boolean).map(srcLabel).join(" · "),
      }, win(t, 0.45, ROCK_T + 0.05, 0.45, 0.3), clamp01((t - 0.45) / 0.6));
    },
  });

  // 3. Ciudades: Lima Metropolitana y Callao
  const lima = F.city("Lima");
  const NY_T = T_LENS - T_NY;
  const nyEnd = { x: lima.x - 30, y: lima.y + 5, rpx: 52 };
  const NY_DRIFT = -12;
  const nyCam = (t) => { const c = camAt({ x: lima.x + 80, y: lima.y - 80, rpx: 24 }, nyEnd, smooth(t / NY_T)); return { ...c, x: c.x + NY_DRIFT * (t - NY_T) }; };
  shot({
    id: "cities", t0: T_NY, trans: "punch", t1: T_LENS,
    render: (t) => [{ view: nyCam(t) }],
    overlay(ctx, t, frame) {
      const a = win(t, 1.3, NY_T - 0.05, 0.5, 0.4);
      const [sx, sy] = frame.toScreen(lima.x, lima.y);
      pulseRing(ctx, sx, sy, frame.cam.scale * stage.R * 1.5 * 2.2, a, t);
      caption(ctx, W, H, {
        kicker: "Ciudades",
        title: lima.name,
        sub: `${money(lima.gdp)} PBI · ${people(lima.population)} hab.`,
        source: `${data.nation.gdp_vintage || "INEI PBI"} · ${data.nation.vintage}`,
      }, a, clamp01((t - 1.3) / 0.6));
    },
  });

  // 4. Lentes temáticos
  const LENSES = ["poverty", "bachelors", "density"].map((id) => stage.lensById.get(id)).filter(Boolean);
  const nLens = data.lenses.lenses.length;
  const lensFmt = stage.formatLensTick;
  const legendOf = (l) => ({ name: l.name, unit: l.unit, icon: l.icon, ramp: l.ramp, lo: lensFmt(l, 0, 0), hi: lensFmt(l, 1, 4) });
  const LENS_T = T_IMP - T_LENS, ZO = 1.0, LD = (LENS_T - ZO) / LENSES.length, LK = 0.4;
  const lensA = { x: land.cx - 40, y: land.cy + 10, rpx: homeRpx * 1.04 };
  const lensB = { x: land.cx + 40, y: land.cy - 10, rpx: homeRpx * 1.12 };
  const lensCam = (t) => {
    if (t >= ZO) return camAt(lensA, lensB, clamp01((t - ZO) / (LENS_T - ZO)));
    const c = camZoom(nyEnd, lensA, smooth(t / ZO));
    return { ...c, x: c.x + NY_DRIFT * t * (1 - smooth(t / ZO)) };
  };
  const lensAt = (t) => {
    const u = Math.max(0, t - ZO);
    const i = Math.min(LENSES.length - 1, Math.floor(u / LD));
    const k = i < LENSES.length - 1 ? smooth((u - (i + 1) * LD + LK) / LK) : 0;
    return { i, k };
  };
  shot({
    id: "lenses", t0: T_LENS, trans: "cut", t1: T_IMP,
    cues: LENSES.map((l, i) => (i === 0 ? 0.1 : ZO + i * LD - LK / 2)),
    render(t) {
      const cam = lensCam(t);
      if (t < ZO) {
        return [
          { view: { ...cam } },
          { view: { ...cam, lens: LENSES[0].id, ...WIDE }, alpha: smooth((t - 0.1) / (ZO - 0.2)) },
        ];
      }
      const { i, k } = lensAt(t);
      const out = [{ view: { ...cam, lens: LENSES[i].id, ...WIDE } }];
      if (k > 0) out.push({ view: { ...cam, lens: LENSES[i + 1].id, ...WIDE }, alpha: k });
      return out;
    },
    overlay(ctx, t) {
      vignette(ctx, W, H, 0.5 * smooth(t / ZO));
      const { i, k } = lensAt(t);
      const whole = win(t, 0.55, LENS_T - 0.05, 0.4, 0.3);
      lensLegend(ctx, W, H, legendOf(LENSES[i]), whole, k > 0 ? legendOf(LENSES[i + 1]) : null, k);
      const cur = LENSES[k > 0.5 ? i + 1 : i];
      const s = src.get(cur.source);
      caption(ctx, W, H, {
        kicker: "Lentes",
        title: `${nLens} lentes provinciales`,
        sub: "Pobreza, ingresos, educación, internet, lengua originaria, SINPAD…",
        source: `${cur.name}: ${s ? srcLabel(s) : cur.source}`,
      }, whole, clamp01((t - 0.55) / 0.6));
    },
  });

  // 5. Infraestructura, defensa y maravillas sobre Lima/Costa Central
  const infra = data.infrastructure, mil = data.military, won = data.wonders;
  const IMP_T = T_CITY - T_IMP, ZI = 1.0;
  const STAGES = [
    { at: 1.05, on: { roads: true, rail: true }, chip: { icon: "t-road", label: "Red Vial Nacional y ferrocarriles", sub: stripParen(infra.vintage?.roads || "MTC / Natural Earth") } },
    { at: 1.75, on: { hubs: true }, chip: { icon: "d-harbor", label: `${infra.ports.length} puertos · ${infra.airports.length} aeropuertos`, sub: "APN y OSITRAN" } },
    { at: 2.45, on: { military: true }, chip: { icon: "m-army", label: `${int(mil.installations.length)} sedes militares`, sub: stripParen(mil.vintage?.installations || "FF.AA. del Perú") } },
    { at: 3.15, on: { wonders: true }, chip: { icon: "w-landmark", label: `${won.wonders.length} maravillas del Perú`, sub: "SERNANP, MINCETUR y SUNEDU" } },
  ];
  const layersAt = (n) => Object.assign({}, ...STAGES.slice(0, n).map((s) => s.on));
  const pugA = { x: lima.x - 20, y: lima.y - 10, rpx: 46 };
  const pugB = { x: lima.x - 10, y: lima.y - 20, rpx: 56 };
  const lensV = { x: (lensB.x - lensA.x) / (LENS_T - ZO), y: (lensB.y - lensA.y) / (LENS_T - ZO) };
  const impCam = (t) => {
    if (t >= ZI) return camAt(pugA, pugB, glide((t - ZI) / (IMP_T - ZI + 0.35)));
    const c = camZoom(lensB, pugA, smooth(t / ZI)), d = t * (1 - smooth(t / ZI));
    return { ...c, x: c.x + lensV.x * d, y: c.y + lensV.y * d };
  };
  shot({
    id: "improvements", t0: T_IMP, trans: "cut", t1: T_CITY,
    cues: STAGES.map((s) => s.at + 0.1),
    render(t) {
      const cam = impCam(t);
      if (t < ZI) {
        return [
          { view: { ...cam } },
          { view: { ...cam, lens: LENSES[LENSES.length - 1].id, ...WIDE }, alpha: 1 - smooth((t - 0.15) / (ZI - 0.3)) },
        ];
      }
      let n = 0;
      while (n < STAGES.length && t >= STAGES[n].at + 0.45) n++;
      const out = [{ view: { ...cam, layers: layersAt(n) } }];
      if (n < STAGES.length && t > STAGES[n].at) out.push({ view: { ...cam, layers: layersAt(n + 1) }, alpha: smooth((t - STAGES[n].at) / 0.45) });
      return out;
    },
    overlay(ctx, t) {
      vignette(ctx, W, H, 0.5 * (1 - smooth(t / (ZI * 0.8))));
      let y = 70;
      for (const s of STAGES) {
        const a = win(t, s.at, IMP_T - 0.1, 0.4, 0.3);
        if (a > 0) chip(ctx, 80 - (1 - smooth((t - s.at) / 0.4)) * 40, y, s.chip, a, { size: 0.9 });
        y += 86;
      }
    },
  });

  // 6. Vista de Ciudad: Arequipa
  const sj = F.city("Arequipa");
  const cv = stage.cityView(sj.id);
  const bb = cv.model.bbox;
  const cit = data.citizens.cities[sj.id];
  const natW = data.citizens.national.workforce;
  const groups = data.citizens.groups.workforce;
  const figs = (fig) => groups.flatMap((g) => Array(fig[g.key] || 0).fill(g.key));
  const spec = (cit.specialists || []).find((s) => s.row === "workforce" && s.ratio > 1) || null;
  const specLabel = spec ? groups.find((g) => g.key === spec.key)?.label : null;
  const badge = badgeOf(data.districts, sj.id);
  const dists = cityDistricts(data.districts, data.military, sj.id).slice(0, 2);
  const lqLine = (d) => {
    if (d.lq == null) return d.subName || "";
    const lead = d.subName ? ` · líder en ${d.subName.toLowerCase()}` : "";
    return `${d.lower_bound ? "≥" : ""}${d.lq.toFixed(1)}× el promedio nacional${lead}`;
  };
  const panel = {
    name: sj.name,
    full: sj.full,
    badge: badge && badge.district ? { label: badge.label, color: badge.color, icon: badge.icon } : null,
    stats: [[peopleShort(sj.population), "habitantes"], [moneyShort(sj.gdp), `PBI ${sj.gdp_year}`], [`$${int(sj.median_income)}`, "ingreso anual"]],
    highlight: spec ? `Destaca: ${specLabel.toLowerCase()}` : "",
    rows: [
      { label: sj.name, figs: figs(cit.workforce.figures), hi: spec?.key, ratio: spec ? `${oneIn(spec.share)} ocupados` : "" },
      { label: "Perú", figs: figs(natW.figures), hi: spec?.key, ratio: spec ? `${oneIn(spec.national)} ocupados` : "" },
    ],
    districts: dists.map((d) => ({ icon: d.icon, name: d.name, line: lqLine(d) })),
    source: `${data.citizens.vintage} · ${data.districts.vintage}`,
  };
  const CITY_T = T_TRADE - T_CITY, FLY = 1.7, CITY_IN = 0.6;
  const mapW = (W - 820 - 56) / stage.dpr;
  const fitRpx = Math.min((mapW * 0.8) / Math.max(40, bb.x1 - bb.x0), (F.css.h * 0.7) / Math.max(40, bb.y1 - bb.y0)) * stage.R;
  const cityCam = (rpx) => {
    const s = rpx / stage.R;
    const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
    return { x: cx + (F.css.w / 2 - mapW / 2) / s, y: cy + 10 / s, rpx };
  };
  const sjA = cityCam(Math.min(72, fitRpx * 0.95)), sjB = cityCam(Math.min(80, fitRpx * 1.07));
  shot({
    id: "city", t0: T_CITY, trans: "cut", t1: T_TRADE,
    cues: [FLY - CITY_IN, 1.3],
    render(t) {
      const cam = t < FLY ? camFly(impCam(IMP_T), sjA, smoother(t / FLY), 3) : camAt(sjA, sjB, ((u) => 0.5 * u + 0.5 * u * u)(clamp01((t - FLY) / (CITY_T - FLY))));
      const on = smooth((t - (FLY - CITY_IN)) / CITY_IN);
      const cityAnimMs = Math.max(0, t - (FLY - CITY_IN)) * 1000;
      if (on >= 1) return [{ view: { ...cam, city: sj.id, cityAnimMs } }];
      const out = [{ view: { ...cam, layers: layersAt(STAGES.length) } }];
      const noNames = smooth(t / 0.35);
      if (noNames < 1) out.push({ view: { ...cam, labels: false, layers: layersAt(STAGES.length) }, alpha: noNames });
      else out[0].view.labels = false;
      const plain = smooth((t - 0.1) / 0.6);
      if (plain > 0) out.push({ view: { ...cam, labels: false }, alpha: plain });
      if (on > 0) out.push({ view: { ...cam, city: sj.id, cityAnimMs }, alpha: on });
      return out;
    },
    overlay(ctx, t) {
      cityPanel(ctx, W, H, panel, win(t, 1.3, CITY_T + 0.3, 0.3, 0.4), clamp01((t - 1.3) / 0.7), t - 0.8);
    },
  });

  // 7. Rutas comerciales
  const trade = data.trade;
  const zone = new Map(trade.zones.map((z) => [z.id, z]));
  const top = trade.routes[0];
  const topRt = stage.model.routes.find((r) => r.route === top);
  const TRADE_T = T_END - T_TRADE;
  const za = zone.get(top.a), zb = zone.get(top.b);
  const topMid = topRt ? { x: (topRt.pts[0] + topRt.pts[topRt.pts.length - 2]) / 2, y: (topRt.pts[1] + topRt.pts[topRt.pts.length - 1]) / 2 } : { x: lima.x, y: lima.y };
  const trA = { x: topMid.x - 20, y: topMid.y + 15, rpx: 26 };
  const endB = { x: land.cx + 10, y: land.cy + 5, rpx: homeRpx * 0.98 };
  const tradeCam = (t) => {
    const k = easeOutQ(t / (T_OUT - T_TRADE)), z = camZoom(trA, endB, k), l = camAt(trA, endB, k);
    return { x: (z.x + l.x) / 2, y: (z.y + l.y) / 2, rpx: z.rpx };
  };
  shot({
    id: "trade", t0: T_TRADE, trans: "punch", t1: T_END,
    render(t) {
      const cam = tradeCam(t);
      return [
        { view: { ...cam, resources: false } },
        { view: { ...cam, resources: false, layers: { trade: true } }, alpha: smooth((t - 0.1) / 0.4) },
        { view: { ...cam, ...WIDE, layers: { trade: true } }, alpha: smooth((t - 0.6) / 0.45) },
      ];
    },
    overlay(ctx, t, frame) {
      caravans(ctx, stage.model.routes, frame.toScreen, t, smooth((t - 0.4) / 0.5), 1.3);
      routeGlow(ctx, topRt, frame.toScreen, t, win(t, 0.25, TRADE_T, 0.4, 0.4), 7);
      caption(ctx, W, H, {
        kicker: "Rutas comerciales",
        title: `${trade.routes.length} grandes corredores logísticos`,
        sub: `#1: ${za?.short} ↔ ${zb?.short} (${int(top.dist_km)} km), ${money(top.value_musd * 1e6)} al año`,
        source: `${trade.vintage}`,
      }, win(t, 0.45, TRADE_T - 0.05, 0.45, 0.3), clamp01((t - 0.45) / 0.6));
    },
  });

  // 8. Cierre
  shot({
    id: "end", t0: T_END, trans: "cut", t1: T_OUT,
    render(t) {
      const cam = tradeCam(TRADE_T + t);
      return [
        { view: { ...cam, ...WIDE } },
        { view: { ...cam, ...WIDE, layers: { trade: true } }, alpha: 1 - 0.6 * smooth(t / 0.9) },
      ];
    },
    overlay(ctx, t, frame) {
      caravans(ctx, stage.model.routes, frame.toScreen, t + TRADE_T, 1 - 0.7 * smooth(t / 0.7), 1.3);
      darken(ctx, W, H, 0.55 * smooth(t / 0.5));
      vignette(ctx, W, H, 0.9 * smooth(t / 0.5));
      endCard(ctx, W, H, cfg, { facts: `${data.sources.length} fuentes públicas oficiales · cada cifra trazable`, fallback: cfg.cta },
        smooth((t - 0.1) / 0.5), clamp01((t - 0.15) / 0.6));
    },
  });

  const duration = T_OUT;
  return { shots, duration, fps: FPS, frames: Math.round(duration * FPS), fade: FADE, cfg, facts: F, panel };
}

const DIP = 0.6, PUNCH = 0.4;
export const fadeOf = (sb, s) => s.fade ?? ({ dip: DIP, punch: PUNCH, cut: 0 }[s.trans] ?? sb.fade);
export function activeShots(sb, T) {
  const out = [];
  sb.shots.forEach((s, i) => {
    const next = sb.shots[i + 1];
    const end = next ? Math.max(s.t1, next.t0 + fadeOf(sb, next)) : s.t1;
    if (T < s.t0 || T >= end) return;
    const f = fadeOf(sb, s);
    const alpha = i === 0 || f <= 0 ? 1 : clamp01((T - s.t0) / f);
    out.push({ shot: s, alpha: s.trans ? alpha : smooth(alpha), sec: T - s.t0 });
  });
  let k = out.length - 1;
  while (k > 0 && out[k].alpha < 1) k--;
  return out.slice(k);
}
