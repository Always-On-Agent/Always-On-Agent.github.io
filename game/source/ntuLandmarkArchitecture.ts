import { Vec3 } from 'vec3'
import footprints from './ntuLandmarkFootprints.json'

type Point = [number, number]
type Pod = { x: number; z: number; rx: number; rz: number; height: number }
// Exterior interpretation of the official NTU aerial, fitted inside the mapped
// scalloped footprint. Pod subdivision is an approximation, not surveyed CAD.
export const HIVE_PODS: Pod[] = [
  { x: 686, z: 677, rx: 7, rz: 7.5, height: 32 },
  { x: 698, z: 672, rx: 4.8, rz: 5.4, height: 28 },
  { x: 707, z: 680, rx: 6.2, rz: 6.8, height: 32 },
  { x: 707, z: 686, rx: 6.8, rz: 4.7, height: 28 },
  { x: 715, z: 699, rx: 8.5, rz: 4.8, height: 32 },
  { x: 702, z: 709, rx: 4.7, rz: 6.5, height: 24 },
  { x: 698, z: 713, rx: 4.5, rz: 6, height: 28 },
  { x: 690, z: 716, rx: 4.5, rz: 5.4, height: 24 },
  { x: 678, z: 717, rx: 6.7, rz: 8.7, height: 32 },
  { x: 665, z: 704, rx: 7, rz: 4.7, height: 28 },
  { x: 669, z: 695, rx: 6, rz: 4.5, height: 24 },
  { x: 678, z: 687, rx: 6.8, rz: 6.8, height: 32 }
]

export const insideFootprint = (x: number, z: number, ring: readonly Point[]) => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

/** All coordinates use the retained academic-core reference frame. */
export function createLandmarkDecorator (data: any) {
  const ids: Record<string, number> = {}
  const state = (name: string) => ids[name] ??= data.blocksByName[name].defaultState
  const hive = footprints['The Hive'] as Point[]
  const chc = footprints['Chinese Heritage Centre'] as Point[]
  const groundMaterials = new Set(['stone', 'dirt', 'grass_block', 'sand', 'gravel', 'coarse_dirt', 'podzol', 'clay'])
  const pavedSurfaces = new Set(['stone_bricks', 'cracked_stone_bricks', 'smooth_stone', 'cobblestone', 'gray_concrete', 'light_gray_concrete', 'black_concrete', 'gray_concrete_powder', 'cyan_terracotta'])
  const hiveMask = new Set<string>()
  for (let x = 656; x <= 727; x++) for (let z = 665; z <= 729; z++) {
    if (insideFootprint(x + .5, z + .5, hive)) {
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) hiveMask.add(`${x + dx},${z + dz}`)
    }
  }
  const p = new Vec3(0, 0, 0)
  return (chunk: any, cx: number, cz: number) => {
    const put = (x: number, y: number, z: number, name: string) => {
      if (y < -64 || y > 319) return
      p.set(x & 15, y, z & 15)
      chunk.setBlockStateId(p, state(name))
      chunk.setSkyLight(p, name === 'air' || name.includes('glass') ? 15 : 0)
      chunk.setBlockLight(p, 0)
    }
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
      const x = cx * 16 + lx, z = cz * 16 + lz
      const px = x + .5, pz = z + .5
      const inHive = insideFootprint(px, pz, hive)
      if (hiveMask.has(`${x},${z}`)) {
        // The source raster draws a one-block outline; the wider map's integer
        // projection can shift it a further metre. Remove that residual facade.
        let terrain = -40, found = false
        for (let y = -62; y < -20; y++) {
          p.set(lx, y, lz)
          const name = data.blocksByStateId[chunk.getBlockStateId(p)]?.name ?? 'air'
          if (groundMaterials.has(name)) { terrain = y; found = true; continue }
          if (found) {
            // Arnis stores a thin natural ground layer, then paving or the
            // building. Keep one surface block, not an entire solid facade.
            // Higher stone layers belong to the generated building as well.
            if (pavedSurfaces.has(name)) terrain = y
            break
          }
        }
        for (let y = inHive ? -39 : terrain + 1; y <= 8; y++) put(x, y, z, 'air')
      }
      if (inHive && x >= 658 && x <= 724 && z >= 667 && z <= 726) {
        // Open sky through the atrium; the original generic extruded roof is removed.
        for (let y = -40; y <= 8; y++) put(x, y, z, y === -40 ? 'smooth_stone' : 'air')
        const central = ((px - 690) / 9) ** 2 + ((pz - 698) / 11) ** 2
        if (central < .45 && Math.hypot(px - 690, pz - 698) > 3) put(x, -39, z, 'moss_block')
        for (const pod of HIVE_PODS) {
          const r = Math.sqrt(((px - pod.x) / pod.rx) ** 2 + ((pz - pod.z) / pod.rz) ** 2)
          if (r > 1.02) continue
          for (let h = 0; h <= pod.height; h++) {
            const radius = .69 + .31 * Math.min(1, h / pod.height)
            if (r > radius) continue
            const y = -39 + h
            const edge = r > radius - .17
            const towardAtrium = (px - pod.x) * (690 - pod.x) + (pz - pod.z) * (698 - pod.z) > 2
            if (h === 0) put(x, y, z, 'smooth_sandstone')
            else if (h < 3) {
              if (edge && (x + z) % 4 === 0) put(x, y, z, 'smooth_sandstone')
            } else if (h === pod.height) {
              put(x, y, z, 'smooth_sandstone')
              if (r > .65 && r < .9) put(x, y + 1, z, 'oak_leaves')
            } else if (h % 4 === 3) put(x, y, z, edge ? 'smooth_sandstone' : 'smooth_stone')
            else if (edge) put(x, y, z, towardAtrium && h % 4 !== 0 ? 'gray_stained_glass' : h % 4 === 0 ? 'cut_sandstone' : 'white_concrete')
          }
        }
        // Curved circulation galleries face the open atrium rather than a sealed roof.
        if (central >= .85 && central <= 1.5) for (let h = 3; h <= 27; h += 4) {
          put(x, -39 + h, z, 'smooth_sandstone')
          if (central < 1.03) put(x, -38 + h, z, 'gray_stained_glass')
        }
        if (central < .8) for (let y = -37; y <= 8; y++) put(x, y, z, 'air')
      }
      if (x >= 787 && x <= 882 && z >= 591 && z <= 675 && insideFootprint(px, pz, chc)) {
        // Real mapped long axis, red-brick wings and green Chinese-style roofs.
        const u = (px - 833) * .81 - (pz - 633) * .586
        const v = (px - 833) * .586 + (pz - 633) * .81
        const middle = Math.abs(u) < 13
        const eave = middle ? -25 : -32
        for (let y = -45; y <= -10; y++) put(x, y, z, y === -45 ? 'smooth_stone' : 'air')
        const edge = !insideFootprint(px + 1, pz, chc) || !insideFootprint(px - 1, pz, chc)
          || !insideFootprint(px, pz + 1, chc) || !insideFootprint(px, pz - 1, chc)
        for (let y = -44; y < eave; y++) {
          const level = y + 44
          if (level % 5 === 0) put(x, y, z, 'smooth_sandstone')
          else if (edge) put(x, y, z, Math.abs(Math.round(u)) % 5 < 3 && level % 5 > 1 ? 'black_stained_glass' : middle ? 'smooth_sandstone' : 'bricks')
        }
        const roof = eave + Math.max(0, Math.round(6 - Math.abs(v) * .55))
        put(x, roof, z, 'dark_prismarine')
        if (Math.abs(v) < 1.2) put(x, roof + 1, z, 'prismarine_bricks')
      }
      // Memorial and garden arch sit at their mapped OSM positions.
      const mx = px - 895.7, mz = pz - 708.3, md = Math.max(Math.abs(mx), Math.abs(mz))
      if (md < 7 && Math.abs(mx) + Math.abs(mz) < 10) {
        for (let y = -51; y < -35; y++) put(x, y, z, 'air')
        put(x, -52, z, 'smooth_sandstone')
        if (md < 5) put(x, -51, z, 'smooth_sandstone')
        if (md < 2) for (let y = -50; y <= -41; y++) put(x, y, z, 'smooth_sandstone')
        if (md < 5.5) put(x, -43 + Math.floor((5.5 - md) / 2), z, 'dark_prismarine')
        if (md < 3.5) put(x, -38 + Math.floor((3.5 - md) / 2), z, 'dark_prismarine')
      }
      const ax = px - 950.9, az = pz - 777.2
      if (Math.abs(ax) <= 9 && Math.abs(az) <= 2.5) {
        for (let y = -51; y <= -36; y++) put(x, y, z, 'air')
        const column = Math.abs(Math.abs(ax) - 7) < 1 || Math.abs(Math.abs(ax) - 3) < .8
        if (column && Math.abs(az) < 1) for (let y = -52; y <= -40; y++) put(x, y, z, 'smooth_sandstone')
        if (Math.abs(az) < 1.2 && Math.abs(ax) < 8) { put(x, -44, z, 'red_terracotta'); put(x, -43, z, 'red_terracotta') }
        const top = Math.abs(ax) < 3.5 ? -39 : -42
        put(x, top + Math.floor(2.5 - Math.abs(az)), z, 'dark_prismarine')
      }
    }
  }
}
