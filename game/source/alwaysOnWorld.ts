import { Vec3 } from 'vec3'

const loadChunk = require('prismarine-chunk')
const loadBlock = require('prismarine-block')
const loadData = require('minecraft-data')

export const ALWAYS_ON_SCENE = {
  seed: 271828,
  groundY: 4,
  spawn: { x: 0.5, y: 5, z: 27.5, yaw: 0 },
  home: { x: -17, y: 5, z: 13 },
  library: { x: 0, y: 5, z: -11 },
  libraryNotice: { x: 2, y: 6, z: -8 },
  libraryReturnPoint: { x: -3, y: 5, z: -6 },
  cafe: { x: 18, y: 5, z: 2 },
  returnPoint: { x: 15, y: 5, z: 2 },
  cafeNotice: { x: 16, y: 6, z: 4 },
  bridge: { x: 0, y: 5, z: -27 },
  plaza: { x: 0, y: 5, z: 5 }
} as const

type Position = { x: number, y: number, z: number }
type Voxel = Position & { state: number }
type ReturnResult = { ok: boolean, receiptId?: string, reason?: string }
type SceneRuntime = {
  visit: number
  ledger: Array<{ receiptId: string, playerId: number, item: string, visit: number, point: Position }>
  loans: Map<number, { bookId: string, returned: boolean }>
  resolve: (name: string, props?: Record<string, any>) => number
  generator: (x: number, z: number, options: any) => any
}
const runtimes = new WeakMap<object, SceneRuntime>()
const position = (p: Position) => new Vec3(p.x, p.y, p.z)

/** Original, deterministic village blueprint. Uses only named vanilla blocks. */
export function createAlwaysOnGenerator (version = '1.19.4') {
  const Chunk = loadChunk(version)
  const Block = loadBlock(version)
  const data = loadData(version)
  const stateCache = new Map<string, number>()
  const resolve = (name: string, props: Record<string, any> = {}) => {
    const key = name + JSON.stringify(props)
    if (stateCache.has(key)) return stateCache.get(key)!
    if (!data.blocksByName[name]) throw new Error(`Village block unavailable in ${version}: ${name}`)
    const state = Object.keys(props).length ? Block.fromProperties(name, props, 0).stateId : data.blocksByName[name].defaultState
    stateCache.set(key, state)
    return state
  }
  const columns = new Map<string, Map<string, Voxel>>()
  const put = (x: number, y: number, z: number, name: string, props?: Record<string, any>) => {
    const columnKey = `${Math.floor(x / 16)},${Math.floor(z / 16)}`
    if (!columns.has(columnKey)) columns.set(columnKey, new Map())
    columns.get(columnKey)!.set(`${x},${y},${z}`, { x, y, z, state: resolve(name, props) })
  }
  const box = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, name: string, props?: Record<string, any>) => {
    for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) for (let y = y1; y <= y2; y++) put(x, y, z, name, props)
  }
  const path = (x1: number, z1: number, x2: number, z2: number) => {
    for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) put(x, 4, z, (Math.abs(x * 13 + z * 7) % 11 === 0) ? 'mossy_stone_bricks' : 'stone_bricks')
  }
  const flowerBed = (x1: number, z1: number, x2: number, z2: number) => {
    for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) {
      put(x, 4, z, 'moss_block')
      put(x, 5, z, ['poppy', 'azure_bluet', 'oxeye_daisy', 'blue_orchid'][Math.abs(x + z) % 4])
    }
  }
  const tree = (x: number, z: number, height = 5, birch = false) => {
    box(x, 5, z, x, 4 + height, z, birch ? 'birch_log' : 'oak_log', { axis: 'y' })
    for (let y = height + 2; y <= height + 5; y++) {
      const radius = y === height + 5 ? 1 : 2
      for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > radius + 1 || (dx === 0 && dz === 0 && y <= 4 + height)) continue
        put(x + dx, y, z + dz, birch ? 'birch_leaves' : 'oak_leaves', { persistent: true, distance: 1, waterlogged: false })
      }
    }
  }
  const lamp = (x: number, z: number) => {
    put(x, 5, z, 'stone_brick_wall')
    box(x, 6, z, x, 8, z, 'dark_oak_fence')
    put(x, 9, z, 'sea_lantern')
    put(x, 10, z, 'dark_oak_slab', { type: 'bottom', waterlogged: false })
  }
  const bench = (x: number, z: number, facing: string) => {
    box(x, 5, z, x + 2, 5, z, 'spruce_stairs', { facing, half: 'bottom', shape: 'straight', waterlogged: false })
    put(x - 1, 5, z, 'spruce_trapdoor', { facing: 'east', half: 'bottom', open: true, powered: false, waterlogged: false })
    put(x + 3, 5, z, 'spruce_trapdoor', { facing: 'west', half: 'bottom', open: true, powered: false, waterlogged: false })
  }
  const building = (x: number, z: number, width: number, depth: number, wall: string, roof: string, facing: 'south' | 'west') => {
    box(x, 4, z, x + width - 1, 4, z + depth - 1, 'stone_bricks')
    box(x + 1, 4, z + 1, x + width - 2, 4, z + depth - 2, 'oak_planks')
    for (let y = 5; y <= 9; y++) {
      box(x, y, z, x + width - 1, y, z, wall)
      box(x, y, z + depth - 1, x + width - 1, y, z + depth - 1, wall)
      box(x, y, z, x, y, z + depth - 1, wall)
      box(x + width - 1, y, z, x + width - 1, y, z + depth - 1, wall)
    }
    for (const px of [x, x + width - 1]) for (const pz of [z, z + depth - 1]) box(px, 5, pz, px, 9, pz, 'stripped_spruce_log', { axis: 'y' })
    for (let wx = x + 2; wx < x + width - 2; wx += 4) for (const wz of [z, z + depth - 1]) box(wx, 6, wz, wx + 1, 7, wz, 'glass')
    for (let wz = z + 2; wz < z + depth - 2; wz += 4) for (const wx of [x, x + width - 1]) box(wx, 6, wz, wx, 7, wz + 1, 'glass')
    box(x, 9, z, x + width - 1, 9, z + depth - 1, 'spruce_planks')
    box(x + 1, 9, z + 1, x + width - 2, 9, z + depth - 2, 'birch_planks')
    for (let step = 0; step <= Math.floor(width / 2); step++) {
      const left = x - 1 + step
      const right = x + width - step
      for (let rz = z - 1; rz <= z + depth; rz++) {
        put(left, 10 + step, rz, roof, { facing: 'east', half: 'bottom', shape: 'straight', waterlogged: false })
        put(right, 10 + step, rz, roof, { facing: 'west', half: 'bottom', shape: 'straight', waterlogged: false })
      }
      if (right > left) for (const gz of [z, z + depth - 1]) box(left + 1, 10 + step, gz, right - 1, 10 + step, gz, wall)
    }
    const doorX = facing === 'south' ? Math.floor(x + width / 2) : x
    const doorZ = facing === 'south' ? z + depth - 1 : Math.floor(z + depth / 2)
    box(doorX, 5, doorZ, doorX, 7, doorZ, 'air')
    put(doorX, 8, doorZ, 'sea_lantern')
    // A readable opening avoids depending on vanilla door simulation.
    return { doorX, doorZ }
  }

  path(-2, -38, 2, 32)
  path(-23, 0, 27, 4)
  path(-19, 18, -15, 22)
  path(-17, 20, 0, 22)
  path(-7, -7, 7, -4)
  for (let x = -7; x <= 7; x++) for (let z = -1; z <= 13; z++) {
    const radius = Math.hypot(x, z - 6)
    if (radius < 7) put(x, 4, z, radius > 5.7 ? 'polished_andesite' : (x + z) % 2 === 0 ? 'smooth_stone' : 'stone_bricks')
  }
  // Fountain remains off the main walking axis.
  box(-10, 4, 5, -6, 4, 9, 'stone_bricks')
  box(-10, 5, 5, -6, 5, 9, 'stone_brick_slab', { type: 'bottom', waterlogged: false })
  box(-9, 5, 6, -7, 5, 8, 'water', { level: 0 })
  box(-8, 5, 7, -8, 7, 7, 'mossy_stone_bricks')
  put(-8, 8, 7, 'sea_lantern')

  building(-7, -20, 15, 13, 'smooth_sandstone', 'dark_prismarine_stairs', 'south')
  box(-5, 5, -19, 5, 7, -19, 'bookshelf')
  box(-6, 5, -18, -6, 7, -11, 'bookshelf')
  box(6, 5, -18, 6, 7, -11, 'bookshelf')
  box(-3, 5, -15, 3, 5, -14, 'spruce_planks')
  box(-3, 6, -15, 3, 6, -14, 'spruce_slab', { type: 'bottom', waterlogged: false })
  put(0, 7, -15, 'lantern', { hanging: false, waterlogged: false })
  put(2, 6, -8, 'orange_glazed_terracotta', { facing: 'south' })
  put(-3, 5, -6, 'chest', { facing: 'south', type: 'single', waterlogged: false })
  flowerBed(-7, -6, -5, -5)
  flowerBed(5, -6, 7, -5)

  building(16, -4, 11, 13, 'white_terracotta', 'brick_stairs', 'west')
  // Keep the entrance beside the return box, so the box never blocks entry.
  box(16, 5, 2, 16, 7, 2, 'white_terracotta')
  box(16, 5, 0, 16, 7, 0, 'air')
  put(16, 8, 0, 'sea_lantern')
  box(23, 5, -2, 25, 5, 6, 'spruce_planks')
  put(25, 6, -2, 'furnace', { facing: 'west', lit: false })
  put(25, 6, 0, 'brewing_stand')
  box(13, 4, -3, 15, 4, 8, 'bricks')
  for (let z = -2; z <= 7; z++) put(14, 9, z, z % 2 ? 'white_wool' : 'red_wool')
  put(15, 5, 2, 'chest', { facing: 'west', type: 'single', waterlogged: false })
  put(16, 6, 4, 'cyan_glazed_terracotta', { facing: 'west' })
  for (const z of [-1, 6]) {
    put(11, 5, z, 'oak_fence')
    put(11, 6, z, 'oak_pressure_plate', { powered: false })
    put(10, 5, z, 'spruce_stairs', { facing: 'east', half: 'bottom', shape: 'straight', waterlogged: false })
  }

  building(-23, 8, 13, 13, 'birch_planks', 'spruce_stairs', 'south')
  put(-21, 5, 10, 'crafting_table')
  put(-20, 5, 10, 'furnace', { facing: 'south', lit: false })
  box(-12, 5, 10, -12, 6, 14, 'bookshelf')
  put(-20, 5, 16, 'red_bed', { facing: 'north', part: 'foot', occupied: false })
  put(-20, 5, 15, 'red_bed', { facing: 'north', part: 'head', occupied: false })
  box(-23, 4, 21, -11, 4, 22, 'spruce_planks')
  flowerBed(-23, 23, -20, 23)
  flowerBed(-14, 23, -11, 23)
  // Low garden walls, crops and a second cottage frame the square.
  building(-25, -16, 9, 9, 'terracotta', 'spruce_stairs', 'south')
  path(-22, -7, -20, 2)
  box(18, 4, 15, 25, 4, 23, 'farmland', { moisture: 7 })
  box(21, 4, 15, 21, 4, 23, 'water', { level: 0 })
  for (let x = 18; x <= 25; x++) for (let z = 15; z <= 23; z++) if (x !== 21) put(x, 5, z, 'wheat', { age: Math.abs(x + z) % 3 + 5 })
  for (const x of [17, 26]) box(x, 5, 14, x, 5, 24, 'oak_fence')

  // River is shallow and crossed by a level bridge with clear headroom.
  box(-44, 2, -30, 44, 2, -25, 'gravel')
  box(-44, 3, -30, 44, 3, -25, 'water', { level: 0 })
  box(-44, 4, -30, 44, 4, -25, 'air')
  box(-2, 4, -31, 2, 4, -24, 'spruce_planks')
  for (const x of [-3, 3]) box(x, 5, -31, x, 5, -24, 'spruce_fence')
  for (const z of [-31, -24]) for (const x of [-3, 3]) put(x, 6, z, 'lantern', { hanging: false, waterlogged: false })
  for (const [x, z, h] of [[-31, 26, 6], [-30, 2, 5], [-31, -21, 6], [31, 24, 6], [31, 10, 5], [32, -13, 7], [14, -18, 5], [-12, 29, 5], [12, 29, 6], [-10, -38, 6], [11, -38, 6], [-34, -36, 7], [31, -36, 6], [38, 0, 6], [-37, 12, 6]]) tree(x, z, h, (x + z) % 2 === 0)
  for (const [x, z] of [[-4, 17], [4, 17], [-5, -3], [5, -3], [8, 3], [8, 12], [-16, 3], [28, 3]]) lamp(x, z)
  bench(3, 12, 'north')
  bench(3, -1, 'south')
  flowerBed(4, 20, 7, 22)
  flowerBed(-7, 24, -4, 26)

  const generator = (chunkX: number, chunkZ: number, options: any = {}) => {
    const minY = options.minY ?? -64
    const worldHeight = options.worldHeight ?? 384
    const chunk = new Chunk({ minY, worldHeight })
    const p = new Vec3(0, 0, 0)
    const grass = resolve('grass_block', { snowy: false })
    const dirt = resolve('dirt')
    const stone = resolve('stone')
    const bedrock = resolve('bedrock')
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
      const wx = chunkX * 16 + lx
      const wz = chunkZ * 16 + lz
      const distance = Math.max(Math.abs(wx), Math.abs(wz))
      // A quiet ring of hills bounds the authored village without an abrupt void.
      const hill = distance < 42 ? 0 : Math.max(0, Math.floor((Math.sin(wx * 0.09) + Math.cos(wz * 0.11) + 2) * Math.min(6, (distance - 42) / 4)))
      const top = 4 + hill
      p.x = lx
      p.z = lz
      for (let y = 0; y <= top; y++) {
        p.y = y
        chunk.setBlockStateId(p, y === 0 ? bedrock : y === top ? grass : y >= top - 2 ? dirt : stone)
      }
      for (let y = minY; y < minY + worldHeight; y++) {
        p.y = y
        chunk.setSkyLight(p, y > top ? 15 : 0)
      }
    }
    for (const voxel of columns.get(`${chunkX},${chunkZ}`)?.values() ?? []) {
      p.set(voxel.x - chunkX * 16, voxel.y, voxel.z - chunkZ * 16)
      chunk.setBlockStateId(p, voxel.state)
      chunk.setSkyLight(p, 15)
      if (data.blocksByStateId[voxel.state]?.emitLight) chunk.setBlockLight(p, data.blocksByStateId[voxel.state].emitLight)
    }
    return chunk
  }
  return { generator, resolve }
}

/** Call directly after startLocalServer, before its asynchronous world setup. */
export function installAlwaysOnWorld (server: any) {
  const { generator, resolve } = createAlwaysOnGenerator(server.version ?? server.options?.version ?? '1.19.4')
  server.spawnPoint = position(ALWAYS_ON_SCENE.spawn)
  server.overworldGeneratorOverride = generator
  server.time = 1000
  server.doDaylightCycle = false
  runtimes.set(server, { visit: 1, ledger: [], loans: new Map(), resolve, generator })
}

export async function setAlwaysOnVisit (server: any, visit: number) {
  const runtime = runtimes.get(server)
  if (!runtime || !server.overworld || !server.setBlock) return false
  const nextVisit = Math.max(1, Math.min(3, Math.floor(visit)))
  const edits = [
    { x: 0, y: 5, z: -8, name: nextVisit === 2 ? 'iron_bars' : 'air' },
    { x: 0, y: 6, z: -8, name: nextVisit === 2 ? 'iron_bars' : 'air' },
    { ...ALWAYS_ON_SCENE.libraryNotice, name: nextVisit === 2 ? 'orange_glazed_terracotta' : 'lime_glazed_terracotta' },
    { x: 16, y: 5, z: 0, name: nextVisit === 3 ? 'iron_bars' : 'air' },
    { x: 16, y: 6, z: 0, name: nextVisit === 3 ? 'iron_bars' : 'air' },
    { ...ALWAYS_ON_SCENE.cafeNotice, name: nextVisit === 3 ? 'orange_glazed_terracotta' : 'cyan_glazed_terracotta' }
  ]
  for (const edit of edits) await server.setBlock(server.overworld, position(edit), runtime.resolve(edit.name))
  runtime.visit = nextVisit
  server.time = nextVisit === 2 ? 9000 : 1000
  return true
}

const getPlayer = (server: any, username?: string) => server.players?.find((player: any) => !username || player.username === username)

/** Grant exactly one tracked book into the real server inventory for this visit. */
export function giveAlwaysOnBook (server: any, username?: string): ReturnResult {
  const runtime = runtimes.get(server)
  const player = getPlayer(server, username)
  if (!runtime || !player?.inventory || !server.PrismarineItem) return { ok: false, reason: 'not-ready' }
  const existingLoan = runtime.loans.get(player.id)
  if (existingLoan && !existingLoan.returned) return { ok: true, reason: 'already-borrowed' }
  const bookId = runtime.visit === 3 ? 'B18' : 'B17'
  if (existingLoan?.bookId === bookId && existingLoan.returned) return { ok: false, reason: 'already-returned' }
  const slot = player.inventory.slots[36] ? player.inventory.firstEmptyInventorySlot() : 36
  if (slot === null || slot === undefined || slot < 0) return { ok: false, reason: 'inventory-full' }
  const item = new server.PrismarineItem(server.mcData.itemsByName.book.id, 1)
  item.nbt = { type: 'compound', name: '', value: { AlwaysOnLoan: { type: 'string', value: bookId } } }
  player.inventory.updateSlot(slot, item)
  runtime.loans.set(player.id, { bookId, returned: false })
  return { ok: true }
}

/** Custom return-box transaction, since upstream has no persistent chest implementation. */
export async function transferAlwaysOnBook (server: any, username?: string): Promise<ReturnResult> {
  const runtime = runtimes.get(server)
  const player = getPlayer(server, username)
  if (!runtime || !player?.inventory) return { ok: false, reason: 'not-ready' }
  const loan = runtime.loans.get(player.id)
  if (!loan || loan.returned) return { ok: false, reason: loan?.returned ? 'already-returned' : 'no-loan' }
  const point = runtime.visit === 3 ? ALWAYS_ON_SCENE.libraryReturnPoint : ALWAYS_ON_SCENE.returnPoint
  if (player.position.distanceTo(position(point).offset(0.5, 0.5, 0.5)) > 4.5) return { ok: false, reason: 'too-far' }
  const block = await server.overworld.getBlock(position(point))
  if (block?.name !== 'chest') return { ok: false, reason: 'return-box-missing' }
  // Check again after the asynchronous block read, so repeated clicks cannot duplicate a receipt.
  if (loan.returned) return { ok: false, reason: 'already-returned' }
  const slot = player.inventory.slots.findIndex((item: any) => item?.name === 'book' && item.nbt?.value?.AlwaysOnLoan?.value === loan.bookId)
  if (slot < 0) return { ok: false, reason: 'book-missing' }
  const receiptId = `AO-${loan.bookId}-${runtime.ledger.length + 1}`
  player.inventory.updateSlot(slot, null)
  loan.returned = true
  runtime.ledger.push({ receiptId, playerId: player.id, item: loan.bookId, visit: runtime.visit, point: { ...point } })
  return { ok: true, receiptId }
}

export async function tryReturnBorrowedBook (bot: any, server: any): Promise<ReturnResult> {
  return transferAlwaysOnBook(server, bot?.username)
}

export function getAlwaysOnReturnLedger (server: any) {
  return runtimes.get(server)?.ledger.map(entry => ({ ...entry, point: { ...entry.point } })) ?? []
}
