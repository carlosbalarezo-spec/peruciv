import { add, get, nonnegative } from "./data.js";

// Dijkstra sobre enlaces dirigidos. Un enlace bidireccional declara both.
export function routeMinutes(edges, from, to) {
  const pending = new Map([[from, 0]]);
  const visited = new Set();
  while (pending.size) {
    let current;
    let distance = Infinity;
    for (const [node, minutes] of pending) {
      if (minutes < distance) {
        current = node;
        distance = minutes;
      }
    }
    if (current === to) return distance;
    pending.delete(current);
    visited.add(current);
    for (const edge of Object.values(edges)) {
      if (edge.closed) continue;
      const next = edge.from === current ? edge.to : edge.both && edge.to === current ? edge.from : undefined;
      if (next === undefined || visited.has(next)) continue;
      const minutes = add(distance, nonnegative(edge.minutes));
      if (minutes < (pending.get(next) ?? Infinity)) pending.set(next, minutes);
    }
  }
  return null;
}

export function available(state, nodeId) {
  const node = get(state.nodes, nodeId);
  if (!node || [node.capacity, node.protectedDemand, node.priorCommitments].includes(null)) return null;
  const reservations = state.reservations.filter(item => item.nodeId === nodeId);
  return add(node.capacity, -node.protectedDemand, -node.priorCommitments,
    ...reservations.map(item => -item.amount));
}
