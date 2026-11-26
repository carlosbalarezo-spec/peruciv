// Map-art extension: tile improvements (Interstates and major highways, railroads, ports, airports),
// military forts and restricted ground, wonders and protected land, and freight trade routes, each as a static layer
// drawn into the cached map (nothing animates; an idle map draws no frames), with a switch in the "Map" menu.
//
// Data: infrastructure.json, military.json, wonders.json and trade.json (loaded eagerly by main.js right after the
// first frame; app.loadData returns the same promise). A missing file (null) leaves its layers off and their switches
// harmless. Defaults: roads, rail, ports & airports, military and wonders on (roads, rail and hubs only from the region
// view in: see each layer's minRpx), trade routes off.
import { createModel } from "./model.js";
import { makeLayers } from "./layers.js";
import { tips } from "./tips.js";
import { loadWonderAtlas } from "../../render/art/wonderAtlas.js";

const TOGGLES = [
  { id: "roads", label: "Carreteras", icon: "t-road", def: true, title: "Panamericana, Longitudinal de la Sierra, Interoceánica y vías principales", layers: ["roads"] },
  { id: "rail", label: "Ferrocarriles", icon: "t-rail", def: true, title: "Ferrocarril Central, Ferrocarril del Sur y líneas mineras", layers: ["rail"] },
  { id: "hubs", label: "Puertos y aeropuertos", icon: "d-harbor", def: true, title: "Principales puertos marítimos/fluviales y aeropuertos (OSITRAN)", layers: ["hubs"] },
  { id: "military", label: "Defensa", icon: "m-army", def: true, title: "Bases navales, aéreas y cuarteles de las FF.AA. del Perú", layers: ["forts", "restricted", "plates"] },
  { id: "wonders", label: "Maravillas", icon: "w-landmark", def: true, title: "Áreas Naturales Protegidas (SERNANP), sitios arqueológicos (MINCETUR) y universidades (SUNEDU)", layers: ["wonders", "protected", "plates"] },
  { id: "trade", label: "Rutas comerciales", icon: "t-trade", def: false, title: "Los 28 principales corredores logísticos, mineros y agroexportadores del Perú", layers: ["trade"] },
];

export function install(app) {
  const model = createModel(app.w);
  const on = Object.fromEntries(TOGGLES.map((t) => [t.id, t.def]));
  const layers = makeLayers(model, on, { tips, app });
  for (const l of layers) app.registerStaticLayer(l);
  const atlasReady = loadWonderAtlas();

  for (const t of TOGGLES) {
    app.ui.addMapToggle({
      id: t.id, label: t.label, icon: t.icon, title: t.title, default: t.def,
      get: () => on[t.id],
      set: (v) => {
        on[t.id] = !!v;
        app.requestDraw();
      },
    });
  }

  const apply = async (name, data) => {
    if (name === "wonders") await atlasReady;
    model.setData(name, data);
    app.requestDraw();
  };
  for (const name of ["infrastructure", "military", "wonders", "trade"]) {
    if (app.data[name] !== undefined) apply(name, app.data[name]);
    else app.loadData(name).then((d) => apply(name, d), (err) => console.warn(`map layers: ${name} failed to load`, err));
  }

  // For debugging and the gallery: the model and switches.
  app.mapArt = { model, on, layers };
}
