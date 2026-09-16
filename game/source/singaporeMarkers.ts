import { BoxGeometry, CanvasTexture, DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three'
import type { Object3D } from 'three'

type MarkerStation = { id: string, name: { en: string, zh: string }, position: { x: number, y: number, z: number }, approach: { yaw?: number } }
type Renderer = { sceneOrigin?: { addAndTrack: (object: Object3D) => void, removeAndUntrack: (object: Object3D) => void } }

/** Fictional exhibit signs layered over the generated geographic world. */
export function installSingaporeMarkers (renderer: Renderer, stations: readonly MarkerStation[]) {
  const origin = renderer?.sceneOrigin
  if (!origin) return () => {}
  const entries: Array<{ mesh: Mesh, texture?: CanvasTexture }> = []
  const add = (mesh: Mesh, position: { x: number, y: number, z: number }, texture?: CanvasTexture) => {
    entries.push({ mesh, texture }); origin.addAndTrack(mesh); mesh.position.set(position.x, position.y, position.z)
  }
  let disposed = false
  const cleanup = () => {
    if (disposed) return
    disposed = true
    for (const { mesh, texture } of entries) {
      try { origin.removeAndUntrack(mesh) } catch { mesh.removeFromParent() }
      mesh.geometry.dispose()
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
      texture?.dispose()
    }
  }
  try {
    for (const station of stations) {
      const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 432
      const ctx = canvas.getContext('2d')
      if (!ctx) { cleanup(); return () => {} }
      ctx.fillStyle = '#f4f8f2'; ctx.fillRect(0, 0, 1024, 432)
      ctx.fillStyle = '#557b69'; ctx.fillRect(0, 0, 1024, 15)
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = '600 32px system-ui,sans-serif'; ctx.fillText('ALWAYS ON / NTU DEMO', 512, 73)
      ctx.fillStyle = '#243b32'; ctx.font = '600 56px system-ui,sans-serif'; ctx.fillText(station.name.en, 512, 160, 925)
      ctx.font = '500 42px system-ui,sans-serif'; ctx.fillText(station.name.zh, 512, 232, 925)
      ctx.fillStyle = '#748277'; ctx.font = '400 30px system-ui,sans-serif'; ctx.fillText('FICTIONAL DEMO STATION · 虚构试玩站点', 512, 335, 925)
      const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.anisotropy = 4
      const panel = new Mesh(new PlaneGeometry(1.9, .8), new MeshBasicMaterial({ map: texture, side: DoubleSide, toneMapped: false }))
      panel.rotation.y = station.approach.yaw ?? 0
      add(panel, { x: station.position.x + .5, y: station.position.y + .5, z: station.position.z + .5 }, texture)
      const pole = new Mesh(new BoxGeometry(.09, 1.1, .09), new MeshBasicMaterial({ color: '#577565' }))
      add(pole, { x: station.position.x + .5, y: station.position.y - .3, z: station.position.z + .5 })
      const base = new Mesh(new BoxGeometry(.9, .12, .9), new MeshBasicMaterial({ color: '#73897a' }))
      add(base, { x: station.position.x + .5, y: station.position.y - .85, z: station.position.z + .5 })
    }
  } catch { cleanup() }
  return cleanup
}
