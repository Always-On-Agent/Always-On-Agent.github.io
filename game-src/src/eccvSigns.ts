import { CanvasTexture, FrontSide, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three'
import type { Object3D } from 'three'
import { ECCV_SCENE } from './eccvWorld'

type SignRenderer = {
  sceneOrigin?: {
    addAndTrack: (object: Object3D) => void
    removeAndUntrack: (object: Object3D) => void
  }
}
type SignResource = {
  mesh: Mesh
  geometry: PlaneGeometry
  material: MeshBasicMaterial
  texture: CanvasTexture
}

/**
 * Original, readable conference signs. These are ordinary opaque scene meshes:
 * walls and poster boards occlude them, and they never alter the camera or game.
 * Unsupported renderers or unavailable 2D canvas contexts simply omit signage.
 */
export function installEccvSigns (renderer: SignRenderer | null | undefined): () => void {
  const origin = renderer?.sceneOrigin
  const noop = () => {}
  if (typeof document === 'undefined' || !origin || typeof origin.addAndTrack !== 'function' || typeof origin.removeAndUntrack !== 'function') return noop

  const resources: SignResource[] = []
  let disposed = false
  const cleanup = () => {
    if (disposed) return
    disposed = true
    for (const { mesh, geometry, material, texture } of resources) {
      // The renderer can already have reset its scene when the bot ends.
      try { origin.removeAndUntrack(mesh) } catch { mesh.removeFromParent() }
      geometry.dispose()
      material.dispose()
      texture.dispose()
    }
    resources.length = 0
  }

  const signs = [
    ...ECCV_SCENE.posters.map((poster, index) => ({
      id: poster.id,
      title: poster.title,
      eyebrow: `${String(index + 1).padStart(2, '0')} / ECCV POSTER`,
      accent: poster.color,
      position: { ...poster.label, z: poster.position.z + 1.04 },
      width: 6.4,
      height: 1.4
    })),
    {
      id: 'booth-44',
      title: 'EgoPoster',
      eyebrow: 'BOOTH 44 / ACTION INTELLIGENCE',
      accent: '#4567a4',
      position: ECCV_SCENE.boothLabel,
      width: 7.2,
      height: 1.575
    }
  ]

  try {
    for (const sign of signs) {
      const canvas = document.createElement('canvas')
      canvas.width = 1024
      canvas.height = 224
      const context = canvas.getContext('2d')
      if (!context) { cleanup(); return noop }
      context.fillStyle = '#fafcf8'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = sign.accent
      context.fillRect(0, 0, 16, canvas.height)
      context.fillRect(0, canvas.height - 8, canvas.width, 8)
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = sign.accent
      context.font = '600 28px system-ui, sans-serif'
      context.fillText(sign.eyebrow, 522, 49, 920)
      context.fillStyle = '#243c3a'
      context.font = '650 82px system-ui, sans-serif'
      context.fillText(sign.title, 522, 132, 920)

      const texture = new CanvasTexture(canvas)
      texture.colorSpace = SRGBColorSpace
      texture.magFilter = LinearFilter
      texture.anisotropy = 4
      const material = new MeshBasicMaterial({
        map: texture,
        side: FrontSide,
        transparent: false,
        depthTest: true,
        depthWrite: true,
        toneMapped: false
      })
      const geometry = new PlaneGeometry(sign.width, sign.height)
      // PlaneGeometry's front face points +Z, matching every authored poster.
      const mesh = new Mesh(geometry, material)
      mesh.name = `eccv-sign-${sign.id}`
      resources.push({ mesh, geometry, material, texture })
      origin.addAndTrack(mesh)
      // Tracking installs a world-coordinate position proxy. Set the position
      // afterwards: setting it before tracking would be lost on the next rebase.
      mesh.position.set(sign.position.x, sign.position.y, sign.position.z)
    }
  } catch {
    cleanup()
    return noop
  }
  return cleanup
}
