/** Derive ambient demonstration routes from OSM and the playable Anvil terrain. */
const fs = require('node:fs')
const path = require('node:path')
const { Vec3 } = require('vec3')
const root = path.resolve(__dirname, '..')
const directory = path.resolve(process.argv[2] || path.join(root, 'assets/maps/ntu'))
const output = path.join(root, 'assets/maps/ntu/routes.json')
const scene = JSON.parse(fs.readFileSync(path.join(directory, 'scene.json'), 'utf8'))
const activityStops = [...scene.stations, ...(scene.tourStops || [])]
const osm = JSON.parse(fs.readFileSync(path.join(directory, 'ntu-core-osm.json'), 'utf8'))
const nodes = new Map(osm.elements.filter(value => value.type === 'node').map(value => [value.id, value]))
const [west, south, east, north] = scene.bbox
const origin = scene.projection?.origin ?? { lon: west, lat: north }
const units = scene.projection?.unitsPerDegree ?? { x: (scene.width - 1) / (east - west), z: (scene.depth - 1) / (north - south) }
const project = value => ({ x: Math.trunc((value.lon - origin.lon) * units.x), z: Math.trunc((origin.lat - value.lat) * units.z) })
const Anvil = require('prismarine-provider-anvil').Anvil(scene.version)
const provider = new Anvil(path.join(directory, 'region'))
const chunks = new Map()
const roadBlocks = new Set(['gray_concrete', 'gray_concrete_powder', 'cyan_terracotta', 'black_concrete', 'white_concrete', 'light_gray_concrete', 'stone', 'stone_bricks', 'bricks'])
async function ground (x, z) {
  const bx = Math.floor(x); const bz = Math.floor(z)
  const cx = Math.floor(bx / 16); const cz = Math.floor(bz / 16); const key = `${cx},${cz}`
  if (!chunks.has(key)) {
    if (!fs.existsSync(provider.regionFileName(cx, cz))) return null
    chunks.set(key, await provider.load(cx, cz))
  }
  const chunk = chunks.get(key)
  if (!chunk) return null
  let fallback = null
  for (let y = 220; y >= -63; y--) {
    const block = chunk.getBlock(new Vec3(bx & 15, y, bz & 15))
    if (!block || block.boundingBox !== 'block' || /leaves|log|wood|water|glass|fence|wall/.test(block.name)) continue
    const above = chunk.getBlock(new Vec3(bx & 15, y + 1, bz & 15))
    if (above?.boundingBox !== 'empty') continue
    if (roadBlocks.has(block.name)) return y + 1
    fallback ??= y + 1
  }
  return fallback
}
const nearStation = point => Math.min(...activityStops.map(station => Math.hypot(point.x - station.position.x, point.z - station.position.z)))
const counts = new Map()
const roads = osm.elements.filter(way => way.type === 'way' && ['residential', 'service', 'unclassified', 'tertiary', 'secondary', 'living_street'].includes(way.tags?.highway) && way.tags?.access !== 'private' && !way.tags?.tunnel && way.tags?.indoor !== 'yes')
for (const road of roads) for (const id of road.nodes) counts.set(id, (counts.get(id) || 0) + 1)
const footways = osm.elements.filter(way => way.type === 'way' && ['footway', 'path', 'pedestrian', 'steps'].includes(way.tags?.highway) && way.tags?.indoor !== 'yes' && !way.tags?.tunnel && (!way.tags?.level || way.tags.level === '0'))
// Closed cycles follow actual connected OSM roads instead of turning a bus around mid-road.
const graph = new Map(); const edgeWays = new Map()
for (const way of roads) for (let index = 1; index < way.nodes.length; index++) {
  const a = way.nodes[index - 1]; const b = way.nodes[index]
  if (!graph.has(a)) graph.set(a, new Set())
  if (!graph.has(b)) graph.set(b, new Set())
  graph.get(a).add(b); graph.get(b).add(a)
  edgeWays.set([a, b].sort().join(':'), way.id)
}
const cycles = []; const visited = new Set(); const stack = []; const stackIndex = new Map()
function walkGraph (node, parent) {
  visited.add(node); stackIndex.set(node, stack.length); stack.push(node)
  for (const next of graph.get(node)) {
    if (next === parent) continue
    if (stackIndex.has(next)) {
      const cycle = stack.slice(stackIndex.get(next)).concat(next)
      if (cycle.length > 5) {
        const sourceWays = [...new Set(cycle.slice(1).map((value, index) => edgeWays.get([cycle[index], value].sort().join(':'))))]
        cycles.push({ id: `cycle-${cycles.length}`, nodes: cycle, sourceWays, tags: { name: 'Simulated campus circuit' } })
      }
    } else if (!visited.has(next)) walkGraph(next, node)
  }
  stack.pop(); stackIndex.delete(node)
}
for (const node of graph.keys()) if (!visited.has(node)) walkGraph(node)
const rank = way => Math.min(...way.nodes.map(id => nodes.get(id)).filter(Boolean).map(value => nearStation(project(value))))
async function createRoutes (ways, kind, limit) {
  const result = []
  const buckets = activityStops.map(() => [])
  for (const way of ways) {
    const distances = activityStops.map(station => Math.min(...way.nodes.map(id => nodes.get(id)).filter(Boolean).map(value => { const p = project(value); return Math.hypot(p.x - station.position.x, p.z - station.position.z) })))
    buckets[distances.indexOf(Math.min(...distances))].push(way)
  }
  buckets.forEach(bucket => bucket.sort((a, b) => rank(a) - rank(b)))
  const ordered = []
  while (buckets.some(bucket => bucket.length)) for (const bucket of buckets) if (bucket.length) ordered.push(bucket.shift())
  for (const way of ordered) {
    if (result.length >= limit) break
    if (rank(way) > 240) continue
    const sourcePoints = way.nodes.map(id => nodes.get(id)).filter(Boolean).map(value => ({ ...project(value), node: value }))
    let total = 0
    for (let index = 1; index < sourcePoints.length; index++) total += Math.hypot(sourcePoints[index].x - sourcePoints[index - 1].x, sourcePoints[index].z - sourcePoints[index - 1].z)
    if (total < (kind === 'road' ? way.sourceWays ? 180 : 75 : 20) || total > (kind === 'road' ? 3600 : 1800)) continue
    const points = []
    let valid = true
    for (let index = 0; index < sourcePoints.length - 1; index++) {
      const a = sourcePoints[index]; const b = sourcePoints[index + 1]
      const length = Math.hypot(b.x - a.x, b.z - a.z)
      const samples = Math.max(1, Math.ceil(length / 7))
      for (let step = 0; step < samples; step++) {
        const fraction = step / samples
        const x = a.x + (b.x - a.x) * fraction; const z = a.z + (b.z - a.z) * fraction
        const y = await ground(x, z)
        if (y === null) { valid = false; break }
        if (points.length && Math.abs(points.at(-1)[1] - y) > 5) { valid = false; break }
        points.push([Number(x.toFixed(2)), y, Number(z.toFixed(2))])
      }
      if (!valid) break
    }
    if (!valid || points.length < 3) continue
    const end = sourcePoints.at(-1); const y = await ground(end.x, end.z)
    if (y === null) continue
    points.push([end.x, y, end.z])
    const junction = sourcePoints.slice(1, -1).find(value => value.node.tags?.highway === 'traffic_signals' || (counts.get(value.node.id) || 0) > 1)
    const point = junction || sourcePoints[Math.floor(sourcePoints.length / 2)]
    const junctionIndex = sourcePoints.indexOf(point)
    const before = sourcePoints[Math.max(0, junctionIndex - 1)]; const after = sourcePoints[Math.min(sourcePoints.length - 1, junctionIndex + 1)]
    const dx = after.x - before.x; const dz = after.z - before.z
    result.push({ id: `${kind}-${way.id}`, sourceWay: way.sourceWays?.[0] || way.id, ...(way.sourceWays ? { sourceWays: way.sourceWays } : {}), closed: way.nodes[0] === way.nodes.at(-1), name: way.tags?.name || '', kind, points, ...(kind === 'road' ? { signal: { x: point.x, z: point.z, phase: Math.abs(dx) > Math.abs(dz) ? 0 : 1, simulated: true } } : {}) })
  }
  return result
}
async function main () {
  const circuits = await createRoutes(cycles, 'road', 20)
  const openRoads = await createRoutes(roads, 'road', 24)
  // Keep a few source road segments where the source graph has no usable local cycle.
  const supplements = openRoads.filter(route => route.points.some(point => activityStops.some(station => Math.hypot(point[0] - station.position.x, point[2] - station.position.z) < 140 && !circuits.some(circuit => circuit.points.some(value => Math.hypot(value[0] - station.position.x, value[2] - station.position.z) < 140))))).slice(0, 8)
  const roadRoutes = [...circuits, ...supplements]
  const walks = await createRoutes(footways, 'walk', 48)
  fs.writeFileSync(output, JSON.stringify({ version: 1, attribution: '© OpenStreetMap contributors, ODbL 1.0', description: 'Fictional ambient campus life; not live traffic, bus routes or timetables. Paths follow source OSM ways with terrain elevations read from Anvil.', coordinateOffset: scene.architectureOffset || { x: 0, y: 0, z: 0 }, routes: [...roadRoutes, ...walks] }) + '\n')
  console.log(`Ambient routes: ${roadRoutes.length} roads, ${walks.length} footways; ${fs.statSync(output).size} bytes`)
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => { for (const region of Object.values(provider.regions)) await region.close() })
