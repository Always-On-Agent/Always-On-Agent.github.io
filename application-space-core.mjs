import { DOMAINS, HORIZONS } from "./research-core.mjs";

export const PARTICIPANTS = ["Individual", "Group", "Public"];
export const MEASURED_HORIZONS = HORIZONS.filter(value => value !== "Unmeasured");
export const PLANES = [
  { id: "domain-people", title: "Domain × People", x: "domain", y: "participant", columns: DOMAINS, rows: PARTICIPANTS },
  { id: "domain-time", title: "Domain × Horizon", x: "domain", y: "horizon", columns: DOMAINS, rows: HORIZONS },
  { id: "people-time", title: "People × Horizon", x: "participant", y: "horizon", columns: PARTICIPANTS, rows: HORIZONS }
];
export const INITIAL_CAMERA = { yaw: -0.56, tilt: 0.56, zoom: 1 };
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function placements(cases) {
  return cases.flatMap(item => item.domains.flatMap(domain => item.participants.map(participant => ({ id: item.id, domain, participant, horizon: item.horizon }))));
}

export function clusterPlacements(cases) {
  const groups = new Map();
  for (const point of placements(cases)) {
    if (point.horizon === "Unmeasured") continue;
    const key = JSON.stringify([point.domain, point.participant, point.horizon]);
    if (!groups.has(key)) groups.set(key, { key, ...point, ids: new Set() });
    groups.get(key).ids.add(point.id);
  }
  return [...groups.values()].map(group => ({ ...group, ids: [...group.ids] }));
}

export function projectPlane(cases, plane) {
  const cells = new Map();
  for (const y of plane.rows) for (const x of plane.columns) cells.set(JSON.stringify([x, y]), { x, y, ids: new Set() });
  for (const point of placements(cases)) cells.get(JSON.stringify([point[plane.x], point[plane.y]])).ids.add(point.id);
  return [...cells.values()].map(cell => ({ ...cell, ids: [...cell.ids] }));
}

export function worldPoint(point) {
  return { x: (DOMAINS.indexOf(point.domain) - 1) * 155, y: (PARTICIPANTS.indexOf(point.participant) - 1) * 125, z: (MEASURED_HORIZONS.indexOf(point.horizon) - 1) * 115 };
}

export function projectPoint({ x, y, z }, camera) {
  const rx = x * Math.cos(camera.yaw) - y * Math.sin(camera.yaw);
  const ry = x * Math.sin(camera.yaw) + y * Math.cos(camera.yaw);
  return { x: rx, y: ry * Math.sin(camera.tilt) - z * Math.cos(camera.tilt), depth: ry * Math.cos(camera.tilt) + z * Math.sin(camera.tilt) };
}

export function fitProjection(camera, width = 780, height = 530) {
  const corners = [-265, 265].flatMap(x => [-205, 205].flatMap(y => [-145, 150].map(z => projectPoint({ x, y, z }, camera))));
  const xs = corners.map(point => point.x), ys = corners.map(point => point.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min((width - 100) / (maxX - minX), (height - 90) / (maxY - minY)) * camera.zoom;
  return point => { const p = projectPoint(point, camera); return { x: width / 2 + (p.x - (minX + maxX) / 2) * scale, y: height / 2 + (p.y - (minY + maxY) / 2) * scale, depth: p.depth }; };
}

export function dragCamera(start, dx, dy) {
  return { yaw: start.yaw + dx * 0.007, tilt: clamp(start.tilt - dy * 0.005, 0.26, 1.16), zoom: start.zoom };
}
