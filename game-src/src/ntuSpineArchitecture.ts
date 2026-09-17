import { Vec3 } from 'vec3'
import { NTU_SPINE_FOOTPRINTS, type SpineFootprint } from './ntuSpineFootprints'

export { NTU_SPINE_FOOTPRINTS } from './ntuSpineFootprints'

/** Old-core coordinates; callers may translate these into a larger map grid. */
export const NTU_SPINE_BOUNDS = {
  minX: Math.min(...NTU_SPINE_FOOTPRINTS.map(item => item.bounds.minX)),
  maxX: Math.max(...NTU_SPINE_FOOTPRINTS.map(item => item.bounds.maxX)),
  minZ: Math.min(...NTU_SPINE_FOOTPRINTS.map(item => item.bounds.minZ)),
  maxZ: Math.max(...NTU_SPINE_FOOTPRINTS.map(item => item.bounds.maxZ))
}

type Cell = { x: number, z: number, depth: number, along: number, across: number, feature: SpineFootprint }
const cellKey = (x: number, z: number) => `${x},${z}`
const modulo = (n: number, divisor: number) => ((n % divisor) + divisor) % divisor

export function isInsideSpineFootprint (x: number, z: number, feature: SpineFootprint): boolean {
  let inside = false
  const points = feature.polygon
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, az] = points[i]
    const [bx, bz] = points[j]
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside
  }
  return inside
}

/**
 * Architectural correction of the nine mapped Spine footprints, not a new
 * campus layout. Only cells inside the supplied OSM polygons can be changed.
 *
 * NTU's official photographs show pale horizontal slab bands, recessed dark
 * glazing, open-air circulation and roof solar arrays. Their one-metre block
 * interpretation here replaces Arnis' generic stone-brick / glowstone facades.
 * Storey spacing, columns and window bays are approximate exterior geometry;
 * no room-level survey or reconstructed interior is implied.
 */
export function createSpineDecorator (mcData: any): (chunk: any, chunkX: number, chunkZ: number) => void {
  const block = (name: string) => {
    const state = mcData.blocksByName[name]?.defaultState
    if (typeof state !== 'number') throw new Error(`Missing NTU architecture block: ${name}`)
    return state
  }
  const material = {
    air: block('air'), slab: block('white_concrete'), column: block('smooth_quartz'),
    floor: block('smooth_stone'), glazing: block('gray_stained_glass'),
    solar: block('blue_terracotta'), solarGrid: block('light_gray_concrete'),
    soil: block('dirt'), leaves: block('azalea_leaves')
  }
  const columns = new Map<string, Cell[]>()
  for (const feature of NTU_SPINE_FOOTPRINTS) {
    const footprint = new Set<string>()
    const { minX, maxX, minZ, maxZ } = feature.bounds
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      if (isInsideSpineFootprint(x + 0.5, z + 0.5, feature)) footprint.add(cellKey(x, z))
    }
    // Include the rasterized polygon edge: Arnis also draws the outline at
    // integer vertices. Otherwise an old one-block wall can remain outside the
    // centre-sampled interior and hide the corrected facade completely.
    for (let i = 0; i < feature.polygon.length; i++) {
      const [ax, az] = feature.polygon[i]
      const [bx, bz] = feature.polygon[(i + 1) % feature.polygon.length]
      const steps = Math.max(Math.abs(bx - ax), Math.abs(bz - az))
      for (let step = 0; step <= steps; step++) {
        const t = steps ? step / steps : 0
        footprint.add(cellKey(Math.round(ax + (bx - ax) * t), Math.round(az + (bz - az) * t)))
      }
    }
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      if (!footprint.has(cellKey(x, z))) continue
      // Manhattan erosion gives a stable one-block facade even on diagonal
      // South Spine wings. The expensive footprint work runs once, not per load.
      let depth = 5
      outer: for (let radius = 1; radius <= 5; radius++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const dz = radius - Math.abs(dx)
          if (!footprint.has(cellKey(x + dx, z + dz)) || !footprint.has(cellKey(x + dx, z - dz))) {
            depth = radius - 1
            break outer
          }
        }
      }
      const south = feature.osmWayId === 49967706
      const diagonalWing = feature.kind === 'wing' && feature.bounds.minZ > 480
      const along = Math.round(south ? (x + z) / Math.SQRT2 : diagonalWing ? (x - z) / Math.SQRT2 : feature.kind === 'wing' ? x : z)
      const across = Math.round(south ? (x - z) / Math.SQRT2 : diagonalWing ? (x + z) / Math.SQRT2 : feature.kind === 'wing' ? z : x)
      const key = cellKey(Math.floor(x / 16), Math.floor(z / 16))
      const list = columns.get(key) ?? []
      list.push({ x, z, depth, along, across, feature })
      columns.set(key, list)
    }
  }

  return (chunk, chunkX, chunkZ) => {
    const cells = columns.get(cellKey(chunkX, chunkZ))
    if (!cells) return
    const p = new Vec3(0, 0, 0)
    for (const { x, z, depth, along, across, feature } of cells) {
      p.x = modulo(x, 16)
      p.z = modulo(z, 16)
      // Arnis stores a thin terrain shell above the void, then independent
      // elevated academic floors. Recover that shell before removing facades.
      // Never erase terrain or roads outside the source building footprint.
      let terrainTop = feature.floorY - 1
      let foundTerrain = false
      for (let y = -62; y < feature.floorY; y++) {
        p.y = y
        const present = chunk.getBlockStateId(p) !== material.air
        if (present && !foundTerrain) { foundTerrain = true; terrainTop = y }
        else if (present && foundTerrain) terrainTop = y
        else if (foundTerrain) break
      }
      const floorY = feature.floorY
      const roofY = floorY + feature.levels * 4
      const pier = modulo(along, 8) === 0 && (depth <= 1 || modulo(across, 12) === 0)
      const doorway = modulo(along, 32) >= 12 && modulo(along, 32) <= 15
      const plantedBay = feature.kind === 'north' && depth === 1 && modulo(along, 24) >= 8 && modulo(along, 24) <= 12
      for (let y = terrainTop + 1; y <= Math.max(feature.clearTop, roofY + 2); y++) {
        let state = material.air
        if (y < floorY) {
          // Support the real elevated Spine deck where the terrain falls away;
          // keep the undercroft traversable between structural columns.
          if (pier) state = material.column
        } else if (y <= roofY) {
          const storey = Math.floor((y - floorY) / 4)
          const offset = modulo(y - floorY, 4)
          if (offset === 0) state = depth === 0 ? material.slab : material.floor
          else if (pier) state = material.column
          else if (depth === 0 && offset === 1 && storey > 0) state = material.slab
          else if (depth === 2 && offset >= 2 && !(storey === 0 && doorway)) state = material.glazing
          else if (depth === 2 && offset === 1 && !(storey === 0 && doorway)) state = material.slab
          if (plantedBay && storey === 1 && offset === 1) state = material.soil
          if (plantedBay && storey === 1 && offset === 2) state = material.leaves
        } else if (y === roofY + 1) {
          if (depth === 0) state = material.slab
          else if (depth >= 4 && feature.kind !== 'link' && modulo(along, 10) < 8 && modulo(across, 8) < 6) {
            // Coarse blue-grey panels and pale separators, matching the roof
            // arrays visible in NTU's published aerial photographs.
            state = modulo(along, 10) % 4 === 0 ? material.solarGrid : material.solar
          }
        }
        p.y = y
        chunk.setBlockStateId(p, state)
        // Existing generated roofs can leave stale dark lighting after they are
        // cleared. This keeps the open arcades readable without luminous walls.
        chunk.setSkyLight?.(p, state === material.air || state === material.glazing || state === material.leaves ? 15 : 0)
        chunk.setBlockLight?.(p, 0)
      }
    }
  }
}
