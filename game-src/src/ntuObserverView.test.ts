import { expect, test, vi } from 'vitest'
import { Vec3 } from 'vec3'
import { createNtuObserverView } from './ntuObserverView'

function fixture (distance = 2) {
  const player = {
    entity: { position: new Vec3(76, 97, 471), yaw: .2, pitch: -Math.PI / 2 },
    settings: { viewDistance: distance },
    setSettings: vi.fn(({ viewDistance }: { viewDistance: number }) => { player.settings.viewDistance = viewDistance })
  }
  const worldView = {
    viewDistance: distance,
    updateViewDistance: vi.fn((value: number) => { worldView.viewDistance = value }),
    updatePosition: vi.fn(async (_position: Vec3, _force?: boolean) => {})
  }
  const viewer = { worldView, backend: { updateCamera: vi.fn() } }
  return { player, worldView, viewer, control: createNtuObserverView(player, viewer) }
}

test('observation widens client streaming and renderer fog distance, then publishes the downward camera', async () => {
  const f = fixture()
  await f.control.setMode('overhead')
  expect(f.player.setSettings).toHaveBeenCalledWith({ viewDistance: 4 })
  expect(f.worldView.updateViewDistance).toHaveBeenCalledWith(4)
  expect(f.worldView.updatePosition).toHaveBeenCalledWith(f.player.entity.position, true)
  expect(f.viewer.backend.updateCamera).toHaveBeenLastCalledWith(null, .2, -Math.PI / 2)
})

test('switching observer cameras preserves the walking distance for restoration', async () => {
  const f = fixture()
  await f.control.setMode('fly')
  await f.control.setMode('overhead')
  expect(f.player.setSettings).toHaveBeenCalledTimes(1)
  await f.control.setMode('walk')
  expect(f.player.settings.viewDistance).toBe(2)
  expect(f.worldView.viewDistance).toBe(2)
  expect(f.worldView.updatePosition).toHaveBeenCalledTimes(2)
})

test('cleanup restores live distances once and ignores subsequent mode changes', async () => {
  const f = fixture(1)
  await f.control.setMode('fly')
  f.control.dispose(); f.control.dispose()
  await f.control.setMode('fly')
  expect(f.player.settings.viewDistance).toBe(1)
  expect(f.worldView.viewDistance).toBe(1)
  expect(f.player.setSettings).toHaveBeenCalledTimes(2)
})

test('observer view respects an already larger explicit distance', async () => {
  const f = fixture(8)
  await f.control.setMode('overhead')
  expect(f.player.setSettings).not.toHaveBeenCalled()
  expect(f.worldView.viewDistance).toBe(8)
  await f.control.setMode('walk')
  expect(f.worldView.viewDistance).toBe(8)
})

test('old-scene cleanup cannot change a replacement world renderer', async () => {
  const f = fixture()
  await f.control.setMode('fly')
  const replacement = { ...f.worldView, viewDistance: 3, updateViewDistance: vi.fn() }
  f.viewer.worldView = replacement
  f.control.dispose()
  expect(replacement.updateViewDistance).not.toHaveBeenCalled()
  expect(f.player.setSettings).toHaveBeenCalledTimes(1)
})
