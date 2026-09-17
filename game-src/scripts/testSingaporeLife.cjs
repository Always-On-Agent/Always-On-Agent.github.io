const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { EventEmitter } = require('node:events')
const esbuild = require('esbuild')
const root = path.resolve(__dirname, '..')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ntu-life-'))
const tick = () => new Promise(resolve => setImmediate(resolve))
async function main () {
  const mathFile = path.join(temp, 'math.cjs')
  const rendererFile = path.join(temp, 'renderer.cjs')
  const originFile = path.join(temp, 'origin.cjs')
  esbuild.buildSync({ entryPoints: [path.join(root, 'src/singaporeLifeMath.ts')], outfile: mathFile, bundle: true, platform: 'node', format: 'cjs' })
  esbuild.buildSync({ entryPoints: [path.join(root, 'src/singaporeLife.ts')], outfile: rendererFile, bundle: true, platform: 'node', format: 'cjs' })
  esbuild.buildSync({ entryPoints: [path.join(root, 'node_modules/minecraft-renderer/src/three/sceneOrigin.ts')], outfile: originFile, bundle: true, platform: 'node', format: 'cjs' })
  const { SceneOrigin } = require(originFile)
  const { Scene } = require('three')
  const math = require(mathFile)
  const raw = { id: 'road-1', sourceWay: 1, kind: 'road', name: 'Test road', points: [[0, 2, 0], [0, 2, 100], [0, 2, 200]], signal: { x: 0, z: 100, phase: 0, simulated: true } }
  const route = math.prepareLifeRoute(raw)
  const routes = new Map([[route.id, route]])
  assert.ok(math.sampleLifeRoute(route, 50).x > 0, 'southbound cars occupy the east/left lane')
  assert.ok(math.sampleLifeRoute(route, route.length + Math.PI * route.lane + 50).x < 0, 'northbound cars occupy the west/left lane')
  for (const point of [0, route.length, route.length + Math.PI * route.lane, route.loopLength]) {
    const before = math.sampleLifeRoute(route, point - .001); const after = math.sampleLifeRoute(route, point + .001)
    assert.ok(Math.hypot(before.x - after.x, before.z - after.z) < .01, 'route wrap and turns are continuous')
  }
  const closed = math.prepareLifeRoute({ ...raw, closed: true, points: [[0, 2, 0], [0, 2, 100], [100, 2, 100], [100, 2, 0], [0, 2, 0]] })
  assert.equal(closed.loopLength, 400)
  const left = math.sampleLifeRoute(closed, closed.loopLength - .001); const right = math.sampleLifeRoute(closed, .001)
  assert.ok(Math.hypot(left.x - right.x, left.z - right.z) < .01, 'closed real-road circuit has no teleport at wrap')
  assert.equal(math.campusSignal(0, 0), 'green'); assert.equal(math.campusSignal(0, 1), 'red')
  assert.equal(math.campusSignal(11.5, 0), 'amber')
  assert.equal(math.campusSignal(13.5, 0), 'red'); assert.equal(math.campusSignal(13.5, 1), 'red')
  assert.equal(math.campusSignal(14, 1), 'green')
  let car = { id: 1, routeId: route.id, distance: 70, speed: 6, cruise: 6, length: 4 }
  for (let step = 0; step < 200; step++) [car] = math.advanceCampusTraffic([car], routes, 15, .1)
  assert.ok(car.distance <= route.stopPositions[0] - 2 + 1e-6, 'front bumper never crosses red stop line')
  const stopped = car.distance
  for (let step = 0; step < 100; step++) [car] = math.advanceCampusTraffic([car], routes, 0, .1)
  assert.ok(car.distance > stopped + 15, 'green releases stopped traffic')
  let convoy = [{ id: 1, routeId: route.id, distance: 60, speed: 0, cruise: 0, length: 4 }, { id: 2, routeId: route.id, distance: 40, speed: 6, cruise: 6, length: 4 }]
  for (let step = 0; step < 200; step++) convoy = math.advanceCampusTraffic(convoy, routes, 0, .1)
  assert.ok(convoy[0].distance - convoy[1].distance >= 6.5 - 1e-6, 'following vehicles retain bumper gap')
  const longFrame = math.advanceCampusTraffic([{ id: 3, routeId: route.id, distance: 90, speed: 100, cruise: 100, length: 4 }], routes, 15, 999)[0]
  assert.ok(longFrame.distance <= route.stopPositions[0] - 2, 'long frames cannot jump red lights')
  const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/maps/ntu/routes.json'), 'utf8'))
  assert.ok(data.routes.some(value => value.kind === 'road') && data.routes.some(value => value.kind === 'walk'))
  assert.ok(data.routes.every(value => value.points.every(point => point.every(Number.isFinite))))
  // Use the actual Three.js renderer code with a tiny browser scheduling boundary.
  const callbacks = new Map(); let frame = 0; const tracked = new Set(); let removed = 0
  global.requestAnimationFrame = callback => { callbacks.set(++frame, callback); return frame }
  global.cancelAnimationFrame = id => callbacks.delete(id)
  global.document = { hidden: false, createElement: () => ({ getContext: () => null }) }
  global.fetch = async () => ({ ok: true, json: async () => ({ coordinateOffset: { x: 0, y: 0, z: 0 }, routes: [raw, { ...raw, id: 'walk-1', kind: 'walk' }] }) })
  const bot = Object.assign(new EventEmitter(), { entity: { position: { x: 768, y: 12, z: 1586 } } })
  const origin = new SceneOrigin(new Scene())
  origin.update(bot.entity.position.x, bot.entity.position.y + 1.62, bot.entity.position.z)
  const addAndTrack = origin.addAndTrack.bind(origin); const removeAndUntrack = origin.removeAndUntrack.bind(origin)
  origin.addAndTrack = object => { addAndTrack(object); tracked.add(object) }
  origin.removeAndUntrack = object => { removeAndUntrack(object); tracked.delete(object); removed++ }
  const blockQueries = []
  bot.blockAt = point => { blockQueries.push(point); return { name: 'air' } }
  const { installSingaporeLife } = require(rendererFile)
  const cleanup = installSingaporeLife({ sceneOrigin: origin }, bot, { architectureOffset: { x: 768, y: 10, z: 1536 } })
  await tick(); await tick()
  assert.equal(tracked.size, 15, 'fixed pool: ten people plus five vehicles')
  for (let step = 0; step < 5; step++) { const entries = [...callbacks.values()]; callbacks.clear(); entries.forEach(callback => callback(1000 + step * 16)) }
  assert.ok([...tracked].some(object => object.visible && origin.getWorldPosition(object).x > 700 && origin.getWorldPosition(object).y > 10), 'actors stay visible with the actual camera-rebased SceneOrigin')
  assert.ok([...tracked].some(object => object.visible && Math.abs(object.position.x) < 150), 'position reads are camera-relative, not world coordinates')
  assert.ok(blockQueries.length && blockQueries.every(point => point.x > 700 && point.z > 1500), 'chunk availability queries use world coordinates for actors and signals')
  bot.blockAt = () => null
  for (let step = 0; step < 2; step++) { const entries = [...callbacks.values()]; callbacks.clear(); entries.forEach(callback => callback(2000 + step * 16)) }
  assert.ok([...tracked].every(object => !object.visible), 'unloaded terrain hides ambient objects')
  const count = tracked.size
  cleanup(); cleanup()
  assert.equal(tracked.size, 0); assert.equal(removed, count); assert.equal(callbacks.size, 0); assert.equal(bot.listenerCount('end'), 0)
  let resolveFetch
  global.fetch = () => new Promise(resolve => { resolveFetch = resolve })
  const early = installSingaporeLife({ sceneOrigin: origin }, bot)
  early(); resolveFetch({ ok: true, json: async () => data }); await tick(); await tick()
  assert.equal(tracked.size, 0, 'late route load cannot recreate objects after cleanup')
  console.log(`PASS: left lanes, continuous open/closed loops, two-axis signal timing, red stops, green release, anti-tailgating, ${data.routes.length} terrain-backed routes, translated actors and idempotent/late-load cleanup`)
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => fs.rmSync(temp, { recursive: true, force: true }))
