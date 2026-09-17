import { isNtuMapRebuild } from './ntuMapLocal'

type RGB = readonly [number, number, number]
type Tile = { color: RGB, contrast: number, pattern?: 'grass' | 'grass-side' | 'overlay' | 'paving' }
type TextureResources = {
  customTextures: { blocks?: { tileSize: number | undefined, textures: Record<string, HTMLImageElement> } }
}
const SIZE = 16

/** Original procedural surfaces, informed by the campus material palette, not copied photographs.
 * NTU reference: https://www.ntu.edu.sg/alumni/alumni-stories-news/detail/ntu-then-and-now
 * Keep 16 px tiles so the existing Minecraft atlas retains its dimensions and memory footprint.
 */
const tiles: Record<string, Tile> = {
  // The scene uses plains. Its existing #91bd59 biome tint multiplies these pale pixels
  // to approximately #6f8f52. Keeping the tint/alpha path preserves grass semantics.
  grass_block_top: { color: [195, 193, 235], contrast: 5, pattern: 'grass' },
  grass_block_side: { color: [126, 103, 80], contrast: 4, pattern: 'grass-side' },
  grass_block_side_overlay: { color: [195, 193, 235], contrast: 4, pattern: 'overlay' },
  dirt: { color: [126, 103, 80], contrast: 4 },
  stone: { color: [145, 148, 143], contrast: 3 },
  smooth_stone: { color: [179, 182, 176], contrast: 2, pattern: 'paving' },
  smooth_stone_slab_side: { color: [173, 176, 170], contrast: 2 },
  polished_andesite: { color: [141, 146, 143], contrast: 2, pattern: 'paving' },
  quartz_block_top: { color: [231, 228, 220], contrast: 2 },
  quartz_block_bottom: { color: [227, 224, 216], contrast: 2 },
  quartz_block_side: { color: [231, 228, 220], contrast: 2 },
  sandstone: { color: [194, 187, 174], contrast: 3 },
  sandstone_top: { color: [203, 197, 184], contrast: 3 },
  sandstone_bottom: { color: [188, 181, 168], contrast: 3 },
  cut_sandstone: { color: [198, 191, 178], contrast: 2 },
  white_concrete: { color: [208, 213, 211], contrast: 2 },
  light_gray_concrete: { color: [156, 159, 153], contrast: 2 },
  gray_concrete: { color: [76, 81, 82], contrast: 2 },
  yellow_concrete: { color: [218, 178, 79], contrast: 2 },
  red_concrete: { color: [157, 70, 57], contrast: 2 },
  blue_concrete: { color: [70, 92, 142], contrast: 2 },
  light_blue_concrete: { color: [89, 147, 172], contrast: 2 },
  terracotta: { color: [163, 113, 87], contrast: 2 },
  orange_terracotta: { color: [164, 105, 70], contrast: 2 },
  red_terracotta: { color: [153, 83, 65], contrast: 2 },
  yellow_terracotta: { color: [186, 149, 83], contrast: 2 },
  cyan_terracotta: { color: [108, 121, 119], contrast: 2 },
  green_terracotta: { color: [99, 114, 74], contrast: 2 }
}

function noise (x: number, y: number, seed: number) {
  let value = Math.imul(x + seed * 29, 374_761_393) ^ Math.imul(y + 17, 668_265_263)
  value = Math.imul(value ^ (value >>> 13), 1_274_126_177)
  return ((value ^ (value >>> 16)) >>> 0) / 0xFF_FF_FF_FF * 2 - 1
}

const makeTile = async (tile: Tile, seed: number): Promise<HTMLImageElement> => {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE; canvas.height = SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Campus texture canvas is unavailable')
  const pixels = context.createImageData(SIZE, SIZE)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const offset = (y * SIZE + x) * 4
      const grassDepth = 2 + (noise(x, 0, 7) > 0.35 ? 1 : 0)
      const color: RGB = tile.pattern === 'grass-side' && y < grassDepth ? [111, 143, 82] : tile.color
      let variation = noise(x, y, seed) * tile.contrast
      if (tile.pattern === 'grass') variation += noise(x, Math.floor(y / 3), 13) * 2
      // A restrained joint indicates existing paving without adding a new material region.
      if (tile.pattern === 'paving' && (x === 0 || y === 0)) variation -= 6
      for (let channel = 0; channel < 3; channel++) pixels.data[offset + channel] = Math.round(color[channel] + variation)
      pixels.data[offset + 3] = tile.pattern === 'overlay' && y >= grassDepth ? 0 : 255
    }
  }
  context.putImageData(pixels, 0, 0)
  const image = new Image()
  image.src = canvas.toDataURL('image/png')
  await image.decode()
  return image
}

/** Ephemeral local-scene overrides. Never installs a pack or changes saved global settings. */
export async function applyNtuCampusTextures (resources: TextureResources, existingTextures: readonly string[]): Promise<number> {
  if (!isNtuMapRebuild()) return 0
  const available = new Set(existingTextures)
  const selected = Object.entries(tiles).filter(([name]) => available.has(name))
  // Build completely before mutating so a failed image decode leaves the previous pack intact.
  const entries = await Promise.all(selected.map(async ([name, tile], index) => [name, await makeTile(tile, index + 1)] as const))
  const previous = resources.customTextures.blocks
  resources.customTextures.blocks = { tileSize: previous?.tileSize ?? SIZE, textures: { ...previous?.textures, ...Object.fromEntries(entries) } }
  return entries.length
}
