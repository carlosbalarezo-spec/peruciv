// Capa visual sobre el mapa hexagonal para corredores, nodos y bloqueos del escenario activo.

function cellXY(w, cell) {
  return [w.grid.cx(cell), w.grid.cy(cell)];
}

function drawEdge(ctx, cam, w, edge, dyn, idx) {
  const cells = edge.cells || [];
  if (cells.length < 2) return;
  ctx.save();
  ctx.beginPath();
  cells.forEach((c, k) => {
    const [sx, sy] = cam.toScreen(...cellXY(w, c));
    if (k === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  const closed = !!dyn?.closed;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = closed ? 4 : 5;
  ctx.strokeStyle = closed ? "#e63946" : "#4cc9f0";
  if (closed) ctx.setLineDash([7, 6]);
  ctx.stroke();
  const mid = cells[Math.floor(cells.length / 2)];
  const [mx, my] = cam.toScreen(...cellXY(w, mid));
  const dy = idx % 2 ? 12 : -12;
  ctx.setLineDash([]);
  ctx.font = "600 11px -apple-system, system-ui, sans-serif";
  const label = `${closed ? "⛔ " : ""}${dyn?.minutes ?? edge.minutes} min`;
  const tw = ctx.measureText(label).width + 10;
  ctx.fillStyle = "rgba(12, 20, 30, 0.88)";
  ctx.fillRect(mx - tw / 2, my + dy - 8, tw, 16);
  ctx.fillStyle = closed ? "#ff9b9b" : "#ecd08e";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, mx, my + dy);
  ctx.restore();
}

function drawSitePin(ctx, cam, w, site, hasAccess) {
  if (site.cell == null) return;
  const [sx, sy] = cam.toScreen(...cellXY(w, site.cell));
  ctx.save();
  ctx.beginPath();
  ctx.arc(sx, sy, 9, 0, Math.PI * 2);
  ctx.fillStyle = hasAccess ? "#2a9d8f" : "#e76f51";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#fff4d6";
  ctx.stroke();
  ctx.restore();
}

export function createGameOverlay(getSession) {
  return {
    id: "game-corridors",
    z: 50,
    space: "screen",
    draw(ctx, cam, app) {
      const s = getSession();
      const w = app?.w;
      if (!s?.active || !s.scenario || !s.state || !w?.grid) return;
      const prefix = s.scenario.id.startsWith("ica") ? "edge-ica" : "edge-aqp";
      const edges = (s.scenario.edges || []).filter((e) => e.id.startsWith(prefix));
      edges.forEach((edge, idx) => drawEdge(ctx, cam, w, edge, s.state.edges?.[edge.id], idx));
      for (const site of s.scenario.sites || []) {
        drawSitePin(ctx, cam, w, site, !!s.state.access?.[site.id]);
      }
    },
  };
}
