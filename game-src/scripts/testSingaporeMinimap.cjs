const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const esbuild = require('esbuild')
const root = path.resolve(__dirname, '..')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'ntu-minimap-'))
try {
  const outfile = path.join(temporary, 'geometry.cjs')
  esbuild.buildSync({ entryPoints: [path.join(root, 'src/singaporeMinimapGeometry.ts')], outfile, bundle: true, platform: 'node', format: 'cjs' })
  const geometry = require(outfile)
  const scene = JSON.parse(fs.readFileSync(path.join(root, 'assets/maps/ntu/scene.json'), 'utf8'))
  const landmarks = JSON.parse(fs.readFileSync(path.join(root, 'assets/maps/ntu/landmarks.json'), 'utf8'))
  for (const landmark of landmarks.pois) {
    const point = geometry.projectSingaporeCoordinate(landmark.lon, landmark.lat, scene.bbox, scene)
    assert.deepEqual(point, landmark.worldXZ, `${landmark.name}: same projection as the playable world`)
  }
  const map = JSON.parse(fs.readFileSync(path.join(root, 'assets/maps/ntu/minimap.json'), 'utf8'))
  assert.ok(map.features.some(([kind]) => kind === 'road'))
  assert.ok(map.features.some(([kind]) => kind === 'building'))
  assert.ok(map.features.every(([, points]) => points.length >= 4 && points.length % 2 === 0 && points.every(Number.isFinite)))
  const view = geometry.minimapViewport({ x: 700, z: 700 }, 224, 130, map)
  const center = geometry.minimapPixel({ x: 700, z: 700 }, view, 224, 130)
  assert.ok(Math.abs(center.x - 112) < 1e-6 && Math.abs(center.y - 65) < 1e-6)
  const corner = geometry.minimapViewport({ x: -100, z: -100 }, 224, 130, map)
  assert.equal(corner.left, 0); assert.equal(corner.top, 0)
  const expanded = { minX: -500, minZ: -900, width: 2500, depth: 2800 }
  const expandedCorner = geometry.minimapViewport({ x: -1000, z: -2000 }, 224, 130, expanded)
  assert.equal(expandedCorner.left, -500); assert.equal(expandedCorner.top, -900)
  const bottom = geometry.minimapViewport({ x: 9999, z: 9999 }, 224, 130, expanded)
  assert.equal(bottom.left + bottom.width, expanded.minX + expanded.width)
  assert.equal(bottom.top + bottom.height, expanded.minZ + expanded.depth)
  for (const [yaw, dx, dz] of [[0, 0, -1], [Math.PI / 2, -1, 0], [Math.PI, 0, 1], [-Math.PI / 2, 1, 0]]) {
    const angle = geometry.minimapHeading(yaw)
    assert.ok(Math.abs(Math.sin(angle) - dx) < 1e-6)
    assert.ok(Math.abs(-Math.cos(angle) - dz) < 1e-6)
  }
  const pin = geometry.minimapPin({ x: 400, y: -200 }, 224, 130)
  assert.ok(pin.offscreen && pin.x <= 213 && pin.y >= 11)
  assert.ok(Math.abs((pin.x - 112) / (pin.y - 65) - (400 - 112) / (-200 - 65)) < 1e-6, 'offscreen marker preserves destination bearing')
  for (const [width, height] of [[1000, 480], [350, 570]]) {
    const full = geometry.campusMapViewport(map, width, height)
    assert.ok(full.left <= map.minX && full.top <= map.minZ, 'fit includes northwest map edge')
    assert.ok(full.left + full.width >= map.minX + map.width && full.top + full.height >= map.minZ + map.depth, 'fit includes southeast map edge')
    assert.ok(Math.abs(width / full.width - height / full.height) < 1e-9, 'full map must not distort geographic aspect ratio')
    for (const place of [...scene.stations, ...scene.tourStops]) {
      const point = geometry.minimapPixel(place.position, full, width, height)
      assert.ok(point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height, `full map includes ${place.id}`)
    }
    const focused = geometry.campusMapViewport(map, width, height, 3, scene.spawn)
    const position = geometry.minimapPixel(scene.spawn, focused, width, height)
    assert.ok(position.x >= 0 && position.x <= width && position.y >= 0 && position.y <= height, 'my-position camera keeps the player visible')
  }
  console.log(`PASS: ${landmarks.pois.length} real landmarks, ${map.features.length} OSM features, four headings, live viewport, negative-origin expansion and edge bearings`)
} finally { fs.rmSync(temporary, { recursive: true, force: true }) }
