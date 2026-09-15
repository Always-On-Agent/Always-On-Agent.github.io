import test from 'node:test';
import assert from 'node:assert/strict';
import {blocked, canWalkSegment, planRoute} from '../demo/routes.mjs';

const places = [
  {id: 'Library', x: -10, z: -4.3}, {id: 'Café', x: 10, z: -4.3},
  {id: 'Courtyard', x: 0, z: 1.3}, {id: 'Gate', x: 0, z: 12.8}
];

function walk(start, destination, step = .21) {
  const route = planRoute(start, destination), path = [...route];
  assert.ok(path.length, `No route from ${JSON.stringify(start)} to ${destination.id}`);
  let {x, z} = start;
  for (let frame = 0; path.length && frame < 4000; frame++) {
    const target = path[0], dx = target.x - x, dz = target.z - z, distance = Math.hypot(dx, dz);
    if (distance < .2) { path.shift(); continue; }
    const nx = x + dx / distance * Math.min(distance, step), nz = z + dz / distance * Math.min(distance, step);
    if (!blocked(nx, z)) x = nx;
    if (!blocked(x, nz)) z = nz;
  }
  assert.equal(path.length, 0, `Stuck at (${x},${z}): ${JSON.stringify(start)} → ${destination.id}`);
  assert.ok(Math.hypot(x - destination.x, z - destination.z) < .2);
  return route;
}

test('automatic walking reaches every directed landmark pair at normal and capped frame steps', () => {
  for (const from of places) for (const to of places) {
    if (from === to) continue;
    for (const step of [.07, .21]) walk(from, to, step);
  }
});

test('walk-to also recovers from free exploration around planters and the pool', () => {
  for (let x = -16; x <= 16; x += 2) for (let z = -13; z <= 13; z += 2) {
    if (blocked(x, z)) continue;
    for (const destination of places) walk({x, z}, destination);
  }
});

test('route visibility rejects the old tree crossing and the pool shortcut', () => {
  assert.equal(canWalkSegment({x: -10, z: 3.8}, {x: 0, z: 3.8}), false);
  assert.equal(canWalkSegment({x: 10, z: 3.8}, {x: 0, z: 3.8}), false);
  assert.equal(canWalkSegment({x: -10, z: 5.3}, {x: 0, z: 5.3}), true);
  assert.equal(canWalkSegment({x: 0, z: -12}, {x: 0, z: -3}), false);
  assert.deepEqual(planRoute({x: -6, z: 3}, places[0]), []);
});
