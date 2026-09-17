import { Vec3 } from 'vec3'

type Point = [number, number]
type Position = { x: number, y: number, z: number }
type LocationLike = { hostname: string, search: string }
type Bounds = { min: [number, number, number], max: [number, number, number] }
type HallCameraPosition = Position & { yaw?: number, pitch?: number }
export type HallPrototypeTourStop = {
  id: string
  name: { en: string, zh: string }
  position: Position
  approach: Position & { yaw: number }
  prototypeOnly?: boolean
}
export type HallPrototypeVoxels = {
  version: 1
  voxelSize: 1
  palette: string[]
  bounds: Bounds
  columns: Array<[number, number, Array<[number, number]>]>
  metadata?: unknown
}
export type HallClearRegion = { minY: number, maxY: number, footprint: Point[] }
export type HallPrototypePlacement = {
  version?: 1
  origin: Position
  quarterTurns: 0 | 1 | 2 | 3
  /** All clearance coordinates are local, including the inclusive Y range. */
  clearRegions?: HallClearRegion[]
  clearance?: { minY: number, maxY: number, footprints: Point[][] }
  /** Explicit foundation/walk repairs; applied after clearance, before voxels. */
  groundPatches?: Array<HallClearRegion & { block: string }>
  /** Camera positions are already in world coordinates. */
  spawn: HallCameraPosition
  baselineSpawn?: HallCameraPosition
  tourStop?: HallPrototypeTourStop
  tourStops?: HallPrototypeTourStop[]
  baselineTourStops?: HallPrototypeTourStop[]
  metadata?: unknown
}
export type LoadedHallPrototype = { voxels: HallPrototypeVoxels, placement: HallPrototypePlacement }

const PREFIX = 'Hall 3 / Hall 16 local prototype'
const WORLD_MIN_Y = -64
const WORLD_MAX_Y = 319
const ASSET_DIRECTORY = './local-ntu-assets/'
let loadedHallPrototype: LoadedHallPrototype | undefined

/** The opt-in is deliberately unavailable on a hosted deployment. */
export function isHallPrototype (where: LocationLike | undefined = globalThis.location): boolean {
  if (!where || !['localhost', '127.0.0.1', '::1', '[::1]'].includes(where.hostname.toLowerCase())) return false
  return new URLSearchParams(where.search).get('campusPrototype') === 'hall3-16'
}

export function getLoadedHallPrototype (): LoadedHallPrototype | undefined {
  return loadedHallPrototype
}

function invalid (message: string): never { throw new Error(`${PREFIX}: ${message}`) }
const isRecord = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value)
const isInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value)
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isPosition = (value: unknown): value is Position => isRecord(value) && ['x', 'y', 'z'].every(axis => isFiniteNumber(value[axis]))

function validateRegion (value: unknown, description: string) {
  if (!isRecord(value) || !isInteger(value.minY) || !isInteger(value.maxY) || value.minY > value.maxY) invalid(`${description} needs an ordered, integer minY/maxY range.`)
  const ring = value.footprint
  if (!Array.isArray(ring) || ring.length < 3 || ring.length > 10_000 || ring.some(point => !Array.isArray(point) || point.length !== 2 || !point.every(isFiniteNumber))) invalid(`${description}.footprint must contain at least three finite [x,z] points.`)
  let area = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  if (Math.abs(area) < 0.001) invalid(`${description}.footprint has no area.`)
}

function regionsFor (placement: HallPrototypePlacement): HallClearRegion[] {
  const regions = [...(placement.clearRegions ?? [])]
  if (placement.clearance) regions.push(...placement.clearance.footprints.map(footprint => ({ footprint, minY: placement.clearance!.minY, maxY: placement.clearance!.maxY })))
  return regions
}

function validateAssets (rawVoxels: unknown, rawPlacement: unknown): LoadedHallPrototype {
  if (!isRecord(rawVoxels) || rawVoxels.version !== 1 || rawVoxels.voxelSize !== 1) invalid('hall3-16-voxels.json must use version 1 and one-metre voxels (voxelSize: 1).')
  const { palette, bounds, columns } = rawVoxels
  if (!Array.isArray(palette) || palette.length === 0 || palette.length > 4096 || palette.some(name => typeof name !== 'string' || !/^[a-z\d_]+$/.test(name))) invalid('hall3-16-voxels.json has an invalid Minecraft block palette.')
  if (new Set(palette).size !== palette.length) invalid('hall3-16-voxels.json has duplicate palette entries.')
  if (!isRecord(bounds) || !['min', 'max'].every(key => Array.isArray(bounds[key]) && bounds[key].length === 3 && bounds[key].every(isInteger)) || bounds.min.some((n, axis) => n > bounds.max[axis])) invalid('hall3-16-voxels.json needs inclusive integer bounds.min/bounds.max arrays.')
  if (!Array.isArray(columns) || columns.length === 0 || columns.length > 1_000_000) invalid('hall3-16-voxels.json needs a nonempty columns array.')
  const seen = new Set<string>()
  let voxelCount = 0
  for (const column of columns) {
    if (!Array.isArray(column) || column.length !== 3 || !isInteger(column[0]) || !isInteger(column[1]) || !Array.isArray(column[2]) || column[2].length === 0) invalid('Each voxel column must be [x,z,[[y,paletteIndex],...]].')
    const [x, z, cells] = column
    const key = `${x},${z}`
    if (seen.has(key)) invalid(`Duplicate voxel column at ${key}.`)
    seen.add(key)
    if (x < bounds.min[0] || x > bounds.max[0] || z < bounds.min[2] || z > bounds.max[2]) invalid(`Voxel column ${key} lies outside declared bounds.`)
    const heights = new Set<number>()
    for (const cell of cells) {
      if (!Array.isArray(cell) || cell.length !== 2 || !cell.every(isInteger) || cell[1] < 0 || cell[1] >= palette.length) invalid(`Invalid [y,paletteIndex] in voxel column ${key}.`)
      if (cell[0] < bounds.min[1] || cell[0] > bounds.max[1]) invalid(`Voxel at ${key},y=${cell[0]} lies outside declared bounds.`)
      if (heights.has(cell[0])) invalid(`Duplicate voxel at ${key},y=${cell[0]}.`)
      heights.add(cell[0])
    }
    voxelCount += cells.length
    if (voxelCount > 5_000_000) invalid('Voxel asset exceeds the five-million-block local prototype limit.')
  }
  if (!isRecord(rawPlacement) || (rawPlacement.version !== undefined && rawPlacement.version !== 1)) invalid('placement.json must be a version 1 placement object.')
  const { origin, quarterTurns } = rawPlacement
  if (!isPosition(origin) || !Object.values(origin).every(isInteger)) invalid('placement.json origin must contain integer x, y and z coordinates.')
  if (![0, 1, 2, 3].includes(quarterTurns)) invalid('placement.json quarterTurns must be 0, 1, 2 or 3; bake other rotations into the voxel asset.')
  for (const key of ['spawn', ...(rawPlacement.baselineSpawn === undefined ? [] : ['baselineSpawn'])]) {
    const camera = rawPlacement[key]
    if (!isPosition(camera) || ['yaw', 'pitch'].some(axis => camera[axis] !== undefined && !isFiniteNumber(camera[axis]))) invalid(`placement.json ${key} must contain finite world x, y and z coordinates.`)
  }
  for (const key of ['tourStops', 'baselineTourStops']) {
    if (rawPlacement[key] !== undefined && !Array.isArray(rawPlacement[key])) invalid(`placement.json ${key} must be an array.`)
  }
  for (const stops of [[...(rawPlacement.tourStop === undefined ? [] : [rawPlacement.tourStop]), ...(rawPlacement.tourStops ?? [])], rawPlacement.baselineTourStops ?? []]) {
    const stopIds = new Set<string>()
    for (const stop of stops) {
      if (!isRecord(stop) || typeof stop.id !== 'string' || !stop.id || stopIds.has(stop.id) || !isRecord(stop.name)
        || typeof stop.name.en !== 'string' || typeof stop.name.zh !== 'string' || !isPosition(stop.position)
        || !isFiniteNumber(stop.approach?.yaw) || !isPosition(stop.approach)
        || (stop.prototypeOnly !== undefined && typeof stop.prototypeOnly !== 'boolean')) invalid('placement.json tour stops need unique IDs, bilingual names, world positions, approaches with yaw, and an optional boolean prototypeOnly flag.')
      stopIds.add(stop.id)
    }
  }
  if (rawPlacement.clearRegions !== undefined) {
    if (!Array.isArray(rawPlacement.clearRegions)) invalid('placement.json clearRegions must be an array.')
    for (const [i, region] of rawPlacement.clearRegions.entries()) validateRegion(region, `clearRegions[${i}]`)
  }
  if (rawPlacement.clearance !== undefined) {
    const c = rawPlacement.clearance
    if (!isRecord(c) || !Array.isArray(c.footprints)) invalid('placement.json clearance must contain a footprints array.')
    for (const [i, footprint] of c.footprints.entries()) validateRegion({ footprint, minY: c.minY, maxY: c.maxY }, `clearance.footprints[${i}]`)
  }
  if (rawPlacement.groundPatches !== undefined) {
    if (!Array.isArray(rawPlacement.groundPatches)) invalid('placement.json groundPatches must be an array.')
    for (const [i, patch] of rawPlacement.groundPatches.entries()) {
      validateRegion(patch, `groundPatches[${i}]`)
      if (typeof patch.block !== 'string' || !/^[a-z\d_]+$/.test(patch.block)) invalid(`groundPatches[${i}].block must name a Minecraft block.`)
    }
  }
  const placement = rawPlacement as HallPrototypePlacement
  const regions = regionsFor(placement)
  if (!regions.length) invalid('placement.json needs explicit geographic clearRegions or clearance.footprints; rectangular asset bounds are never cleared automatically.')
  for (const y of [bounds.min[1], bounds.max[1], ...[...regions, ...(placement.groundPatches ?? [])].flatMap(region => [region.minY, region.maxY])]) {
    if (y + origin.y < WORLD_MIN_Y || y + origin.y > WORLD_MAX_Y) invalid(`Placed Y=${y + origin.y} exceeds the supported world height (${WORLD_MIN_Y} to ${WORLD_MAX_Y}).`)
  }
  for (const axis of ['x', 'z']) if (Math.abs(origin[axis]) > 30_000_000) invalid('placement.json origin exceeds the Minecraft world boundary.')
  return { voxels: rawVoxels as HallPrototypeVoxels, placement }
}

/** Await this before starting the server. Neither asset is imported into a build. */
export async function loadHallPrototype (
  where: LocationLike | undefined = globalThis.location,
  fetchAsset: typeof fetch = globalThis.fetch
): Promise<LoadedHallPrototype | undefined> {
  loadedHallPrototype = undefined
  // Injection is useful for Node regression tests; it must never override a
  // real browser's public hostname or turn an ordinary visit into a prototype.
  if (!isHallPrototype(where) || (globalThis.location && !isHallPrototype(globalThis.location))) return undefined
  const read = async (name: string) => {
    let response: Response
    try {
      response = await fetchAsset(`${ASSET_DIRECTORY}${name}`, { cache: 'no-store', credentials: 'same-origin', redirect: 'error' })
    } catch (error) {
      invalid(`Cannot load ${name} from the loopback asset server: ${error instanceof Error ? error.message : String(error)}`)
    }
    if (!response!.ok) invalid(`Cannot load ${name} (HTTP ${response!.status}). Serve the local asset directory at ${ASSET_DIRECTORY}.`)
    try { return await response!.json() } catch { return invalid(`${name} is not valid JSON. Check that the asset route serves JSON instead of the application HTML.`) }
  }
  const [voxels, placement] = await Promise.all([read('hall3-16-voxels.json'), read('placement.json')])
  loadedHallPrototype = validateAssets(voxels, placement)
  return loadedHallPrototype
}

function rotate (x: number, z: number, quarterTurns: number): Point {
  switch (quarterTurns) {
    case 1: return [-z, x]
    case 2: return [-x, -z]
    case 3: return [z, -x]
    default: return [x, z]
  }
}

const insideFootprint = (x: number, z: number, ring: Point[]): boolean => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]; const b = ring[j]
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

/** Stamp actual chunk block states, so normal renderer and player collision agree. */
export function createHallPrototypeDecorator (data: any, loaded: LoadedHallPrototype) {
  const { voxels, placement } = validateAssets(loaded.voxels, loaded.placement)
  const air = data.blocksByName.air?.defaultState
  if (!isInteger(air)) invalid('The Minecraft registry has no air state.')
  const solidState = (name: string) => {
    const block = data.blocksByName[name]
    if (!block || !isInteger(block.defaultState)) invalid(`Minecraft ${data.version?.minecraftVersion ?? ''} has no block named "${name}".`)
    if (block.boundingBox !== 'block') invalid(`Block "${name}" has no solid collision; voxel cells and ground patches must use solid Minecraft blocks.`)
    return block.defaultState as number
  }
  const states = voxels.palette.map(solidState)
  type StampColumn = { x: number, z: number, cells: Array<[number, number]> }
  type WorldRegion = HallClearRegion & { minX: number, maxX: number, minZ: number, maxZ: number, state: number }
  type ChunkWork = { columns: StampColumn[], regions: WorldRegion[] }
  const workByChunk = new Map<string, ChunkWork>()
  const workAt = (cx: number, cz: number) => {
    const key = `${cx},${cz}`
    let work = workByChunk.get(key)
    if (!work) { work = { columns: [], regions: [] }; workByChunk.set(key, work) }
    return work
  }
  const { origin, quarterTurns } = placement
  for (const [x, z, cells] of voxels.columns) {
    const [rx, rz] = rotate(x, z, quarterTurns)
    const wx = origin.x + rx; const wz = origin.z + rz
    workAt(Math.floor(wx / 16), Math.floor(wz / 16)).columns.push({ x: wx, z: wz, cells })
  }
  let clearCandidates = 0
  const operations = [
    ...regionsFor(placement).map(region => ({ region, state: air })),
    ...(placement.groundPatches ?? []).map(region => ({ region, state: solidState(region.block) }))
  ]
  for (const { region, state } of operations) {
    // Voxel coordinates identify block cells. Rotate polygon edges around the
    // first cell's centre, keeping quarter turns aligned with those same cells.
    const footprint = region.footprint.map(([x, z]) => {
      const [rx, rz] = rotate(x - 0.5, z - 0.5, quarterTurns)
      return [origin.x + rx + 0.5, origin.z + rz + 0.5] as Point
    })
    const xs = footprint.map(p => p[0]); const zs = footprint.map(p => p[1])
    const worldRegion: WorldRegion = {
      footprint, state, minY: region.minY + origin.y, maxY: region.maxY + origin.y,
      minX: Math.floor(Math.min(...xs)), maxX: Math.ceil(Math.max(...xs)) - 1,
      minZ: Math.floor(Math.min(...zs)), maxZ: Math.ceil(Math.max(...zs)) - 1
    }
    clearCandidates += (worldRegion.maxX - worldRegion.minX + 1) * (worldRegion.maxZ - worldRegion.minZ + 1)
    if (clearCandidates > 2_000_000) invalid('Geographic clearance exceeds two million candidate columns; check the placement coordinate frame.')
    for (let cx = Math.floor(worldRegion.minX / 16); cx <= Math.floor(worldRegion.maxX / 16); cx++) {
      for (let cz = Math.floor(worldRegion.minZ / 16); cz <= Math.floor(worldRegion.maxZ / 16); cz++) workAt(cx, cz).regions.push(worldRegion)
    }
  }
  const decorated = new WeakSet<object>()
  const p = new Vec3(0, 0, 0)
  return (chunk: any, chunkX: number, chunkZ: number) => {
    if (decorated.has(chunk)) return
    const work = workByChunk.get(`${chunkX},${chunkZ}`)
    if (!work) return
    const changedColumns = new Set<number>()
    const minY = chunk.minY ?? WORLD_MIN_Y; const maxY = minY + (chunk.worldHeight ?? 384) - 1
    const put = (x: number, y: number, z: number, state: number) => {
      if (y < minY || y > maxY) invalid(`Chunk world height does not include placed Y=${y}.`)
      const lx = x - chunkX * 16; const lz = z - chunkZ * 16
      p.set(lx, y, lz)
      chunk.setBlockStateId(p, state)
      chunk.setBlockLight(p, data.blocksByStateId[state]?.emitLight ?? 0)
      changedColumns.add(lx * 16 + lz)
    }
    for (const region of work.regions) {
      for (let x = Math.max(chunkX * 16, region.minX); x <= Math.min(chunkX * 16 + 15, region.maxX); x++) {
        for (let z = Math.max(chunkZ * 16, region.minZ); z <= Math.min(chunkZ * 16 + 15, region.maxZ); z++) {
          if (!insideFootprint(x + 0.5, z + 0.5, region.footprint)) continue
          for (let y = region.minY; y <= region.maxY; y++) put(x, y, z, region.state)
        }
      }
    }
    for (const column of work.columns) for (const [y, paletteIndex] of column.cells) put(column.x, origin.y + y, column.z, states[paletteIndex])
    // Recompute direct skylight in changed columns, including newly opened sky
    // and the shadows below solid roofs. Terrain block states remain untouched.
    for (const key of changedColumns) {
      const lx = Math.floor(key / 16); const lz = key % 16
      let sky = 15
      for (let y = maxY; y >= minY; y--) {
        p.set(lx, y, lz)
        const block = data.blocksByStateId[chunk.getBlockStateId(p)]
        sky = Math.max(0, sky - (block?.filterLight ?? (block?.transparent ? 0 : 15)))
        chunk.setSkyLight(p, sky)
      }
    }
    decorated.add(chunk)
  }
}
