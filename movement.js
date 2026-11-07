// Radians wrap at +/- PI. Always turn through the shortest angle, otherwise a
// tiny change across that boundary would send the character almost a full turn.
export function angleDifference(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function turnTowards(from, to, delta, radiansPerSecond = 3.5) {
  const difference = angleDifference(from, to);
  const limit = Math.max(0, delta) * radiansPerSecond;
  return from + Math.max(-limit, Math.min(limit, difference));
}

// Exponential damping gives the camera the same response at different frame
// rates. The character turns first; the camera eases into her new heading.
export function dampHeading(from, to, delta, responsiveness = 5) {
  return from + angleDifference(from, to) * (1 - Math.exp(-responsiveness * delta));
}

export function zoomDistance(preferredDistance, factor, minimum = 2, maximum = 132) {
  return Math.max(minimum, Math.min(maximum, preferredDistance * factor));
}

// Ship visits currently schedule movement and a quiet pause only. No memories
// or companion knowledge are passed through this controller. A future visit
// handler can add information transfer at the explicit arrival boundary.
export function createShipVisitSchedule({ interval = 360, rest = 20, retry = 30 } = {}) {
  let phase = "exploring", nextVisit = interval, restUntil = 0;
  return {
    get phase() { return phase; },
    due: (elapsed) => phase === "exploring" && elapsed >= nextVisit,
    begin() { phase = "returning"; },
    arrive(elapsed) { phase = "resting"; restUntil = elapsed + rest; nextVisit = restUntil + interval; },
    update(elapsed) { if (phase === "resting" && elapsed >= restUntil) phase = "exploring"; },
    cancel(elapsed, failed = false) { phase = "exploring"; nextVisit = elapsed + (failed ? retry : interval); },
  };
}

// Prefer the original spawn, then nearby ground if a car/person occupies it.
// The caller supplies world checks so this recovery logic is testable without WebGL.
export function findSafeReturn(home, isSafe) {
  if (isSafe(home)) return { x: home.x, z: home.z };
  for (let radius = 0.5; radius <= 12; radius += 0.5) {
    for (let i = 0; i < 32; i++) {
      const angle = i / 32 * Math.PI * 2;
      const candidate = { x: home.x + Math.sin(angle) * radius, z: home.z + Math.cos(angle) * radius };
      if (isSafe(candidate)) return candidate;
    }
  }
  return null;
}

// Check the entire movement segment against a vehicle's footprint, expanded by
// the walker's radius. Transform into vehicle-local coordinates so the same
// test works for both lanes, the end turns, and the longer bus.
export function intersectsVehicle(start, end, vehicle, radius = 0.55) {
  const c = Math.cos(vehicle.angle), s = Math.sin(vehicle.angle);
  const local = (point) => {
    const dx = point.x - vehicle.x, dz = point.z - vehicle.z;
    return { x: dx * c - dz * s, z: dx * s + dz * c };
  };
  const a = local(start), b = local(end);
  let enter = 0, exit = 1;
  for (const [axis, extent] of [["x", vehicle.width / 2 + radius], ["z", vehicle.length / 2 + radius]]) {
    const direction = b[axis] - a[axis];
    if (Math.abs(direction) < 1e-9) {
      if (Math.abs(a[axis]) > extent) return false;
      continue;
    }
    const t1 = (-extent - a[axis]) / direction, t2 = (extent - a[axis]) / direction;
    enter = Math.max(enter, Math.min(t1, t2));
    exit = Math.min(exit, Math.max(t1, t2));
    if (enter > exit) return false;
  }
  return true;
}

export function vehicleSweepBlocked(from, to, walkers) {
  // Include intermediate poses: checking just the final position can miss a
  // walker during a long frame or when a vehicle rotates at a loop corner.
  const turn = angleDifference(from.angle, to.angle);
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.1), Math.ceil(Math.abs(turn) / 0.1));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const pose = { ...from, x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t, angle: from.angle + turn * t };
    if (walkers.some((walker) => intersectsVehicle(walker, walker, pose))) return true;
  }
  return false;
}

export function walkerBlockedByVehicle(start, end, vehicle) {
  if (!intersectsVehicle(start, end, vehicle)) return false;
  if (!intersectsVehicle(start, start, vehicle)) return true;
  // A walker caught in the clearance buffer must be allowed to step OUT. Still
  // forbid crossing through the car to reach the other side of that buffer.
  const clearance = (point) => {
    const dx = point.x - vehicle.x, dz = point.z - vehicle.z;
    return Math.max(Math.abs(dx * Math.cos(vehicle.angle) - dz * Math.sin(vehicle.angle)) - vehicle.width / 2,
      Math.abs(dx * Math.sin(vehicle.angle) + dz * Math.cos(vehicle.angle)) - vehicle.length / 2);
  };
  const initial = clearance(start);
  if (clearance(end) <= initial + 1e-8) return true;
  const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.z - start.z) / 0.1));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (clearance({ x: start.x + (end.x - start.x) * t, z: start.z + (end.z - start.z) * t }) < initial - 1e-8) return true;
  }
  return false;
}
