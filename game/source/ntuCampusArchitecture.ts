import { Vec3 } from 'vec3'
import { createLandmarkDecorator } from './ntuLandmarkArchitecture'
import { createSpineDecorator } from './ntuSpineArchitecture'
import { createCampusPaletteDecorator } from './ntuCampusPalette'

/** Keep authored landmark coordinates independent of the full-campus extent. */
export function createCampusArchitecture (data: any, offset = { x: 0, y: 0, z: 0 }) {
  if (offset.x % 16 || offset.z % 16) throw new Error('The campus architecture origin must align to chunks.')
  const spines = createSpineDecorator(data)
  const landmarks = createLandmarkDecorator(data)
  const palette = createCampusPaletteDecorator(data)
  const decorated = new WeakSet<object>()
  return (chunk: any, chunkX: number, chunkZ: number) => {
    const x = chunkX - offset.x / 16, z = chunkZ - offset.z / 16
    if (decorated.has(chunk)) return
    decorated.add(chunk)
    palette(chunk, chunkX, chunkZ)
    if (x < 20 || x > 61 || z < 11 || z > 54) return
    const p = new Vec3(0, 0, 0)
    const position = (value: Vec3) => p.set(value.x, value.y + offset.y, value.z)
    const local = {
      getBlockStateId: (value: Vec3) => chunk.getBlockStateId(position(value)),
      setBlockStateId: (value: Vec3, state: number) => chunk.setBlockStateId(position(value), state),
      setSkyLight: (value: Vec3, light: number) => chunk.setSkyLight(position(value), light),
      setBlockLight: (value: Vec3, light: number) => chunk.setBlockLight(position(value), light)
    }
    spines(local, x, z)
    landmarks(local, x, z)
  }
}
