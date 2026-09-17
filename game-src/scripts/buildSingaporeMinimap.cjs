const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const directory = path.join(root, 'assets/maps/ntu')
const scene = JSON.parse(fs.readFileSync(path.join(directory, 'scene.json'), 'utf8'))
const source = JSON.parse(fs.readFileSync(path.join(directory, 'ntu-core-osm.json'), 'utf8'))
const [west, south, east, north] = scene.bbox
const nodes = new Map(source.elements.filter(value => value.type === 'node').map(value => [value.id, value]))
// Expanded maps may keep the old world's origin and one-block-per-metre projection.
const origin = scene.projection?.origin ?? { lon: west, lat: north }
const units = scene.projection?.unitsPerDegree ?? { x: (scene.width - 1) / (east - west), z: (scene.depth - 1) / (north - south) }
const project = value => [Math.trunc((value.lon - origin.lon) * units.x), Math.trunc((origin.lat - value.lat) * units.z)]
const [minX, minZ] = project({ lon: west, lat: north })
const [maxX, maxZ] = project({ lon: east, lat: south })
const width = maxX - minX + 1; const depth = maxZ - minZ + 1
const features = []
for (const way of source.elements) {
  if (way.type !== 'way' || !way.tags || way.tags.indoor === 'yes') continue
  const tags = way.tags
  const kind = tags.building && tags.building !== 'no' ? 'building' : tags.natural === 'water' || tags.water ? 'water' : ['park', 'garden'].includes(tags.leisure) || ['grass', 'forest', 'meadow'].includes(tags.landuse) || ['wood', 'scrub', 'grassland'].includes(tags.natural) ? 'green' : tags.highway ? ['footway', 'path', 'steps', 'pedestrian', 'cycleway'].includes(tags.highway) ? 'path' : 'road' : ''
  if (!kind) continue
  const points = way.nodes.map(id => nodes.get(id)).filter(Boolean).map(project)
  if (points.length < 2) continue
  if (['building', 'green', 'water'].includes(kind) && way.nodes[0] !== way.nodes.at(-1)) continue
  const xs = points.map(point => point[0]); const zs = points.map(point => point[1])
  if (Math.max(...xs) < minX || Math.min(...xs) > maxX || Math.max(...zs) < minZ || Math.min(...zs) > maxZ) continue
  features.push([kind, points.flat()])
}
const result = { version: 1, minX, minZ, width, depth, attribution: '© OpenStreetMap contributors, ODbL 1.0', source: 'ntu-core-osm.json', projection: 'Arnis northwest origin; +X east, +Z south; one block per metre', features }
fs.writeFileSync(path.join(directory, 'minimap.json'), JSON.stringify(result) + '\n')
console.log(`NTU minimap: ${features.length} OSM features; ${fs.statSync(path.join(directory, 'minimap.json')).size} bytes`)
