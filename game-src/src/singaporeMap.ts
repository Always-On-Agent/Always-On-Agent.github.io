import fs from 'fs'
import * as browserfs from 'browserfs'
import * as nbt from 'prismarine-nbt'
import { gzip } from 'node-gzip'
import { Vec3 } from 'vec3'
import type HTTPRequest from 'browserfs/dist/node/backend/HTTPRequest'
import type MountableFileSystem from 'browserfs/dist/node/backend/MountableFileSystem'
import { appQueryParams } from './appParams'
import { fsState, loadSave } from './loadSave'
import { options, qsOptions, serverChangedSettings } from './optionsStorage'
import { appStorage } from './react/appStorageProvider'
import { loadHallPrototype } from './ntuHallPrototype'
import { isNtuMapRebuild, ntuMapAsset } from './ntuMapLocal'

export type SingaporePosition = { x: number, y: number, z: number }
export type SingaporeApproach = SingaporePosition & { yaw: number }
export type SingaporeScene = {
  version: '1.21.1' | '1.21.4'
  bbox: [number, number, number, number]
  origin: { lat: number, lon: number }
  scale: number
  architectureOffset?: SingaporePosition
  tourStops?: Array<{ id: string; name: { en: string; zh: string }; position: SingaporePosition; mapPosition?: SingaporePosition; approach: SingaporeApproach }>
  spawn: SingaporeApproach
  stations: Array<{
    id: 'plaza' | 'library' | 'return' | 'meetup'
    name: { en: string, zh: string }
    position: SingaporePosition
    approach: SingaporeApproach
  }>
}
type FileIndex = { [name: string]: FileIndex | null }
type ChunkDecorator = (chunk: any, chunkX: number, chunkZ: number) => void
type SingaporeInstallOptions = { decorateChunk?: ChunkDecorator, maxCachedRegions?: number }

const WORLD_PATH = '/world'
const DATA_VERSIONS = { '1.21.1': 3955, '1.21.4': 4189 } as const
const rootCredentials = { uid: 0, gid: 0, suid: 0, sgid: 0, euid: 0, egid: 0 }
let currentScene: SingaporeScene | undefined
let httpWorld: HTTPRequest | undefined
const installed = new WeakSet<object>()

/** Available after loadSingaporeMap has fetched and validated scene.json. */
export function getSingaporeScene (): SingaporeScene {
  if (!currentScene) throw new Error('The NTU map metadata has not loaded yet.')
  return currentScene
}

const isObject = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value)
const isPosition = (value: any) => isObject(value) && ['x', 'y', 'z'].every(key => Number.isFinite(value[key]))
const isApproach = (value: any) => isPosition(value) && Number.isFinite(value.yaw)

/** Scene defaults stay out of saved preferences; explicit visitor settings win. */
export function applyNtuMapPerformanceDefaults () {
  const explicit = { ...appStorage.changedSettings, ...qsOptions }
  const assignDefault = (key: 'renderDistance' | 'rendererWorldPerformance' | 'keepChunksDistance', value: any) => {
    if (Object.hasOwn(explicit, key)) return
    serverChangedSettings.value.add(key)
    Object.assign(options, { [key]: value })
  }
  assignDefault('renderDistance', 2)
  assignDefault('rendererWorldPerformance', 'low-energy')
  assignDefault('keepChunksDistance', 0)
  // Also accept the simple URL parameter used by the local preview links.
  const requested = Number(appQueryParams.renderDistance)
  const distance = Number.isFinite(requested) && requested >= 1 ? requested : options.renderDistance
  options.renderDistance = Math.max(1, Math.min(32, Math.floor(Number.isFinite(distance) ? distance : 2)))
  return options.renderDistance
}

function validateScene (value: unknown): asserts value is SingaporeScene {
  if (!isObject(value) || !Object.hasOwn(DATA_VERSIONS, value.version)
    || !Array.isArray(value.bbox) || value.bbox.length !== 4 || !value.bbox.every(Number.isFinite)
    || !isObject(value.origin) || !Number.isFinite(value.origin.lat) || !Number.isFinite(value.origin.lon)
    || !(value.scale > 0) || !isApproach(value.spawn) || !Array.isArray(value.stations)) {
    throw new Error('The NTU scene metadata is missing its version, extent, or safe spawn.')
  }
  const ids = new Set<string>()
  for (const station of value.stations) {
    if (!isObject(station) || !['plaza', 'library', 'return', 'meetup'].includes(station.id)
      || ids.has(station.id) || !isPosition(station.position) || !isApproach(station.approach)
      || !isObject(station.name) || typeof station.name.en !== 'string' || typeof station.name.zh !== 'string') {
      throw new Error('An NTU station is missing its bilingual name or safe approach.')
    }
    ids.add(station.id)
  }
  if (ids.size !== 4) throw new Error('The NTU scene must define its four demo stations.')
}

function validateIndex (value: unknown): asserts value is FileIndex {
  if (!isObject(value)) throw new Error('The world index must contain directories and null file leaves.')
  for (const [name, item] of Object.entries(value)) {
    if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\') || name === '__proto__') {
      throw new Error('The world index contains an invalid file name.')
    }
    if (item !== null) validateIndex(item)
  }
}

async function fetchJson (url: URL) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`Could not load ${url.pathname}: HTTP ${response.status}`)
  return response.json()
}

/**
 * Arnis omits default-valued block properties from some Anvil palette entries.
 * prismarine-chunk interprets missing properties as the first state variant,
 * which can mean snowy grass or waterlogged stairs instead of the default.
 * Complete only missing properties before the named palette becomes state IDs.
 */
export function createSingaporePaletteNormalizer (registry: any) {
  const Block = require('prismarine-block')(registry)
  const defaults = new Map<string, Record<string, string>>()
  return (tag: any) => {
    const root = tag?.value?.Level?.value ?? tag?.value
    const sections = (root?.sections ?? root?.Sections)?.value?.value ?? []
    for (const section of sections) {
      const palette = (section.block_states?.value?.palette ?? section.Palette)?.value?.value ?? []
      for (const entry of palette) {
        const name = entry.Name?.value?.replace(/^minecraft:/, '')
        const definition = registry.blocksByName[name]
        if (!definition?.states?.length) continue
        if (!defaults.has(name)) {
          defaults.set(name, Object.fromEntries(Object.entries(Block.fromStateId(definition.defaultState, 0).getProperties())
            .map(([key, value]) => [key, String(value)])))
        }
        entry.Properties ??= { type: 'compound', value: {} }
        for (const [key, value] of Object.entries(defaults.get(name)!)) {
          if (!Object.hasOwn(entry.Properties.value, key)) entry.Properties.value[key] = { type: 'string', value }
        }
      }
    }
    return tag
  }
}

/**
 * Mount a static Anvil directory and enter the existing singleplayer pipeline.
 * The host must wait for fsReady and call installSingaporeMap immediately after
 * startLocalServer, instead of installing either procedural demo generator.
 * Index format: {"level.dat":null,"region":{"r.0.0.mca":null},"playerdata":{}}.
 */
export async function loadSingaporeMap ({ indexUrl = ntuMapAsset('index.json'), sceneUrl }: { indexUrl?: string, sceneUrl?: string } = {}) {
  if (httpWorld) throw new Error('The NTU map is already mounted; change scenes by reloading the game frame.')
  const indexLocation = new URL(indexUrl, window.location.href)
  const sceneLocation = new URL(sceneUrl ?? 'scene.json', sceneUrl ? window.location.href : indexLocation)
  const [descriptor, scene] = await Promise.all([fetchJson(indexLocation), fetchJson(sceneLocation)])
  validateScene(scene)
  scene.tourStops = scene.tourStops?.map(stop => ({
    ...stop,
    position: stop.mapPosition ?? stop.position,
    ...(isNtuMapRebuild() && stop.id === 'ntumap-place-8baec8760caf' ? {
      name: { en: 'S-Lab / MMLab · ABN Level 2', zh: 'S-Lab / MMLab · ABN 二楼' },
      aliases: ['S-Lab', 'S Lab', 'SLab', 'MMLab', 'MMLab@NTU', '刘子纬', 'Ziwei Liu', 'ABN-02B-11'],
      mapVisible: true,
      navigationNote: { en: 'Outdoor arrival near ABN. S-Lab is listed at ABN-02B-11, Level 2; its interior and exact entrance have not been reconstructed.', zh: '到达 ABN 附近已检查的室外落点。S-Lab 标为 ABN-02B-11、二楼；尚未重建室内或确认具体入口。' }
    } : {})
  }))
  const prototype = await loadHallPrototype()
  if (prototype) {
    const { placement } = prototype
    const baseline = new URLSearchParams(window.location.search).get('prototypeView') === 'baseline'
    const spawn = baseline ? placement.baselineSpawn ?? placement.spawn : placement.spawn
    scene.spawn = { ...spawn, yaw: spawn.yaw ?? 0 }
    const stops = baseline && placement.baselineTourStops ? placement.baselineTourStops
      : [placement.tourStop, ...(placement.tourStops ?? [])].filter((stop): stop is NonNullable<typeof stop> => !!stop && (!baseline || !stop.prototypeOnly))
    scene.tourStops = [...stops, ...(scene.tourStops ?? []).filter(stop => !stops.some(value => value.id === stop.id))]
  }
  const index = descriptor.index ?? descriptor
  validateIndex(index)
  if (!Object.hasOwn(index, 'level.dat') || index['level.dat'] !== null || !isObject(index.region)) {
    throw new Error('The NTU world index must list level.dat and the region directory.')
  }
  const baseUrl = new URL(descriptor.baseUrl ?? './', indexLocation).href
  const root = browserfs.BFSRequire('fs').getRootFS() as MountableFileSystem | null
  if (root?.getName() !== 'MountableFileSystem') throw new Error('The client filesystem is not ready for the NTU map.')
  const mounted = await new Promise<HTTPRequest>((resolve, reject) => {
    browserfs.FileSystem.HTTPRequest.Create({ index, baseUrl }, (error, filesystem) => {
      if (error || !filesystem) reject(error ?? new Error('Could not mount the NTU world.'))
      else resolve(filesystem)
    })
  })
  root.mount(WORLD_PATH, mounted, rootCredentials)
  try {
    // Arnis' template and chunk versions may differ. Load the declared template
    // version; the modern Anvil reader resolves each chunk's named block palette.
    const { parsed } = await nbt.parse(Buffer.from(await fs.promises.readFile(`${WORLD_PATH}/level.dat`)))
    const data = (parsed as any).value.Data.value
    if (data.DataVersion?.value !== DATA_VERSIONS[scene.version]) {
      throw new Error(`NTU level.dat does not match the declared Minecraft ${scene.version} format.`)
    }
    if (appQueryParams.mapVersion && appQueryParams.mapVersion !== scene.version) {
      throw new Error(`This NTU map requires mapVersion=${scene.version}; remove the conflicting mapVersion parameter.`)
    }
    // Only the in-memory copy changes. Avoid restoring an exporter's player data
    // or triggering the upstream version prompt for a template missing Version.
    delete data.Player
    data.Version = { type: 'compound', value: {
      Name: { type: 'string', value: scene.version },
      Id: { type: 'int', value: DATA_VERSIONS[scene.version] },
      Snapshot: { type: 'byte', value: 0 }
    } }
    for (const axis of ['x', 'y', 'z'] as const) data[`Spawn${axis.toUpperCase()}`] = { type: 'int', value: Math.floor(scene.spawn[axis]) }
    mounted.preloadFile('/level.dat', await gzip(nbt.writeUncompressed(parsed)))
    Object.assign(fsState, { saveLoaded: false, isReadonly: true, syncFs: false, inMemorySave: false, remoteBackend: true })
    currentScene = scene
    httpWorld = mounted
    const oldDisablePrompts = options.disableLoadPrompts
    options.disableLoadPrompts = true
    const campusViewDistance = isNtuMapRebuild() ? applyNtuMapPerformanceDefaults()
      : window.matchMedia?.('(pointer: coarse)').matches ? 3 : 5
    options.renderDistance = campusViewDistance
    try {
      await loadSave(WORLD_PATH, {
        ignoreQs: true,
        serverOverridesFlat: {
          worldFolder: WORLD_PATH, version: scene.version, versionMajor: '1.21', worldSaveVersion: scene.version,
          generation: { name: 'empty', options: {} }, gameMode: 2, difficulty: 0,
          'view-distance': campusViewDistance, 'max-entities': 0, savingInterval: 0, noWarpsLoad: true
        }
      })
    } finally {
      options.disableLoadPrompts = oldDisablePrompts
    }
    return scene
  } catch (error) {
    currentScene = undefined
    httpWorld = undefined
    root.umount(WORLD_PATH, rootCredentials)
    mounted.empty()
    throw error
  }
}

/**
 * Read-only storage stays attached: flying-squid only unloads distant columns
 * when a provider exists. Decorations are applied on every reload of a column.
 * HTTPRequest downloads complete region files, not byte-range chunk requests.
 */
export function installSingaporeMap (server: any, { decorateChunk, maxCachedRegions = 4 }: SingaporeInstallOptions = {}) {
  if (installed.has(server)) return
  installed.add(server)
  const scene = getSingaporeScene()
  const Chunk = require('prismarine-chunk')(scene.version)
  server.spawnPoint = new Vec3(scene.spawn.x, scene.spawn.y, scene.spawn.z)
  server.time = 6000
  server.doDaylightCycle = false
  server.overworldGeneratorOverride = (chunkX: number, chunkZ: number) => {
    const chunk = new Chunk({ minY: -64, worldHeight: 384 })
    decorateChunk?.(chunk, chunkX, chunkZ)
    return chunk
  }
  const configure = () => {
    const world = server.overworld
    const provider = world?.storageProvider
    if (!provider) throw new Error('The NTU map requires an Anvil storage provider.')
    server.spawnPoint = new Vec3(scene.spawn.x, scene.spawn.y, scene.spawn.z)
    server.time = 6000
    server.doDaylightCycle = false
    world.stopSaving()
    world.savingInterval = 0
    world.savingQueue.clear()
    world.queueSaving = () => {}
    for (const [key, { chunkX, chunkZ }] of world.unloadQueue.entries()) world.forceUnloadColumn(key, chunkX, chunkZ)
    provider.save = async () => {}

    const active = new Map<string, number>()
    const pending = new Map<string, Promise<any>>()
    const loads = new Set<Promise<any>>()
    const recent = new Map<string, true>()
    let closing = false
    let closed: Promise<void> | undefined
    const cacheLimit = Math.max(1, Math.floor(maxCachedRegions))
    const getRegion = provider.getRegion.bind(provider)
    const load = provider.load.bind(provider)
    const loadRaw = provider.loadRaw.bind(provider)
    const normalizePalette = createSingaporePaletteNormalizer(require('minecraft-data')(scene.version))
    provider.loadRaw = async (x: number, z: number) => normalizePalette(await loadRaw(x, z))
    // Anvil inserts a region handle before initialize() completes. Share that
    // promise so simultaneous neighboring chunk reads cannot use a partial file.
    provider.getRegion = (x: number, z: number) => {
      const key = provider.regionFileName(x, z)
      if (!pending.has(key)) {
        const promise = getRegion(x, z).catch((error: Error) => {
          delete provider.regions[key]
          throw error
        }).finally(() => pending.delete(key))
        pending.set(key, promise)
      }
      return pending.get(key)
    }
    const trimCache = async () => {
      for (const key of recent.keys()) {
        if (Object.keys(provider.regions).length <= cacheLimit) break
        if (active.get(key) || pending.has(key)) continue
        const region = provider.regions[key]
        delete provider.regions[key]
        recent.delete(key)
        await region?.file?.close()
      }
    }
    const loadColumn = async (chunkX: number, chunkZ: number) => {
      const key = provider.regionFileName(chunkX, chunkZ)
      active.set(key, (active.get(key) ?? 0) + 1)
      try {
        const chunk = await load(chunkX, chunkZ)
        if (chunk) decorateChunk?.(chunk, chunkX, chunkZ)
        return chunk
      } catch (error) {
        // A request past the published extent uses an empty fallback column.
        // Network and malformed-chunk errors remain visible instead of silently
        // replacing valid campus geography with invented terrain.
        if (error.code === 'ENOENT') return null
        throw error
      } finally {
        const remaining = (active.get(key) ?? 1) - 1
        if (remaining) active.set(key, remaining)
        else active.delete(key)
        recent.delete(key)
        if (provider.regions[key]) recent.set(key, true)
        // Open Anvil handles keep their buffers; release duplicate filesystem
        // cache references so evicting a region really frees its downloaded data.
        httpWorld?.empty()
        await trimCache()
      }
    }
    provider.load = (chunkX: number, chunkZ: number) => {
      if (closing) return Promise.reject(new Error('The NTU map has closed.'))
      const task = loadColumn(chunkX, chunkZ)
      loads.add(task)
      void task.then(() => loads.delete(task), () => loads.delete(task))
      return task
    }
    provider.close = () => {
      if (closed) return closed
      closing = true
      closed = (async () => {
        // Region reads use live file handles. Finish them before closing those
        // handles, including reads already started when a visitor disconnects.
        await Promise.allSettled([...loads])
        const regions = Object.values(provider.regions) as Array<{ file?: { close: () => Promise<void> } }>
        provider.regions = {}
        recent.clear()
        httpWorld?.empty()
        await Promise.all(regions.map(region => region.file?.close()))
      })()
      window.removeEventListener('pagehide', onPageHide)
      return closed
    }
    const closeQuietly = () => {
      void provider.close().catch((error: Error) => console.warn('Could not close NTU map regions', error))
    }
    const onPageHide = (event: PageTransitionEvent) => {
      // A page retained in the back/forward cache will resume with this provider.
      if (event.persisted) return
      httpWorld?.empty()
      closeQuietly()
    }
    server.cleanupFunctions?.push(closeQuietly)
    window.addEventListener('pagehide', onPageHide)
  }
  if (server.pluginsReady) configure()
  else server.once('pluginsReady', configure)
}
