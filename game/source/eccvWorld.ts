import { Vec3 } from 'vec3'

const loadChunk = require('prismarine-chunk')
const loadBlock = require('prismarine-block')
const loadData = require('minecraft-data')

type Position = { x: number, y: number, z: number }
type Voxel = Position & { state: number }

/**
 * A deliberately condensed, original conference floor, informed by EgoPoster's
 * public demonstration and its five-paper walk. This is not a venue survey or
 * a literal reconstruction of a photographed visitor's route.
 *
 * `position` is a solid, visible block on each panel's front face. `approach`
 * is an unobstructed standing point, and `label` is a renderer label anchor.
 */
export const ECCV_SCENE = {
  seed: 442026,
  groundY: 4,
  spawn: { x: 0.5, y: 5, z: 26.5, yaw: 0 },
  booth: { x: 11, y: 5, z: 21 },
  reportPoint: { x: 11, y: 6, z: 21 },
  reportApproach: { x: 11.5, y: 5, z: 24.5, yaw: 0 },
  boothLabel: { x: 11.5, y: 10.1, z: 19.6 },
  posters: [
    {
      id: 'gaga', title: 'GaGA', color: '#608d9c',
      position: { x: -10, y: 7, z: 12 },
      approach: { x: -9.5, y: 5, z: 15.5, yaw: 0 },
      label: { x: -9.5, y: 10.1, z: 12.6 }
    },
    {
      id: 'omnimap', title: 'OmniMapBench', color: '#78926c',
      position: { x: 10, y: 7, z: 5 },
      approach: { x: 10.5, y: 5, z: 8.5, yaw: 0 },
      label: { x: 10.5, y: 10.1, z: 5.6 }
    },
    {
      id: 'cfg', title: 'CFG-Bench', color: '#b18560',
      position: { x: -10, y: 7, z: -3 },
      approach: { x: -9.5, y: 5, z: 0.5, yaw: 0 },
      label: { x: -9.5, y: 10.1, z: -2.4 }
    },
    {
      id: 'lagen', title: 'LaGen', color: '#9b769b',
      position: { x: 10, y: 7, z: -10 },
      approach: { x: 10.5, y: 5, z: -6.5, yaw: 0 },
      label: { x: 10.5, y: 10.1, z: -9.4 }
    },
    {
      id: 'city', title: '360CityArena', color: '#6880a2',
      position: { x: 0, y: 7, z: -23 },
      approach: { x: 0.5, y: 5, z: -19.5, yaw: 0 },
      label: { x: 0.5, y: 10.1, z: -22.4 }
    }
  ]
} as const

/** Vanilla-block blueprint: no external textures, map downloads or services. */
export function createEccvGenerator (version = '1.19.4') {
  const Chunk = loadChunk(version)
  const Block = loadBlock(version)
  const data = loadData(version)
  const stateCache = new Map<string, number>()
  const resolve = (name: string, props: Record<string, any> = {}) => {
    const key = name + JSON.stringify(props)
    if (stateCache.has(key)) return stateCache.get(key)!
    if (!data.blocksByName[name]) throw new Error(`Conference block unavailable in ${version}: ${name}`)
    const state = Object.keys(props).length ? Block.fromProperties(name, props, 0).stateId : data.blocksByName[name].defaultState
    stateCache.set(key, state)
    return state
  }
  const columns = new Map<string, Map<string, Voxel>>()
  const put = (x: number, y: number, z: number, name: string, props?: Record<string, any>) => {
    const key = `${Math.floor(x / 16)},${Math.floor(z / 16)}`
    if (!columns.has(key)) columns.set(key, new Map())
    columns.get(key)!.set(`${x},${y},${z}`, { x, y, z, state: resolve(name, props) })
  }
  const box = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, name: string, props?: Record<string, any>) => {
    for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) for (let y = y1; y <= y2; y++) put(x, y, z, name, props)
  }

  // The photo's dark floor, tall white poster partitions and luminous ceiling
  // provide the visual reference. Walking scale is expanded for browser input.
  box(-24, 4, -31, 24, 4, 33, 'gray_concrete')
  box(-4, 4, -28, 4, 4, 31, 'gray_wool')
  for (const x of [-5, 5]) box(x, 4, -28, x, 4, 31, 'light_gray_concrete')
  box(-24, 5, -31, -24, 17, 33, 'light_gray_concrete')
  box(24, 5, -31, 24, 17, 33, 'light_gray_concrete')
  box(-24, 5, -31, 24, 17, -31, 'white_concrete')
  box(-24, 5, 33, 24, 17, 33, 'light_gray_concrete')
  // Deep walls above the partitions leave a recognizable exhibition-hall void.
  for (const x of [-24, 24]) box(x, 11, -31, x, 17, 33, 'black_concrete')
  box(-24, 12, -31, 24, 17, -31, 'black_concrete')
  box(-24, 12, 33, 24, 17, 33, 'black_concrete')
  box(-24, 18, -31, 24, 18, 33, 'black_concrete')

  // Long ceiling trusses, cross beams and paired square exhibition fixtures.
  for (const x of [-17, -6, 6, 17]) box(x, 16, -30, x, 16, 32, 'polished_deepslate')
  for (const z of [-26, -14, -2, 10, 22]) {
    box(-23, 16, z, 23, 16, z, 'polished_deepslate')
    for (const x of [-18, -9, 0, 9, 18]) {
      put(x, 15, z, 'iron_bars')
      box(x - 1, 14, z, x + 1, 14, z + 1, 'sea_lantern')
    }
  }
  for (const x of [-23, 23]) for (const z of [-24, -6, 12, 30]) {
    box(x, 5, z, x, 16, z, 'quartz_pillar', { axis: 'y' })
  }

  const poster = (cx: number, z: number, accent: string, diagram: number) => {
    // A separate pair of feet keeps each panel visibly modular.
    for (const x of [cx - 3, cx + 3]) {
      box(x, 5, z - 1, x, 5, z + 1, 'smooth_stone_slab', { type: 'bottom', waterlogged: false })
      box(x, 6, z, x, 9, z, 'quartz_pillar', { axis: 'y' })
    }
    box(cx - 2, 6, z, cx + 2, 9, z, 'white_concrete')
    box(cx - 2, 9, z, cx + 2, 9, z, accent)
    // Original abstract figures reference the papers' subjects rather than
    // fabricating a pixel-perfect reproduction of their real poster content.
    if (diagram === 0) {
      put(cx - 1, 7, z, 'cyan_terracotta')
      put(cx, 7, z, 'light_blue_terracotta')
      put(cx + 1, 7, z, 'green_terracotta')
      put(cx, 8, z, 'cyan_terracotta')
    } else if (diagram === 1) {
      box(cx - 1, 7, z, cx + 1, 7, z, 'green_terracotta')
      put(cx - 1, 8, z, 'lime_terracotta')
      put(cx + 1, 6, z, 'lime_terracotta')
    } else if (diagram === 2) {
      put(cx - 1, 6, z, 'orange_terracotta')
      put(cx, 7, z, 'yellow_terracotta')
      put(cx + 1, 8, z, 'orange_terracotta')
    } else if (diagram === 3) {
      for (const dx of [-1, 0, 1]) put(cx + dx, 7 + Math.abs(dx), z, 'purple_terracotta')
      put(cx, 6, z, 'magenta_terracotta')
    } else {
      box(cx - 1, 6, z, cx - 1, 8, z, 'blue_terracotta')
      put(cx, 6, z, 'light_blue_terracotta')
      box(cx + 1, 6, z, cx + 1, 7, z, 'blue_terracotta')
    }
    // A one-block light at floor level doubles as a subtle station marker.
    put(cx, 4, z + 3, 'sea_lantern')
  }
  const accents = ['cyan_concrete', 'green_concrete', 'orange_concrete', 'purple_concrete', 'blue_concrete']
  for (const [index, p] of ECCV_SCENE.posters.entries()) poster(p.position.x, p.position.z, accents[index], index)

  // Secondary, noninteractive boards at the perimeter establish hall density.
  // They have no named-paper colors, and stay outside the main walking route.
  for (const x of [-21, 21]) for (const z of [-23, -11, 1, 13]) {
    box(x, 6, z, x, 9, z + 5, 'white_concrete')
    box(x, 9, z, x, 9, z + 5, 'light_gray_concrete')
    for (const end of [z, z + 5]) {
      box(x - 1, 5, end, x + 1, 5, end, 'smooth_stone_slab', { type: 'bottom', waterlogged: false })
      put(x, 6, end, 'quartz_pillar', { axis: 'y' })
    }
  }

  // Booth 44 is documented as a compact 3 x 2 m shell. This voxel treatment
  // preserves its desk/back-wall/display arrangement while expanding geometry
  // for legible interaction; it does not assert an exact furniture inventory.
  // Wool gives the booth a carpeted surface without a sunken collision edge.
  box(8, 4, 18, 16, 4, 23, 'blue_wool')
  box(8, 5, 18, 16, 9, 18, 'white_concrete')
  box(8, 5, 18, 8, 9, 21, 'white_concrete')
  box(8, 9, 18, 16, 9, 18, 'blue_concrete')
  box(9, 7, 18, 15, 8, 18, 'black_concrete')
  box(10, 7, 19, 14, 8, 19, 'blue_stained_glass')
  put(12, 7, 19, 'sea_lantern')
  box(10, 5, 21, 14, 5, 21, 'quartz_block')
  box(10, 6, 21, 14, 6, 21, 'smooth_quartz_slab', { type: 'bottom', waterlogged: false })
  put(11, 6, 21, 'cyan_glazed_terracotta', { facing: 'south' })
  // Laptop-like display and an abstract glasses display on the demonstrator's
  // counter, using only tiny pieces of ordinary game geometry.
  put(14, 6, 20, 'blackstone_slab', { type: 'bottom', waterlogged: false })
  put(14, 7, 20, 'black_stained_glass_pane', { north: false, east: true, south: false, west: true, waterlogged: false })
  put(10, 6, 20, 'polished_blackstone_pressure_plate', { powered: false })

  // Seating and foliage stay peripheral, leaving every named approach clear.
  for (const z of [-27, 28]) for (const x of [-16, -14, -12, 12, 14, 16]) {
    put(x, 5, z, 'spruce_stairs', { facing: z < 0 ? 'south' : 'north', half: 'bottom', shape: 'straight', waterlogged: false })
  }
  for (const [x, z] of [[-20, 28], [20, 28], [-20, -28], [20, -28]]) {
    put(x, 5, z, 'quartz_block')
    box(x, 6, z, x, 7, z, 'oak_leaves', { persistent: true, distance: 1, waterlogged: false })
  }

  const generator = (chunkX: number, chunkZ: number, options: any = {}) => {
    const minY = options.minY ?? -64
    const worldHeight = options.worldHeight ?? 384
    const chunk = new Chunk({ minY, worldHeight })
    const p = new Vec3(0, 0, 0)
    const bedrock = resolve('bedrock')
    const concrete = resolve('gray_concrete')
    const stone = resolve('stone')
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
      p.x = lx
      p.z = lz
      for (let y = 0; y <= 4; y++) {
        p.y = y
        chunk.setBlockStateId(p, y === 0 ? bedrock : y === 4 ? concrete : stone)
      }
      for (let y = minY; y < minY + worldHeight; y++) {
        p.y = y
        chunk.setSkyLight(p, y > 4 ? 15 : 0)
      }
    }
    for (const voxel of columns.get(`${chunkX},${chunkZ}`)?.values() ?? []) {
      p.set(voxel.x - chunkX * 16, voxel.y, voxel.z - chunkZ * 16)
      chunk.setBlockStateId(p, voxel.state)
      // Full ambient fill compensates for the local engine's limited indoor
      // light propagation; fixtures are also genuine emissive game blocks.
      chunk.setSkyLight(p, 15)
      if (data.blocksByStateId[voxel.state]?.emitLight) chunk.setBlockLight(p, data.blocksByStateId[voxel.state].emitLight)
    }
    return chunk
  }
  return { generator, resolve }
}

/** Call immediately after startLocalServer, before asynchronous world setup. */
export function installEccvWorld (server: any) {
  const { generator } = createEccvGenerator(server.version ?? server.options?.version ?? '1.19.4')
  server.spawnPoint = new Vec3(ECCV_SCENE.spawn.x, ECCV_SCENE.spawn.y, ECCV_SCENE.spawn.z)
  server.overworldGeneratorOverride = generator
  server.time = 6000
  server.doDaylightCycle = false
}
