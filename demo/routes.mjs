const CIRCLES = [[-6, 3, 1.65], [6, 3, 1.65], [0, -7.4, 2.5]];

export function blocked(x, z) {
  return Math.abs(x) > 16.3 || z > 14 || z < -14
    || (Math.abs(x) > 5.5 && z < -6.5)
    || CIRCLES.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r);
}

function crossesBuilding(a, b, side) {
  // Clip the segment against x > 5.5 (or x < -5.5) and z < -6.5.
  let lo = 0, hi = 1;
  for (const [origin, delta, bound] of [
    [side * a.x, side * (b.x - a.x), 5.5],
    [-a.z, -(b.z - a.z), 6.5]
  ]) {
    if (Math.abs(delta) < 1e-9) { if (origin <= bound) return false; }
    else if (delta > 0) lo = Math.max(lo, (bound - origin) / delta);
    else hi = Math.min(hi, (bound - origin) / delta);
  }
  return lo < hi && hi > 0 && lo < 1;
}

export function canWalkSegment(a, b) {
  if (blocked(a.x, a.z) || blocked(b.x, b.z)
    || crossesBuilding(a, b, 1) || crossesBuilding(a, b, -1)) return false;
  const dx = b.x - a.x, dz = b.z - a.z, length2 = dx * dx + dz * dz;
  return CIRCLES.every(([x, z, radius]) => {
    const t = length2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / length2)) : 0;
    return Math.hypot(a.x + t * dx - x, a.z + t * dz - z) >= radius;
  });
}

// Fixed navigation points keep this tiny world legible without a per-frame pathfinder.
// The south corridor clears both tree planters, unlike the old z = 3.8 route.
const WAYPOINTS = [
  ...[-9, -3, 0, 3, 9].map(x => ({x, z: 5.3})),
  ...[-9, -3, 0, 3, 9].map(x => ({x, z: .5})),
  ...Array.from({length: 8}, (_, i) => ({
    x: Math.cos(i * Math.PI / 4) * 3.3,
    z: -7.4 + Math.sin(i * Math.PI / 4) * 3.3
  }))
];

export function planRoute(start, destination) {
  if (blocked(start.x, start.z) || blocked(destination.x, destination.z)) return [];
  const target = {x: destination.x, z: destination.z};
  if (canWalkSegment(start, target)) return [target];
  const points = [{x: start.x, z: start.z}, target, ...WAYPOINTS];
  const distances = points.map(() => Infinity), previous = points.map(() => -1), visited = new Set();
  distances[0] = 0;
  while (visited.size < points.length) {
    let current = -1;
    for (let i = 0; i < points.length; i++) {
      if (!visited.has(i) && (current < 0 || distances[i] < distances[current])) current = i;
    }
    if (current < 0 || !Number.isFinite(distances[current])) return [];
    if (current === 1) {
      const route = [];
      for (let at = 1; at !== 0; at = previous[at]) route.unshift(points[at]);
      return route;
    }
    visited.add(current);
    for (let next = 0; next < points.length; next++) {
      if (visited.has(next) || !canWalkSegment(points[current], points[next])) continue;
      const candidate = distances[current] + Math.hypot(points[next].x - points[current].x, points[next].z - points[current].z);
      if (candidate < distances[next]) { distances[next] = candidate; previous[next] = current; }
    }
  }
  return [];
}
