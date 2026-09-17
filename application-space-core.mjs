import { DOMAINS, HORIZONS } from "./research-core.mjs";

export const PARTICIPANTS = ["Individual", "Group", "Public"];
export const PLANES = [
  { id: "domain-people", title: "Domain × People", x: "domain", y: "participant", columns: DOMAINS, rows: PARTICIPANTS },
  { id: "domain-time", title: "Domain × Horizon", x: "domain", y: "horizon", columns: DOMAINS, rows: HORIZONS },
  { id: "people-time", title: "People × Horizon", x: "participant", y: "horizon", columns: PARTICIPANTS, rows: HORIZONS }
];
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function placements(cases) {
  return cases.flatMap(item => item.domains.flatMap(domain => item.participants.map(participant => ({ id: item.id, domain, participant, horizon: item.horizon }))));
}

export function projectPlane(cases, plane) {
  const cells = new Map();
  for (const y of plane.rows) for (const x of plane.columns) cells.set(JSON.stringify([x, y]), { x, y, ids: new Set() });
  for (const point of placements(cases)) cells.get(JSON.stringify([point[plane.x], point[plane.y]])).ids.add(point.id);
  return [...cells.values()].map(cell => ({ ...cell, ids: [...cell.ids] }));
}
