import assert from 'node:assert/strict'
import { Vec3 } from 'vec3'
import { createEccvGenerator, ECCV_SCENE } from '../src/eccvWorld'

const data = require('minecraft-data')('1.19.4')
const { generator } = createEccvGenerator()
const chunks = new Map<string, ReturnType<typeof generator>>()
type Position = { x: number, y: number, z: number }

// Geometry regression only: real generated blocks, clear headroom, connected
// paths, and line of sight. It deliberately does not load the browser HUD or
// pretend to test its dwell timers, view cone, input handlers, or report state.
function blockAt (x: number, y: number, z: number) {
  x = Math.floor(x)
  y = Math.floor(y)
  z = Math.floor(z)
  const chunkX = Math.floor(x / 16)
  const chunkZ = Math.floor(z / 16)
  const key = `${chunkX},${chunkZ}`
  if (!chunks.has(key)) chunks.set(key, generator(chunkX, chunkZ))
  const state = chunks.get(key)!.getBlockStateId(new Vec3(x - chunkX * 16, y, z - chunkZ * 16))
  return data.blocksByStateId[state]
}

function walkable (x: number, z: number) {
  return blockAt(x, 4, z).name !== 'air' && blockAt(x, 5, z).name === 'air' && blockAt(x, 6, z).name === 'air'
}

// This stricter geometry check requires every sampled cell before the target
// to be air. Passing it guarantees an unobstructed ray, without duplicating the
// runtime helper's material exceptions or its policy about distance and gaze.
function clearRay (eye: Position, target: Position) {
  const destination = { x: target.x + 0.5, y: target.y + 0.5, z: target.z + 0.5 }
  const distance = Math.hypot(destination.x - eye.x, destination.y - eye.y, destination.z - eye.z)
  const steps = Math.ceil(distance / 0.08)
  for (let step = 0; step < steps; step++) {
    const fraction = step / steps
    const x = eye.x + (destination.x - eye.x) * fraction
    const y = eye.y + (destination.y - eye.y) * fraction
    const z = eye.z + (destination.z - eye.z) * fraction
    if (Math.floor(x) === target.x && Math.floor(y) === target.y && Math.floor(z) === target.z) continue
    if (blockAt(x, y, z).name !== 'air') return false
  }
  return true
}

const start: [number, number] = [Math.floor(ECCV_SCENE.spawn.x), Math.floor(ECCV_SCENE.spawn.z)]
assert.ok(walkable(...start), 'Spawn must provide supported feet and two air blocks of headroom')
const queue: Array<[number, number]> = [start]
const connected = new Set([start.join(',')])
for (let index = 0; index < queue.length; index++) {
  const [x, z] = queue[index]
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nextX = x + dx
    const nextZ = z + dz
    const key = `${nextX},${nextZ}`
    if (nextX < -25 || nextX > 25 || nextZ < -32 || nextZ > 34 || connected.has(key) || !walkable(nextX, nextZ)) continue
    connected.add(key)
    queue.push([nextX, nextZ])
  }
}

const stations = [
  ...ECCV_SCENE.posters.map(poster => ({ id: poster.id, target: poster.position, approach: poster.approach })),
  { id: 'report', target: ECCV_SCENE.reportPoint, approach: ECCV_SCENE.reportApproach }
]
assert.equal(stations.length, 6, 'Five posters and one report station must be covered')
assert.equal(new Set(stations.map(station => station.id)).size, 6, 'Station identifiers must be unique')
for (const { id, target, approach } of stations) {
  assert.ok(connected.has(`${Math.floor(approach.x)},${Math.floor(approach.z)}`), `${id}: approach must be reachable from spawn`)
  assert.notEqual(blockAt(target.x, target.y, target.z).name, 'air', `${id}: the interaction must correspond to a visible world block`)
  const eye = { x: approach.x, y: approach.y + 1.62, z: approach.z }
  const distance = Math.hypot(target.x + 0.5 - eye.x, target.y + 0.5 - eye.y, target.z + 0.5 - eye.z)
  assert.ok(distance < (id === 'report' ? 5 : 3.3), `${id}: designated approach must be comfortably within interaction range`)
  assert.ok(clearRay(eye, target), `${id}: the designated approach must have an unobstructed eye ray`)
  const spawnDistance = Math.hypot(target.x + 0.5 - ECCV_SCENE.spawn.x, target.y + 0.5 - ECCV_SCENE.spawn.y - 1.62, target.z + 0.5 - ECCV_SCENE.spawn.z)
  assert.ok(spawnDistance > 7, `${id}: spawning alone must not put a station within the observation radius`)
  console.log(`${id}: reachable, solid target, clear sightline, ${distance.toFixed(3)} m from approach`)
}

// Negative geometry checks prevent the positive tests from accepting an empty
// or accidentally non-colliding hall, and exercise actual occlusion geometry.
assert.equal(walkable(24, 0), false, 'The perimeter wall must block walking')
assert.equal(connected.has('25,0'), false, 'The outside floor must not be reachable through the hall wall')
assert.equal(clearRay({ x: 22.5, y: 6.62, z: 0.5 }, { x: 25, y: 6, z: 0 }), false, 'A ray through the perimeter wall must be obstructed')
assert.equal(walkable(ECCV_SCENE.posters[0].position.x, ECCV_SCENE.posters[0].position.z), false, 'A poster panel must occupy real collision geometry')
console.log(`Passed: ${chunks.size} chunks generated, ${connected.size} connected floor cells, six interaction stations, four negative geometry checks.`)
