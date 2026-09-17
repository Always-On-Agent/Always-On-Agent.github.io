const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const esbuild = require('esbuild')
const { Vec3 } = require('vec3')

const copy = value => JSON.parse(JSON.stringify(value))
const voxels = {
  version: 1, voxelSize: 1,
  palette: ['white_concrete', 'glass'],
  bounds: { min: [0, 0, 0], max: [2, 3, 2] },
  columns: [[0, 0, [[0, 0], [3, 1]]], [2, 0, [[0, 0], [1, 1]]], [0, 2, [[0, 0], [2, 0]]]],
  metadata: { source: 'synthetic regression fixture, no source geometry' }
}
const placement = {
  version: 1, origin: { x: -17, y: -10, z: -17 }, quarterTurns: 0,
  clearRegions: [{ minY: 0, maxY: 3, footprint: [[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]] }],
  spawn: { x: -20.5, y: -10, z: -17.5, yaw: 90 },
  tourStops: [{ id: 'test-stop', name: { en: 'Test stop', zh: '测试' }, position: { x: -20.5, y: -10, z: -17.5 }, approach: { x: -20.5, y: -10, z: -17.5, yaw: 90 } }]
}
const local = { hostname: 'localhost', search: '?scene=ntu&campusPrototype=hall3-16' }

async function main () {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ntu-hall-prototype-'))
  try {
    const out = path.join(tmp, 'prototype.cjs')
    await esbuild.build({
      entryPoints: ['src/ntuHallPrototype.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: out,
      plugins: [{ name: 'external-dependencies', setup (build) { build.onResolve({ filter: /^[^./]/ }, args => ({ path: require.resolve(args.path), external: true })) } }]
    })
    const { isHallPrototype, loadHallPrototype, getLoadedHallPrototype, createHallPrototypeDecorator } = require(out)
    assert.equal(getLoadedHallPrototype(), undefined)
    const requestLog = []
    const fetchFixture = (v = voxels, p = placement) => async (url, options) => {
      requestLog.push({ url, options })
      return { ok: true, status: 200, json: async () => copy(url.endsWith('placement.json') ? p : v) }
    }
    for (const hostname of ['localhost', '127.0.0.1', '::1', '[::1]', 'LOCALHOST']) assert.equal(isHallPrototype({ ...local, hostname }), true, hostname)
    for (const hostname of ['example.com', 'localhost.example.com', '127.0.0.1.example.com', '192.168.0.1', '0.0.0.0', '::ffff:127.0.0.1', '']) {
      assert.equal(isHallPrototype({ ...local, hostname }), false, hostname)
      assert.equal(await loadHallPrototype({ ...local, hostname }, fetchFixture()), undefined)
    }
    for (const search of ['', '?campusPrototype=hall3', '?scene=ntu', '?campusPrototype=hall3-16.example.com']) assert.equal(await loadHallPrototype({ ...local, search }, fetchFixture()), undefined)
    globalThis.location = { ...local, hostname: 'public.example' }
    assert.equal(await loadHallPrototype(local, fetchFixture()), undefined, 'injected arguments cannot override the actual public browser hostname')
    delete globalThis.location
    assert.equal(requestLog.length, 0, 'public and non-prototype requests cannot fetch local assets')
    const loaded = await loadHallPrototype(local, fetchFixture())
    assert.deepEqual(loaded, { voxels, placement })
    assert.equal(getLoadedHallPrototype(), loaded)
    assert.deepEqual(requestLog.map(request => request.url).sort(), ['./local-ntu-assets/hall3-16-voxels.json', './local-ntu-assets/placement.json'])
    for (const request of requestLog) assert.deepEqual(request.options, { cache: 'no-store', credentials: 'same-origin', redirect: 'error' })
    assert.equal(await loadHallPrototype({ ...local, hostname: 'hosted.example' }, fetchFixture()), undefined)
    assert.equal(getLoadedHallPrototype(), undefined, 'the getter never retains an active prototype after a gated load')

    await assert.rejects(loadHallPrototype(local, async () => ({ ok: false, status: 404 })), /HTTP 404.*local asset directory/)
    await assert.rejects(loadHallPrototype(local, async () => { throw new Error('connection refused') }), /loopback asset server: connection refused/)
    await assert.rejects(loadHallPrototype(local, async () => ({ ok: true, json: async () => { throw new Error('HTML') } })), /not valid JSON/)
    const badPaletteIndex = copy(voxels); badPaletteIndex.columns[0][2][0][1] = 2
    await assert.rejects(loadHallPrototype(local, fetchFixture(badPaletteIndex)), /Invalid \[y,paletteIndex\]/)
    const duplicateVoxel = copy(voxels); duplicateVoxel.columns[0][2].push([0, 1])
    await assert.rejects(loadHallPrototype(local, fetchFixture(duplicateVoxel)), /Duplicate voxel/)
    const missingClearance = copy(placement); delete missingClearance.clearRegions
    await assert.rejects(loadHallPrototype(local, fetchFixture(voxels, missingClearance)), /explicit geographic/)
    const wrongHeight = copy(placement); wrongHeight.origin.y = 318
    await assert.rejects(loadHallPrototype(local, fetchFixture(voxels, wrongHeight)), /exceeds the supported world height/)
    const badFootprint = copy(placement); badFootprint.clearRegions[0].footprint = [[0, 0], [1, 1], [2, 2]]
    await assert.rejects(loadHallPrototype(local, fetchFixture(voxels, badFootprint)), /has no area/)
    const badBaselineSpawn = copy(placement); badBaselineSpawn.baselineSpawn = { x: 'bad', y: 0, z: 0 }
    await assert.rejects(loadHallPrototype(local, fetchFixture(voxels, badBaselineSpawn)), /baselineSpawn must contain finite/)
    const badTour = copy(placement); badTour.tourStops[0].prototypeOnly = 'true'
    await assert.rejects(loadHallPrototype(local, fetchFixture(voxels, badTour)), /tour stops need/)
    assert.equal(getLoadedHallPrototype(), undefined, 'invalid files never become the active prototype')

    const version = JSON.parse(fs.readFileSync('assets/maps/ntu/scene.json', 'utf8')).version
    const data = require('minecraft-data')(version)
    const Chunk = require('prismarine-chunk')(version)
    const stone = data.blocksByName.stone.defaultState
    const grass = data.blocksByName.grass_block.defaultState
    const oldFacade = data.blocksByName.red_terracotta.defaultState
    const emerald = data.blocksByName.emerald_block.defaultState
    assert.notEqual(data.blocksByName.glass.id, data.blocksByName.glass.defaultState, 'test must distinguish block types from state IDs')
    for (const quarterTurns of [0, 1, 2, 3]) {
      const placed = { voxels: copy(voxels), placement: { ...copy(placement), quarterTurns } }
      placed.placement.groundPatches = [{ minY: 0, maxY: 0, footprint: [[3, 0], [4, 0], [4, 1], [3, 1]], block: 'smooth_stone' }]
      const decorate = createHallPrototypeDecorator(data, placed)
      const chunks = new Map()
      const chunkAt = (x, z) => {
        const cx = Math.floor(x / 16), cz = Math.floor(z / 16), key = `${cx},${cz}`
        if (!chunks.has(key)) chunks.set(key, new Chunk({ minY: -64, worldHeight: 384 }))
        return chunks.get(key)
      }
      const pos = (x, y, z) => new Vec3(x - Math.floor(x / 16) * 16, y, z - Math.floor(z / 16) * 16)
      const set = (x, y, z, state) => chunkAt(x, z).setBlockStateId(pos(x, y, z), state)
      const at = (x, y, z) => chunkAt(x, z).getBlock(pos(x, y, z))
      for (let x = -22; x <= -11; x++) for (let z = -22; z <= -11; z++) {
        set(x, -12, z, stone); set(x, -11, z, grass)
        for (let y = -10; y <= -7; y++) set(x, y, z, oldFacade)
      }
      const world = (x, y, z) => {
        const rotations = [[x, z], [-z, x], [-x, -z], [z, -x]]
        const [rx, rz] = rotations[quarterTurns]
        return [rx + placement.origin.x, y + placement.origin.y, rz + placement.origin.z]
      }
      for (const [key, chunk] of chunks) decorate(chunk, ...key.split(',').map(Number))
      for (const [x, z, cells] of voxels.columns) for (const [y, index] of cells) {
        const block = at(...world(x, y, z))
        assert.equal(block.stateId, data.blocksByName[voxels.palette[index]].defaultState, `real state ID, quarter turn ${quarterTurns}`)
        assert.equal(block.boundingBox, 'block', 'voxel is collidable through the real Minecraft registry')
      }
      assert.equal(at(...world(1, 1, 0)).name, 'air', 'clear geographic building interior')
      assert.equal(at(...world(1, 1, 1)).name, 'red_terracotta', 'preserve the concave polygon cutout despite its presence inside the asset bounds')
      assert.equal(at(...world(3, 1, 0)).name, 'red_terracotta', 'preserve terrain/buildings outside the geographic footprint')
      assert.equal(at(...world(3, 0, 0)).name, 'smooth_stone', 'apply only the explicitly bounded foundation/walk patch')
      assert.equal(at(...world(0, -1, 0)).name, 'grass_block', 'preserve ground below the explicit clearance range')
      const skyAt = (x, y, z) => { const w = world(x, y, z); return chunkAt(w[0], w[2]).getSkyLight(pos(...w)) }
      assert.equal(skyAt(1, 1, 0), 15, 'cleared open-air column receives skylight')
      assert.equal(skyAt(0, 3, 0), 15, 'glass transmits skylight')
      assert.equal(skyAt(0, 0, 0), 0, 'solid base blocks direct skylight')
      assert.equal(skyAt(0, 2, 2), 0, 'solid roof blocks direct skylight')
      assert.equal(skyAt(0, 1, 2), 0, 'space below solid roof stays in direct shadow')
      const changed = world(1, 1, 0)
      set(...changed, emerald)
      for (const [key, chunk] of chunks) {
        const before = chunk.dump(), beforeLight = chunk.dumpLight()
        decorate(chunk, ...key.split(',').map(Number))
        assert.deepEqual(chunk.dump(), before, 'each chunk object is decorated once')
        assert.deepEqual(chunk.dumpLight(), beforeLight, 'repeated decoration leaves light unchanged')
      }
      assert.equal(at(...changed).name, 'emerald_block', 'idempotency preserves subsequent player edits')
      assert(chunks.has('-2,-2') && chunks.has('-1,-1'), 'fixture crosses negative chunk boundaries')
      const fresh = new Chunk({ minY: -64, worldHeight: 384 })
      const stamped = world(0, 0, 0), cx = Math.floor(stamped[0] / 16), cz = Math.floor(stamped[2] / 16)
      decorate(fresh, cx, cz)
      assert.equal(fresh.getBlock(pos(...stamped)).name, 'white_concrete', 'a newly loaded chunk object at the same coordinate is decorated')
    }
    const shorthand = copy(placement)
    delete shorthand.clearRegions
    shorthand.clearance = { minY: 0, maxY: 3, footprints: [placement.clearRegions[0].footprint] }
    assert(await loadHallPrototype(local, fetchFixture(voxels, shorthand)))
    const badBlock = copy(voxels); badBlock.palette[0] = 'imaginary_minecraft_block'
    assert.throws(() => createHallPrototypeDecorator(data, { voxels: badBlock, placement }), /no block named/)
    const fluid = copy(voxels); fluid.palette[0] = 'water'
    assert.throws(() => createHallPrototypeDecorator(data, { voxels: fluid, placement }), /no solid collision/)
    console.log('PASS: local-only loading, asset validation, negative chunk coordinates, four rotations, footprint-only clearance, real collision/state IDs, skylight, and chunk idempotency.')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
