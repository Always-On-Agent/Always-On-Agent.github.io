/**
 * Exercise the NTU adapter with the published map, a real local HTTP server,
 * BrowserFS HTTPRequest, and the real Anvil reader. Only browser application
 * boundaries are stubbed. This is a storage test, not a browser playthrough.
 * Run from any directory: node /path/to/client/scripts/testSingaporeMap.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { promisify } = require('node:util')
const Module = require('node:module')

const root = path.resolve(__dirname, '..')
const req = Module.createRequire(path.join(root, 'package.json'))
const esbuild = req('esbuild')
const bfs = require(path.join(root, 'node_modules/browserfs/dist/node/core/browserfs.js'))
const browserFs = bfs.BFSRequire('fs')
const mapDirectory = path.join(root, 'assets/maps/ntu')
const scene = JSON.parse(fs.readFileSync(path.join(mapDirectory, 'scene.json'), 'utf8'))
const mapIndex = JSON.parse(fs.readFileSync(path.join(mapDirectory, 'index.json'), 'utf8'))
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ntu-storage-test-'))
const bundlePath = path.join(temporaryDirectory, 'map.cjs')

// The application wraps these Node-shaped methods around BrowserFS. Supply
// their read-only equivalents without importing the renderer or React app.
browserFs.promises = Object.fromEntries(['readFile', 'writeFile', 'stat', 'mkdir', 'rmdir', 'unlink', 'rename', 'readdir']
  .map(key => [key, promisify(browserFs[key])]))
browserFs.promises.open = async file => {
  const fd = await promisify(browserFs.open)(file, 'r')
  return {
    read: async (...args) => new Promise((resolve, reject) => {
      browserFs.read(fd, ...args, (error, bytesRead, buffer) => error ? reject(error) : resolve({ bytesRead, buffer }))
    }),
    close: () => promisify(browserFs.close)(fd)
  }
}

global.__ntuBrowserFs = bfs
global.__ntuFs = browserFs
global.__ntuFsState = {}
global.__ntuOptions = { disableLoadPrompts: false }
global.__ntuQuery = {}
global.__ntuSavedSettings = {}
global.__ntuQsOptions = {}
global.__ntuSceneSettings = { value: new Set() }
global.__ntuLoadSave = async (worldPath, options) => {
  global.__ntuConnectOptions = options
  global.__ntuLevel = (await req('prismarine-nbt').parse(await browserFs.promises.readFile(`${worldPath}/level.dat`))).parsed
}
const stubs = {
  fs: 'module.exports = global.__ntuFs',
  browserfs: 'module.exports = global.__ntuBrowserFs',
  './appParams': 'exports.appQueryParams = global.__ntuQuery',
  './optionsStorage': 'exports.options = global.__ntuOptions; exports.qsOptions = global.__ntuQsOptions; exports.serverChangedSettings = global.__ntuSceneSettings',
  './react/appStorageProvider': 'exports.appStorage = {changedSettings: global.__ntuSavedSettings}',
  './loadSave': 'exports.fsState = global.__ntuFsState; exports.loadSave = global.__ntuLoadSave'
}

let httpReads = 0
let failurePath = ''
let provider
const web = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const target = path.resolve(mapDirectory, `.${requestPath}`)
  if (!target.startsWith(`${mapDirectory}${path.sep}`)) {
    response.statusCode = 403
    response.end()
    return
  }
  if (requestPath === failurePath) {
    response.statusCode = 503
    response.end('Test network failure')
    return
  }
  try {
    const stat = fs.statSync(target)
    response.setHeader('Content-Length', stat.size)
    if (request.method === 'HEAD') response.end()
    else {
      httpReads++
      fs.createReadStream(target).pipe(response)
    }
  } catch {
    response.statusCode = 404
    response.end()
  }
})

async function run () {
  await new Promise(resolve => web.listen(0, '127.0.0.1', resolve))
  global.window = new EventTarget()
  window.location = { href: `http://127.0.0.1:${web.address().port}/index.html` }
  await new Promise((resolve, reject) => bfs.configure({
    fs: 'MountableFileSystem', options: { '/data': { fs: 'InMemory' }, '/temp': { fs: 'InMemory' } }
  }, error => error ? reject(error) : resolve()))

  await esbuild.build({
    entryPoints: [path.join(root, 'src/singaporeMap.ts')],
    bundle: true, platform: 'node', format: 'cjs', outfile: bundlePath, logLevel: 'silent',
    plugins: [{
      name: 'browser-boundaries',
      setup (build) {
        build.onResolve({ filter: /.*/ }, args => {
          if (stubs[args.path]) return { path: args.path, namespace: 'stub' }
          if (!args.path.startsWith('.') && !path.isAbsolute(args.path)) return { path: req.resolve(args.path), external: true }
        })
        build.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: stubs[args.path], loader: 'js' }))
      }
    }]
  })
  const helper = require(bundlePath)
  Object.assign(global.__ntuOptions, { renderDistance: 3, rendererWorldPerformance: 'normal', keepChunksDistance: 1 })
  assert.equal(helper.applyNtuMapPerformanceDefaults(), 2)
  assert.equal(global.__ntuOptions.rendererWorldPerformance, 'low-energy')
  assert.equal(global.__ntuOptions.keepChunksDistance, 0)
  assert.deepEqual(global.__ntuSavedSettings, {}, 'Scene defaults do not alter saved visitor preferences')
  assert(global.__ntuSceneSettings.value.has('renderDistance'), 'Scene defaults are excluded from automatic preference persistence')
  Object.assign(global.__ntuSavedSettings, { renderDistance: 4, rendererWorldPerformance: 'normal', keepChunksDistance: 1 })
  Object.assign(global.__ntuOptions, global.__ntuSavedSettings)
  assert.equal(helper.applyNtuMapPerformanceDefaults(), 4)
  assert.equal(global.__ntuOptions.rendererWorldPerformance, 'normal')
  assert.equal(global.__ntuOptions.keepChunksDistance, 1)
  global.__ntuQuery.renderDistance = '1'
  assert.equal(helper.applyNtuMapPerformanceDefaults(), 1, 'A lower explicit preview distance is respected')
  delete global.__ntuQuery.renderDistance
  for (const key of Object.keys(global.__ntuSavedSettings)) delete global.__ntuSavedSettings[key]
  const registry = req('minecraft-data')(scene.version)
  const normalizePalette = helper.createSingaporePaletteNormalizer(registry)
  const paletteFixtures = [
    { name: 'grass_block', explicit: {}, expected: { snowy: false } },
    { name: 'stone_brick_stairs', explicit: { facing: 'east' }, expected: { facing: 'east', waterlogged: false, half: 'bottom', shape: 'straight' } },
    { name: 'stone_brick_stairs', explicit: { waterlogged: 'true', half: 'top', shape: 'outer_left' }, expected: { waterlogged: true, half: 'top', shape: 'outer_left' } },
    { name: 'grass_block', explicit: { snowy: 'true' }, expected: { snowy: true } }
  ]
  for (const fixture of paletteFixtures) {
    const entry = { Name: { type: 'string', value: `minecraft:${fixture.name}` } }
    if (Object.keys(fixture.explicit).length) entry.Properties = { type: 'compound', value: Object.fromEntries(Object.entries(fixture.explicit).map(([key, value]) => [key, { type: 'string', value }])) }
    const tag = { type: 'compound', name: '', value: { sections: { type: 'list', value: { type: 'compound', value: [{ block_states: { type: 'compound', value: { palette: { type: 'list', value: { type: 'compound', value: [entry] } } } } }] } } } }
    normalizePalette(tag)
    const palette = req('prismarine-nbt').simplify(tag).sections[0].block_states.palette
    const fixtureChunk = new (req('prismarine-chunk')(scene.version))()
    fixtureChunk.loadSection(0, { palette, bitsPerBlock: 0 }, { palette: ['plains'], bitsPerBiome: 0 })
    const decoded = fixtureChunk.getBlock(new (req('vec3').Vec3)(0, 0, 0))
    for (const [key, value] of Object.entries(fixture.expected)) assert.equal(decoded.getProperties()[key], value, `${fixture.name}: ${key}`)
    const normalized = JSON.stringify(tag)
    normalizePalette(tag)
    assert.equal(JSON.stringify(tag), normalized, 'Completing palette defaults is idempotent')
  }
  await helper.loadSingaporeMap({ indexUrl: './index.json' })
  assert.equal(helper.getSingaporeScene().version, scene.version)
  assert.equal(global.__ntuLevel.value.Data.value.Player, undefined)
  assert.equal(global.__ntuLevel.value.Data.value.Version.value.Name.value, scene.version)
  assert.equal(global.__ntuConnectOptions.serverOverridesFlat.savingInterval, 0)
  assert.equal(global.__ntuOptions.disableLoadPrompts, false)
  assert.equal(global.__ntuFsState.isReadonly, true)
  assert.equal(bfs.BFSRequire('fs').getRootFS()._getFs('/data').mountPoint, '/data', 'Existing storage mounts survive')

  const originalLoad = Module._load
  let Anvil
  try {
    Module._load = function (request, parent, ...rest) {
      if (request === 'fs' && parent?.filename.includes('prismarine-provider-anvil')) return browserFs
      return originalLoad.call(this, request, parent, ...rest)
    }
    Anvil = req('prismarine-provider-anvil').Anvil(scene.version)
  } finally {
    Module._load = originalLoad
  }
  provider = new Anvil('/world/region')
  const World = req('prismarine-world')(scene.version)
  const server = new EventEmitter()
  server.overworld = new World(null, provider, 0)
  server.pluginsReady = true
  server.cleanupFunctions = []
  let decorations = 0
  helper.installSingaporeMap(server, {
    maxCachedRegions: 2,
    decorateChunk (chunk) { chunk.__testDecoration = ++decorations }
  })
  server.overworld.chunkGenerator = server.overworldGeneratorOverride
  const chunkX = Math.floor(scene.spawn.x / 16)
  const chunkZ = Math.floor(scene.spawn.z / 16)
  const simultaneous = await Promise.all([[chunkX, chunkZ], [chunkX + 1, chunkZ], [chunkX, chunkZ + 1]]
    .map(([x, z]) => server.overworld.getColumn(x, z)))
  assert(simultaneous.every(chunk => chunk?.__testDecoration))
  const { Vec3 } = req('vec3')
  const tropicalChunk = await provider.load(94, 139)
  const tropicalGrass = tropicalChunk.getBlock(new Vec3(15, -32, 0))
  assert.equal(tropicalGrass.name, 'grass_block', 'Real published palette fixture still identifies campus grass')
  assert.equal(tropicalGrass.getProperties().snowy, false, 'Actual HTTP/Anvil loading must not turn omitted defaults into snowy grass')
  const ground = simultaneous[0].getBlock(new Vec3(Math.floor(scene.spawn.x) & 15, scene.spawn.y - 1, Math.floor(scene.spawn.z) & 15))
  assert.notEqual(ground.name, 'air', 'Published spawn must have solid ground')
  for (const station of scene.stations) {
    const point = station.approach
    const chunk = await server.overworld.getColumn(Math.floor(point.x / 16), Math.floor(point.z / 16))
    const local = new Vec3(Math.floor(point.x) & 15, point.y, Math.floor(point.z) & 15)
    assert.equal(chunk.getBlock(local).boundingBox, 'empty', `${station.id} approach must have footroom`)
    assert.equal(chunk.getBlock(local.offset(0, 1, 0)).boundingBox, 'empty', `${station.id} approach must have headroom`)
    assert.equal(chunk.getBlock(local.offset(0, -1, 0)).boundingBox, 'block', `${station.id} approach must have solid ground`)
  }
  const regionFiles = Object.keys(mapIndex.region)
  for (const filename of regionFiles) {
    const [, x, z] = /^r\.(-?\d+)\.(-?\d+)\.mca$/.exec(filename)
    await provider.load(Number(x) * 32 + 16, Number(z) * 32 + 16)
    assert(Object.keys(provider.regions).length <= 2, 'Idle region handles respect the configured cache bound')
  }
  const uncached = regionFiles.find(filename => !provider.regions[`/world/region/${filename}`])
  assert(uncached, 'Fixture must cover more than two regions')
  failurePath = `/region/${uncached}`
  const [, failedX, failedZ] = /^r\.(-?\d+)\.(-?\d+)\.mca$/.exec(uncached)
  await assert.rejects(provider.load(Number(failedX) * 32 + 16, Number(failedZ) * 32 + 16), 'Network failures must remain visible')
  failurePath = ''
  assert(await server.overworld.getColumn(32000, 32000), 'An unpublished region uses an empty fallback')
  assert.equal(server.overworld.savingQueue.size, 0)
  const previousDecoration = simultaneous[0].__testDecoration
  server.overworld.unloadColumn(chunkX, chunkZ)
  assert.equal(server.overworld.getLoadedColumn(chunkX, chunkZ), undefined)
  const reloaded = await server.overworld.getColumn(chunkX, chunkZ)
  assert(reloaded.__testDecoration > previousDecoration, 'Decorations reapply after an unloaded column is read again')
  assert.equal(server.overworld.storageProvider, provider, 'Provider remains attached for column unloading')
  const resumed = new Event('pagehide')
  Object.defineProperty(resumed, 'persisted', { value: true })
  window.dispatchEvent(resumed)
  assert(await provider.load(chunkX, chunkZ), 'A cached page retains usable map handles')
  const finalRead = provider.load(chunkX + 1, chunkZ)
  assert.equal(server.cleanupFunctions.length, 1, 'Server shutdown owns map cleanup')
  server.cleanupFunctions[0]()
  const firstClose = provider.close()
  assert.equal(provider.close(), firstClose, 'Closing is idempotent')
  assert(await finalRead, 'An in-flight read finishes before its region handle closes')
  await firstClose
  assert.equal(Object.keys(provider.regions).length, 0)
  await assert.rejects(provider.load(chunkX, chunkZ), /map has closed/)
  console.log(JSON.stringify({
    result: 'PASS', version: scene.version, spawnGround: ground.name,
    simultaneousChunks: simultaneous.length, safeApproaches: scene.stations.length,
    regionsChecked: regionFiles.length, maxRetainedRegions: 2,
    networkErrorsVisible: true, outsideFallback: true, dirtyQueue: 0, safeShutdown: true, httpReads
  }))
}

run().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  await provider?.close()
  web.close()
  fs.rmSync(temporaryDirectory, { recursive: true, force: true })
})
