import { Euler, Quaternion, Vector3, type Object3D } from 'three'
import { Vec3 } from 'vec3'

type Point = { x: number, y: number, z: number }
type Control = 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sprint' | 'sneak'
type PlayerEvent = 'physicsTick' | 'end' | 'forcedMove'
export type EpisodeWalkResult = { ok: boolean, reason: string, distance: number }
type Player = {
  entity?: { position: Point, yaw?: number, pitch?: number, eyeHeight?: number, onGround?: boolean, flying?: boolean }
  game?: { gameMode?: string }
  setControlState: (control: Control, value: boolean) => void
  clearControlStates: () => void
  look: (yaw: number, pitch: number, force?: boolean) => Promise<void> | void
  blockAt?: (position: Vec3) => any
  on: (event: PlayerEvent, listener: (...args: any[]) => void) => any
  removeListener: (event: PlayerEvent, listener: (...args: any[]) => void) => any
}
type Renderer = {
  sceneOrigin?: { x?: number, y?: number, z?: number, addAndTrack: (object: Object3D) => void, removeAndUntrack: (object: Object3D) => void }
  updateCamera?: (position: null, yaw: number, pitch: number) => void
  backend?: { updateCamera: (position: null, yaw: number, pitch: number) => void }
}
type Walk = {
  points: Point[], index: number, distance: number, elapsed: number,
  last: Point, progressTime: number, progressDistance: number, airTime: number,
  resolve: (result: EpisodeWalkResult) => void, callback?: (result: EpisodeWalkResult) => void,
  signal?: AbortSignal, abort: () => void
}
const valid = (p: Point | undefined): p is Point => !!p && [p.x, p.y, p.z].every(Number.isFinite)
const gap = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)
const angle = (value: number) => Math.atan2(Math.sin(value), Math.cos(value))
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))

/**
 * Continuous local-player movement. Only Mineflayer input changes move the player;
 * this adapter never writes entity.position, velocity, or server teleport packets.
 * Preparation/shuttle travel is deliberately owned by the calling UI.
 */
export function createNtuLiveEpisodeRuntime ({ bot, renderer = {}, actions: _actions }: { bot: Player, renderer?: Renderer, actions?: unknown }) {
  const tracked = new Set<Object3D>()
  const camera = { position: new Vector3(), quaternion: new Quaternion() }
  const rotation = new Euler(0, 0, 0, 'YXZ')
  let route: Walk | undefined; let lastResult: EpisodeWalkResult | undefined
  let paused = false; let disposed = false; let silentPhysicsTime = 0
  let desiredLook: { yaw: number, pitch: number } | undefined
  const position = () => bot.entity?.position
  const eyeHeight = () => bot.entity?.eyeHeight ?? 1.65
  const grounded = () => bot.entity?.onGround === true
  const isWalkingMode = () => !bot.entity?.flying && bot.game?.gameMode !== 'spectator'
  const clear = () => bot.clearControlStates()
  function syncCamera () {
    const { entity } = bot
    if (!entity) return
    camera.position.set(entity.position.x, entity.position.y + eyeHeight(), entity.position.z)
    camera.quaternion.setFromEuler(rotation.set(entity.pitch ?? 0, entity.yaw ?? 0, 0, 'YXZ'))
  }
  function finish (ok: boolean, reason: string) {
    const previous = route
    if (!previous) return
    route = undefined
    clear()
    previous.signal?.removeEventListener('abort', previous.abort)
    lastResult = { ok, reason, distance: previous.distance }
    previous.resolve(lastResult)
    previous.callback?.(lastResult)
  }
  function lookAt (target: Point) {
    const p = position()
    if (!valid(target) || !p || disposed) return
    desiredLook = { yaw: Math.atan2(p.x - target.x, p.z - target.z), pitch: Math.atan2(target.y - p.y - eyeHeight(), gap(p, target)) }
  }
  function turn (dt: number) {
    if (!desiredLook || !bot.entity) return
    const blend = 1 - Math.exp(-8 * dt)
    const yaw = (bot.entity.yaw ?? 0) + angle(desiredLook.yaw - (bot.entity.yaw ?? 0)) * blend
    const pitch = (bot.entity.pitch ?? 0) + (desiredLook.pitch - (bot.entity.pitch ?? 0)) * blend
    // Force applies this small interpolated angle immediately; it does not queue
    // a second long-lived Mineflayer looking task for every animation frame.
    void Promise.resolve(bot.look(yaw, pitch, true)).catch(() => finish(false, 'look-failed'))
    const cameraBackend = renderer.backend ?? renderer
    cameraBackend.updateCamera?.(null, yaw, pitch)
  }
  function physicsTick () {
    silentPhysicsTime = 0
    if (disposed || !route) return
    const p = position(); const current = route
    if (!p || !valid(p)) { finish(false, 'not-ready'); return }
    if (!isWalkingMode()) { finish(false, 'not-walking'); return }
    const moved = gap(p, current.last); const dy = Math.abs(p.y - current.last.y)
    current.last = { ...p }
    // A forced move or externally applied jump must not count as walked travel.
    if (moved > 1 || dy > 1.5) { finish(false, 'displaced'); return }
    if (paused) { clear(); return }
    current.distance += moved
    current.elapsed += .05
    current.airTime = grounded() ? 0 : current.airTime + .05
    if (current.airTime >= 2) { finish(false, 'no-ground'); return }
    while (route && grounded() && gap(p, current.points[current.index]) < .32 && Math.abs(p.y - current.points[current.index].y) < .7) {
      if (++current.index === current.points.length) { finish(true, 'arrived'); return }
    }
    const target = current.points[current.index]
    if (Math.abs(p.y - target.y) > 2) { finish(false, 'off-route'); return }
    desiredLook = { yaw: Math.atan2(p.x - target.x, p.z - target.z), pitch: 0 }
    turn(.05)
    const facing = Math.abs(angle(desiredLook.yaw - (bot.entity?.yaw ?? 0))) < .18
    // Use continuous vanilla walking. The shared API's speed hint is not a
    // physics override; normal Minecraft speed is smoother than pulsed keys.
    bot.setControlState('forward', facing)
    current.progressTime += .05
    if (current.progressTime >= 3) {
      if (current.distance - current.progressDistance < .15) { finish(false, 'blocked'); return }
      current.progressTime = 0; current.progressDistance = current.distance
    }
    if (current.elapsed > 180) finish(false, 'timeout')
    syncCamera()
  }
  const disconnected = () => { finish(false, 'disconnected'); desiredLook = undefined }
  const forcedMove = () => { if (route) finish(false, 'displaced') }
  bot.on('physicsTick', physicsTick)
  bot.on('end', disconnected)
  bot.on('forcedMove', forcedMove)
  syncCamera()
  const scene = {
    add (object: Object3D) {
      if (disposed || tracked.has(object)) return
      if (!renderer.sceneOrigin) throw new Error('Minecraft renderer scene origin is not ready.')
      renderer.sceneOrigin.addAndTrack(object)
      // Actor children retain absolute source coordinates under this world-zero
      // parent. Only the top-level group participates in floating-origin rebases.
      object.position.set(0, 0, 0)
      tracked.add(object)
    },
    remove (object: Object3D) {
      if (tracked.delete(object)) renderer.sceneOrigin?.removeAndUntrack(object)
    }
  }
  return {
    scene, camera,
    getCamera () { syncCamera(); return camera },
    toRenderPosition (p: Point) {
      const origin = renderer.sceneOrigin
      return new Vector3(p.x - (origin?.x ?? 0), p.y - (origin?.y ?? 0), p.z - (origin?.z ?? 0))
    },
    getGroundHeight (p: Point): number | undefined {
      if (!valid(p) || !bot.blockAt) return undefined
      for (let y = Math.floor(p.y + 2); y >= Math.floor(p.y - 12); y--) {
        const block = bot.blockAt(new Vec3(Math.floor(p.x), y, Math.floor(p.z)))
        if (!block) return undefined
        const shapes: number[][] = block.shapes ?? (block.boundingBox === 'block' ? [[0, 0, 0, 1, 1, 1]] : [])
        const fx = p.x - Math.floor(p.x); const fz = p.z - Math.floor(p.z)
        const surface = shapes.filter(shape => fx >= shape[0] && fx <= shape[3] && fz >= shape[2] && fz <= shape[5]).map(shape => y + shape[4])
        if (surface.length) return Math.max(...surface)
      }
      return undefined
    },
    setMode (mode: string) {
      if (mode !== 'walk' || !isWalkingMode()) throw new Error('Return to walking mode before starting the episode.')
    },
    setPosition (p: Point, target?: Point) {
      const actual = position()
      if (!valid(p) || !actual || gap(actual, p) > .75 || Math.abs(actual.y - p.y) > 1) throw new Error('Walk to the episode start before starting playback.')
      if (target) lookAt(target)
      syncCamera()
    },
    getState () {
      const p = position()
      let remaining = route && p ? gap(p, route.points[route.index]) : 0
      if (route) for (let i = route.index + 1; i < route.points.length; i++) remaining += gap(route.points[i - 1], route.points[i])
      return { mode: 'walk', position: p ? { ...p } : undefined, yaw: bot.entity?.yaw ?? 0, pitch: bot.entity?.pitch ?? 0, grounded: grounded(), paused, walking: !!route, distance: route?.distance ?? lastResult?.distance ?? 0, remaining, waypoint: route?.index ?? 0, blocked: lastResult?.reason === 'blocked', lastRouteResult: lastResult }
    },
    lookAt,
    async autoWalk (points: readonly Point[], callback?: (result: EpisodeWalkResult) => void, signal?: AbortSignal, options: { speed?: number } = {}) {
      finish(false, 'cancelled')
      clear()
      const reject = async (reason: string) => { const result = { ok: false, reason, distance: 0 }; lastResult = result; callback?.(result); return result }
      if (disposed || signal?.aborted) return reject('cancelled')
      const p = position()
      if (!p || !isWalkingMode()) return reject('not-walking')
      if (!points.length || points.some(p => !valid(p))) return reject('invalid-path')
      if (gap(p, points[0]) > 3 || Math.abs(p.y - points[0].y) > 2) return reject('not-at-start')
      silentPhysicsTime = 0
      return new Promise<EpisodeWalkResult>(resolve => {
        route = {
          points: points.map(p => ({ ...p })), index: 0, distance: 0, elapsed: 0,
          last: { ...p }, progressTime: 0, progressDistance: 0, airTime: 0, resolve, callback, signal,
          abort: () => finish(false, 'cancelled')
        }
        signal?.addEventListener('abort', route.abort, { once: true })
      })
    },
    setPaused (value: boolean) {
      paused = value
      if (value) clear()
      if (route && position()) route.last = { ...position()! }
      silentPhysicsTime = 0
    },
    stop () { finish(false, 'cancelled'); desiredLook = undefined; clear() },
    update (dt: number) {
      if (disposed) return
      dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .25)
      if (route && !paused) {
        silentPhysicsTime += dt
        if (silentPhysicsTime > 8) finish(false, 'physics-unavailable')
      }
      if (!route || paused) turn(dt)
      syncCamera()
    },
    dispose () {
      if (disposed) return
      disposed = true; finish(false, 'cancelled'); desiredLook = undefined; clear()
      bot.removeListener('physicsTick', physicsTick)
      bot.removeListener('end', disconnected)
      bot.removeListener('forcedMove', forcedMove)
      for (const object of tracked) renderer.sceneOrigin?.removeAndUntrack(object)
      tracked.clear()
    }
  }
}
