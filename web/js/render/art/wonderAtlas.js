// Row-major cells in the transparent atlas. Keep this order independent of visitor rankings.
const cells = [
  "mincetur-machu-picchu", "mincetur-ollantaytambo", "mincetur-moray", "mincetur-sacsayhuam",
  "mincetur-kuelap", "mincetur-nasca", "mincetur-chan-chan", "mincetur-caral",
  "mincetur-sipan", "mincetur-pachacamac", "mincetur-chavin", "mincetur-colca",
  "sernanp-paracas", "sernanp-islas", "sernanp-huascaran", "sernanp-tingo-maria",
  "sernanp-nor-yauyos", "sernanp-tambopata", "sernanp-lachay", "sernanp-pacaya",
  "sernanp-manu", "sunedu-001", "sunedu-008", "sunedu-014",
  "sunedu-006", "sunedu-007", "sunedu-005", "sunedu-003",
  "sunedu-004", "sunedu-013", "sunedu-011",
];

const columns = 8;
const indexById = new Map(cells.map((id, index) => [id, index]));
let atlas;
let loading;

export function loadWonderAtlas() {
  if (!loading) {
    const image = new Image();
    image.src = new URL("../../../assets/wonders/peru.webp", import.meta.url).href;
    loading = image.decode().then(() => { atlas = image; }).catch((err) => {
      console.warn("Maravillas: no se pudo cargar la ilustración del mapa.", err);
    });
  }
  return loading;
}

export function wonderAtlasCell(id) {
  return atlas ? indexById.get(id) : undefined;
}

export function paintWonderCell(g, index) {
  const side = atlas.naturalWidth / columns;
  g.imageSmoothingQuality = "high";
  g.drawImage(atlas, (index % columns) * side, Math.floor(index / columns) * side, side, side,
    -1.1, -1.4, 2.2, 2.2);
}
