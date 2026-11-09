// A* on a two-metre grid is deliberately separate from rendering. It works in
// irregular countryside too; diagonal corner-cutting is forbidden at buildings.
export function createNavigation(layout, step = 2) {
  const edge = 104;
  const size = edge * 2 / step + 1;
  const nodes = new Map();
  const key = (x, z) => `${x},${z}`;
  for (let x = -edge; x <= edge; x += step) for (let z = -edge; z <= edge; z += step) {
    // Keep every grid position: objects can be removed or temporarily added for
    // detours. Walkability is evaluated when planning, not frozen at startup.
    nodes.set(key(x, z), { x, z });
  }
  function nearest(point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return null;
    let result = null;
    let distance = Infinity;
    for (const node of nodes.values()) {
      if (!layout.isWalkable(node.x, node.z)) continue;
      const d = (node.x - point.x) ** 2 + (node.z - point.z) ** 2;
      if (d < distance) { distance = d; result = node; }
    }
    return result;
  }
  function segmentClear(a, b) {
    // Sampling alone can miss a short diagonal clip at a fence corner. A later
    // movement step then lands inside its clearance and every new route fails.
    const clearance = layout.navigationClearance;
    let escaping = false;
    if (Number.isFinite(clearance)) {
      for (const obstacle of layout.obstacles) {
        const hx = obstacle.width / 2, hz = obstacle.depth / 2;
        const ax = a.x - obstacle.x, az = a.z - obstacle.z;
        const dx = b.x - a.x, dz = b.z - a.z;
        const gapX = Math.abs(ax) - hx, gapZ = Math.abs(az) - hz;
        if (gapX < clearance && gapZ < clearance) {
          // Permit an actor already in a safety margin to step outward, never
          // deeper into it or through the physical fence/building.
          const gap = Math.max(gapX, gapZ);
          const outward = (gapX >= gapZ && Math.sign(ax) * dx > 1e-9)
            || (gapZ >= gapX && Math.sign(az) * dz > 1e-9);
          if (gap < 0 || !outward) return false;
          escaping = true;
          continue;
        }
        let enter = 0, exit = 1;
        for (const [origin, direction, extent] of [[ax, dx, hx + clearance], [az, dz, hz + clearance]]) {
          if (Math.abs(direction) < 1e-12) {
            if (Math.abs(origin) >= extent) { enter = 1; exit = 0; break; }
          } else {
            const t1 = (-extent - origin) / direction, t2 = (extent - origin) / direction;
            enter = Math.max(enter, Math.min(t1, t2)); exit = Math.min(exit, Math.max(t1, t2));
          }
        }
        if (enter < exit) return false;
      }
    }
    const count = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.35);
    for (let i = 0; i <= count; i++) {
      const t = count ? i / count : 0;
      if (!layout.isWalkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, escaping ? 0 : undefined)) return false;
    }
    return true;
  }
  function route(start, end) {
    if (![start?.x, start?.z, end?.x, end?.z].every(Number.isFinite)) return [];
    function visibleAnchors(point) {
      const result = [];
      const cx = Math.round(point.x / step) * step, cz = Math.round(point.z / step) * step;
      for (let dx = -step * 3; dx <= step * 3; dx += step) for (let dz = -step * 3; dz <= step * 3; dz += step) {
        const node = nodes.get(key(cx + dx, cz + dz));
        if (node && segmentClear(point, node)) result.push(node);
      }
      return result.sort((a, b) => Math.hypot(a.x - point.x, a.z - point.z) - Math.hypot(b.x - point.x, b.z - point.z)).slice(0, 8);
    }
    const starts = visibleAnchors(start);
    if (!starts.length) return [];
    // Connect to several visible grid points, not just the closest one on the
    // wrong side of a fence/bin. Blocked destinations use nearby safe approaches.
    let goals = layout.isWalkable(end.x, end.z) ? visibleAnchors(end) : [];
    if (!goals.length) goals = [...nodes.values()].filter((node) => layout.isWalkable(node.x, node.z)).sort((a, b) => Math.hypot(a.x - end.x, a.z - end.z) - Math.hypot(b.x - end.x, b.z - end.z)).slice(0, 8);
    if (!goals.length) return [];
    const goalKeys = new Set(goals.map((node) => key(node.x, node.z)));
    const open = new Map(starts.map((node) => [key(node.x, node.z), node])), previous = new Map();
    const cost = new Map(starts.map((node) => [key(node.x, node.z), Math.hypot(node.x - start.x, node.z - start.z)]));
    const closed = new Set();
    while (open.size && closed.size < size * size) {
      let current, currentKey, best = Infinity;
      for (const [id, node] of open) {
        const score = cost.get(id) + Math.min(...goals.map((goal) => Math.hypot(node.x - goal.x, node.z - goal.z)));
        if (score < best) { best = score; current = node; currentKey = id; }
      }
      if (goalKeys.has(currentKey)) {
        const path = [current];
        while (previous.has(currentKey)) { currentKey = previous.get(currentKey); path.unshift(nodes.get(currentKey)); }
        // Keep exact accessible destinations, e.g. the point beside a bench.
        if (layout.isWalkable(end.x, end.z) && segmentClear(current, end)) path.push({ x: end.x, z: end.z });
        return path;
      }
      open.delete(currentKey); closed.add(currentKey);
      for (const dx of [-step, 0, step]) for (const dz of [-step, 0, step]) {
        if (!dx && !dz) continue;
        const id = key(current.x + dx, current.z + dz), next = nodes.get(id);
        if (!next || closed.has(id) || !segmentClear(current, next)) continue;
        // Prefer pavements/paths to lawn shortcuts, while still permitting exploration.
        const onRoad = layout.roads.some((r) => Math.abs(next.x - r.x) <= r.width / 2 + 2.5 && Math.abs(next.z - r.z) <= r.depth / 2 + 2.5);
        const inRoad = layout.roads.some((r) => Math.abs(next.x - r.x) < r.width / 2 && Math.abs(next.z - r.z) < r.depth / 2);
        const extra = inRoad ? 1.5 : onRoad ? 1 : 1.2;
        const candidate = cost.get(currentKey) + Math.hypot(dx, dz) * extra;
        if (candidate < (cost.get(id) ?? Infinity)) { cost.set(id, candidate); previous.set(id, currentKey); open.set(id, next); }
      }
    }
    return [];
  }
  function routeAround(start, end, obstacles) {
    const count = layout.obstacles.length;
    try { layout.obstacles.push(...obstacles); return route(start, end); }
    finally { layout.obstacles.length = count; }
  }
  return { route, routeAround, nearest, segmentClear };
}
