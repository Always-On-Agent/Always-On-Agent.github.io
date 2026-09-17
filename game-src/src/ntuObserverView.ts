import type { Vec3 } from 'vec3'

type ObserverMode = 'walk' | 'fly' | 'overhead'
type Player = {
  entity?: { position: Vec3, yaw?: number, pitch?: number }
  settings?: { viewDistance?: number | string }
  setSettings?: (settings: { viewDistance: number }) => void
}
type WorldView = {
  viewDistance: number
  updateViewDistance: (distance: number) => void
  updatePosition: (position: Vec3, force?: boolean) => Promise<void>
}
type Viewer = {
  worldView?: WorldView
  backend?: { updateCamera: (position: Vec3 | null, yaw: number, pitch: number) => void }
}

const numericDistance = (value: number | string | undefined, fallback: number) => {
  const numeric = typeof value === 'string' ? ({ tiny: 6, short: 8, normal: 10, far: 12 }[value] ?? Number(value)) : value
  return Number.isFinite(numeric) && numeric! >= 1 ? Math.floor(numeric!) : fallback
}

/** Widen this live world's view during observation without persisting user options. */
export function createNtuObserverView (player: Player, viewer: Viewer) {
  let saved: { worldView: WorldView, renderDistance: number, clientDistance: number } | undefined
  let disposed = false
  const refreshCamera = () => {
    const { entity } = player
    if (entity) viewer.backend?.updateCamera(null, entity.yaw ?? 0, entity.pitch ?? 0)
  }
  const restore = async () => {
    const previous = saved
    saved = undefined
    if (!previous || viewer.worldView !== previous.worldView) return
    // Restore renderer state even if the local connection has already closed.
    try { player.setSettings?.({ viewDistance: previous.clientDistance }) } finally {
      previous.worldView.updateViewDistance(previous.renderDistance)
      refreshCamera()
      if (player.entity) await previous.worldView.updatePosition(player.entity.position, true)
    }
  }
  return {
    async setMode (mode: ObserverMode) {
      if (disposed) return
      if (mode === 'walk') { await restore(); refreshCamera(); return }
      const { worldView } = viewer
      if (!worldView || !player.entity) return
      if (!saved || saved.worldView !== worldView) {
        const renderDistance = numericDistance(worldView.viewDistance, 2)
        saved = { worldView, renderDistance, clientDistance: numericDistance(player.settings?.viewDistance, renderDistance) }
      }
      const distance = Math.max(4, saved.renderDistance, saved.clientDistance)
      const clientChanged = numericDistance(player.settings?.viewDistance, worldView.viewDistance) !== distance
      const rendererChanged = worldView.viewDistance !== distance
      if (clientChanged) player.setSettings?.({ viewDistance: distance })
      if (rendererChanged) {
        worldView.updateViewDistance(distance)
      }
      // bot.look() updates the entity; publish that orientation to the camera now.
      refreshCamera()
      if (clientChanged || rendererChanged) await worldView.updatePosition(player.entity.position, true)
    },
    dispose () {
      if (disposed) return
      disposed = true
      void restore().catch(() => {})
    }
  }
}
