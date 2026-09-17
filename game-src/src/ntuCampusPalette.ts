import { Vec3 } from 'vec3'

// ODbL footprint derivative from the separately attributed full-campus extract.
// It contains geometry / recorded tags, not fabricated building heights.
const source = require('./ntuCampusPalette.json') as {
  features: CampusBuilding[]
  protectedAreas: Array<{ x: number, z: number, radius: number }>
  protectedPaths: Array<Array<[number, number]>>
}
export type CampusBuilding = {
  id: number
  name: string
  category: 'academic' | 'residential' | 'nie' | 'sports' | 'campus'
  hall?: string
  levels?: number
  detailed?: boolean
  roof: 'hall2-tile' | 'retain'
  bounds: [number, number, number, number]
  polygon: Array<[number, number]>
}
export const NTU_CAMPUS_BUILDINGS: readonly CampusBuilding[] = source.features

function inside (x: number, z: number, points: Array<[number, number]>) {
  let yes = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, az] = points[i], [bx, bz] = points[j]
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) yes = !yes
  }
  return yes
}
function segmentDistance (x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)))
  return Math.hypot(x - ax - t * dx, z - az - t * dz)
}
const key = (x: number, z: number) => `${x},${z}`

/**
 * A conservative material correction across the mapped campus, in FULL map
 * coordinates. Existing footprints, storeys, openings and roof profiles survive.
 * This is not a claim that these buildings have surveyed or accurate facades.
 *
 * Run BEFORE the separately authored Spine / Hive / Heritage decorators. Those
 * eleven footprints get the same material-only pass so any projection-edge
 * remainder has a neutral facade. Roads, heritage pavilions,
 * neighboring housing, natural surfaces and demo station approaches are excluded.
 */
export function createCampusPaletteDecorator (mcData: any, { includeDetailed = true } = {}) {
  const featuresByChunk = new Map<string, CampusBuilding[]>()
  const pathCells = new Set<string>()
  for (const path of source.protectedPaths) {
    for (let i = 1; i < path.length; i++) {
      const [ax, az] = path[i - 1], [bx, bz] = path[i]
      for (let x = Math.min(ax, bx) - 2; x <= Math.max(ax, bx) + 2; x++) {
        for (let z = Math.min(az, bz) - 2; z <= Math.max(az, bz) + 2; z++) {
          if (segmentDistance(x, z, ax, az, bx, bz) <= 2) pathCells.add(key(x, z))
        }
      }
    }
  }
  for (const feature of source.features) {
    if (feature.detailed && !includeDetailed) continue
    const [minX, minZ, maxX, maxZ] = feature.bounds
    for (let x = minX >> 4; x <= maxX >> 4; x++) for (let z = minZ >> 4; z <= maxZ >> 4; z++) {
      const k = key(x, z), existing = featuresByChunk.get(k) ?? []
      existing.push(feature)
      featuresByChunk.set(k, existing)
    }
  }
  const air = mcData.blocksByName.air.defaultState
  const quartz = mcData.blocksByName.smooth_quartz.defaultState
  const sets = new Map<string, Map<number, number>>()
  const replacements = (category: CampusBuilding['category'], roof: boolean) => {
    const cacheKey = `${category}/${roof}`
    if (sets.has(cacheKey)) return sets.get(cacheKey)!
    const map = new Map<number, number>()
    const wall = roof ? 'light_gray_concrete' : category === 'residential' ? 'white_terracotta' : category === 'sports' ? 'light_gray_concrete' : 'white_concrete'
    const set = (names: string[], replacement: string) => {
      const target = mcData.blocksByName[replacement]
      for (const name of names) {
        const original = mcData.blocksByName[name]
        if (!original || !target) continue
        const sameStates = original.maxStateId - original.minStateId === target.maxStateId - target.minStateId
        for (let state = original.minStateId; state <= original.maxStateId; state++) {
          map.set(state, sameStates ? target.minStateId + state - original.minStateId : target.defaultState)
        }
      }
    }
    set(['gold_block', 'yellow_concrete', 'yellow_terracotta', 'orange_concrete', 'blue_concrete',
      'stone_bricks', 'cracked_stone_bricks', 'chiseled_stone_bricks', 'mossy_stone_bricks',
      'mud_bricks', 'end_stone_bricks', 'deepslate_bricks', 'deepslate_tiles', 'polished_blackstone_bricks',
      'polished_blackstone', 'polished_deepslate', 'nether_bricks', 'red_nether_bricks',
      'polished_granite', 'granite', 'bricks', 'sandstone', 'smooth_sandstone',
      'red_concrete', 'brown_concrete', 'brown_terracotta', 'light_blue_terracotta', 'cyan_terracotta'], wall)
    set(['light_blue_stained_glass', 'blue_stained_glass', 'cyan_stained_glass', 'brown_stained_glass', 'white_stained_glass'], 'gray_stained_glass')
    set(['stone_brick_stairs', 'cobblestone_stairs', 'deepslate_brick_stairs', 'polished_blackstone_brick_stairs', 'nether_brick_stairs'], 'quartz_stairs')
    set(['stone_brick_slab', 'cobblestone_slab', 'deepslate_brick_slab', 'polished_blackstone_brick_slab', 'nether_brick_slab'], 'smooth_stone_slab')
    sets.set(cacheKey, map)
    return map
  }
  const tileStates = new Map<number, number>()
  for (const [originalName, targetName] of [['stone_brick_stairs', 'brick_stairs'], ['quartz_stairs', 'brick_stairs'], ['stone_brick_slab', 'brick_slab'], ['smooth_stone_slab', 'brick_slab']]) {
    const original = mcData.blocksByName[originalName], target = mcData.blocksByName[targetName]
    for (let state = original.minStateId; state <= original.maxStateId; state++) tileStates.set(state, target.minStateId + state - original.minStateId)
  }
  const brick = mcData.blocksByName.bricks.defaultState
  const solidTiles = new Set(['stone_bricks', 'light_gray_concrete', 'smooth_stone', 'polished_andesite', 'white_concrete', 'white_terracotta'])
  const done = new WeakSet<object>()

  return (chunk: any, chunkX: number, chunkZ: number) => {
    if (done.has(chunk)) return
    const candidates = featuresByChunk.get(key(chunkX, chunkZ))
    if (!candidates) return
    done.add(chunk)
    // Bound the scan to nonempty sections of the existing Anvil geometry. No
    // guessed storey count or max building height is used to extend a building.
    const minY = chunk.minY ?? -64
    let topY = (chunk.worldHeight ?? 384) + minY - 1
    if (Array.isArray(chunk.sections)) {
      const last = chunk.sections.findLastIndex((section: any) => section && section.solidBlockCount > 0)
      topY = minY + (last + 1) * 16 - 1
    }
    const p = new Vec3(0, 0, 0)
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
      const x = chunkX * 16 + lx, z = chunkZ * 16 + lz
      if (source.protectedAreas.some(area => Math.hypot(x - area.x, z - area.z) < area.radius)) continue
      let onEdge = false
      const feature = candidates.find(item => {
        const [a, b, c, d] = item.bounds
        if (x < a || x > c || z < b || z > d) return false
        onEdge = item.polygon.some(([ax, az], i) => {
          const [bx, bz] = item.polygon[(i + 1) % item.polygon.length]
          return segmentDistance(x, z, ax, az, bx, bz) <= 0.7
        })
        return onEdge || inside(x + 0.5, z + 0.5, item.polygon)
      })
      if (!feature) continue
      p.x = lx; p.z = lz
      let terrainStart: number | undefined
      let columnTop = minY
      for (let y = topY; y > minY + 1; y--) {
        p.y = y
        if (chunk.getBlockStateId(p) !== air) { columnTop = y; break }
      }
      // The Arnis terrain is a three-block surface shell. Preserve its first
      // three blocks, including paved surfaces, before touching facade material.
      for (let y = minY + 2; y <= columnTop; y++) {
        p.y = y
        if (chunk.getBlockStateId(p) !== air) { terrainStart = y; break }
      }
      if (terrainStart === undefined) continue
      const floor = terrainStart + 2
      const facadeMap = replacements(feature.category, false)
      const roofMap = replacements(feature.category, true)
      let firstStructure: number | undefined
      for (let y = floor + 1; y <= columnTop; y++) {
        p.y = y
        const original = chunk.getBlockStateId(p)
        if (original === air) continue
        const name = mcData.blocksByStateId[original]?.name ?? ''
        // Paths through buildings stay clear, including explicitly roofed paths.
        if (pathCells.has(key(x, z)) && y <= floor + 4) continue
        if (firstStructure === undefined && (facadeMap.has(original) || /concrete|stone|quartz/.test(name))) firstStructure = y
        const isRoof = y >= columnTop - 1
        let replacement = (isRoof ? roofMap : facadeMap).get(original)
        if (isRoof && feature.roof === 'hall2-tile') replacement = tileStates.get(original) ?? (solidTiles.has(name) ? brick : replacement)
        if (replacement === undefined || replacement === original) continue
        chunk.setBlockStateId(p, replacement)
      }
      // Sparse interior columns support a suspended generated floor. Never fill
      // a doorway, a roofed path, a sports hall or an unknown service structure.
      if (!onEdge && feature.category !== 'sports' && feature.category !== 'campus' && !pathCells.has(key(x, z))
        && x % 12 === 0 && z % 12 === 0 && firstStructure !== undefined && firstStructure - floor >= 3 && firstStructure - floor <= 18) {
        for (let y = floor + 1; y < firstStructure; y++) {
          p.y = y
          if (chunk.getBlockStateId(p) === air) { chunk.setBlockStateId(p, quartz); chunk.setSkyLight?.(p, 0) }
        }
      }
    }
  }
}
