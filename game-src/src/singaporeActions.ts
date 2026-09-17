import { Vec3 } from 'vec3'

type Position = { x: number, y: number, z: number }
type Station = { id: string, position: Position, approach: Position & { yaw?: number } }
type Result = { ok: boolean, receiptId?: string, reason?: string, observerMode?: 'walk' | 'fly' | 'overhead' }
type PreloadEntry = { x: number, z: number, users: number, owned: boolean, settled: boolean, column?: any, ready: Promise<any> }
const LOAN = 'NTU-DEMO-LOAN-1'
const KIT = 'NTU-DEMO-KIT-1'
const point = (p: Position) => new Vec3(p.x, p.y, p.z)

/** The item tag uses the modern component format used by the imported 1.21.4 map. */
export function taggedSingaporeItem (server: any, name: string, tag: string) {
  const item = new server.PrismarineItem(server.mcData.itemsByName[name].id, 1)
  const data = { type: 'compound', name: '', value: { AlwaysOnTask: { type: 'string', value: tag } } }
  if (Array.isArray(item.components)) {
    const component = { type: 'custom_data', data }
    item.components.push(component)
    item.componentMap?.set('custom_data', component)
  } else { item.nbt = data }
  return item
}

function hasTag (item: any, tag: string) {
  const component = item?.components?.find((entry: any) => entry.type === 'custom_data')
  return (component?.data ?? item?.nbt)?.value?.AlwaysOnTask?.value === tag
}

const travelAbortError = () => {
  const error = new Error('Shuttle travel was cancelled.')
  error.name = 'AbortError'
  return error
}
const checkTravelActive = (signal?: AbortSignal) => { if (signal?.aborted) throw travelAbortError() }

/** Stop awaiting read-only loads immediately; the underlying shared cache may finish. */
async function cancellableTravel<T> (work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work
  return new Promise((resolve, reject) => {
    const abort = () => reject(travelAbortError())
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
    void work.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => { signal.removeEventListener('abort', abort); reject(error) })
  })
}

/** Wait for the actual client move and the server's teleport handshake. */
async function teleportAndConfirm (visitor: any, bot: any, destination: Vec3, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const previousId = visitor.lastTeleportId ?? 0
    let moved = false
    let acknowledgedId = -1
    let sent = false
    let finished = false
    const cleanup = () => {
      clearTimeout(timeout)
      clearInterval(poll)
      bot.removeListener('forcedMove', onForcedMove)
      bot.removeListener('end', onEnd)
      visitor._client.removeListener('teleport_confirm', onConfirm)
      signal?.removeEventListener('abort', onAbort)
    }
    const finish = (error?: Error) => {
      if (finished) return
      finished = true
      cleanup()
      if (error) reject(error)
      else resolve()
    }
    const atDestination = (position: Vec3 | undefined) => position && position.distanceTo(destination) < .2
    const check = () => {
      if (sent && moved && acknowledgedId > previousId && acknowledgedId === visitor.lastTeleportId
        && !visitor.pendingTeleport && (!visitor.validateNextPosition || atDestination(visitor.validateNextPosition))
        && atDestination(visitor.position) && atDestination(bot.entity?.position)) finish()
    }
    const onForcedMove = () => { moved = !!atDestination(bot.entity?.position); check() }
    const onConfirm = ({ teleportId }: { teleportId: number }) => { acknowledgedId = teleportId; check() }
    const onEnd = () => finish(new Error('Disconnected during shuttle travel.'))
    const onAbort = () => finish(travelAbortError())
    const timeout = setTimeout(() => finish(new Error('Shuttle arrival was not confirmed.')), 8000)
    const poll = setInterval(check, 25)
    bot.on('forcedMove', onForcedMove)
    bot.on('end', onEnd)
    // flying-squid wraps client.on callbacks; its original registrar keeps this
    // short-lived listener removable by the same function reference.
    const listen = visitor._client.oldAddListener ?? visitor._client.on.bind(visitor._client)
    listen('teleport_confirm', onConfirm)
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) { onAbort(); return }
    // teleport() resolves after queuing the position packet, before our async
    // local channel delivers it. Its old yaw would overwrite an earlier look().
    void Promise.resolve().then(() => {
      checkTravelActive(signal)
      const previousTarget = visitor.validateNextPosition
      // flying-squid can retain this guard after an identical position reply:
      // sendPosition returns before its safe-zone listener gets to clear it.
      // Finish only that already-observed validation; preserve any outstanding
      // teleport or correction whose target either endpoint has not reached.
      if (!visitor.pendingTeleport && previousTarget
        && previousTarget.distanceTo(visitor.position) < .1
        && previousTarget.distanceTo(bot.entity.position) < .1) visitor.validateNextPosition = undefined
      return visitor.teleport(destination)
    }).then(() => {
      if (signal?.aborted) { onAbort(); return }
      sent = true
      check()
    }, error => finish(error))
  })
}

/** Real local-server inventory transactions; narrative progress lives in the HUD memory. */
export function createSingaporeActions (server: any, playerBot: any, stations: readonly Station[]) {
  let bookReturned = false
  let kitCollected = false
  let travelling = false
  let observerOrigin: { position: Vec3, yaw: number, pitch: number, gameMode: number, flying: boolean } | undefined
  let observerMode: 'fly' | 'overhead' | undefined
  const preloads = new Map<string, PreloadEntry>()
  const player = () => server.players?.find((entry: any) => entry.username === playerBot.username)
  const station = (id: string) => stations.find(entry => entry.id === id)
  const near = (id: string) => {
    const target = station(id)
    return !!target && !!player()?.position && player().position.distanceTo(point(target.position).offset(0.5, 0.5, 0.5)) <= 5.5
  }
  const preload = (destination: Position) => {
    const world = server.overworld
    const cx = Math.floor(destination.x / 16); const cz = Math.floor(destination.z / 16)
    const clean = (key: string, entry: PreloadEntry) => {
      if (entry.users || !entry.settled) return
      if (preloads.get(key) === entry) preloads.delete(key)
      if (!entry.owned || !entry.column || server.chunksUsed?.[key]) return
      const inUse = server.players?.some((visitor: any) => {
        if (visitor.world && visitor.world !== world) return false
        if (visitor.loadedChunks?.[key]) return true
        const radius = Number.isFinite(visitor.view) ? Math.max(1, visitor.view) : 2
        return [visitor.position, visitor.pendingTeleport?.position, visitor.validateNextPosition].some(position => position
          && Math.abs(Math.floor(position.x / 16) - entry.x) <= radius
          && Math.abs(Math.floor(position.z / 16) - entry.z) <= radius)
      })
      if (!inUse && world.getLoadedColumn?.(entry.x, entry.z) === entry.column) world.unloadColumn?.(entry.x, entry.z)
    }
    const leases = Array.from({ length: 9 }, (_, index) => {
      const x = cx + index % 3 - 1; const z = cz + Math.floor(index / 3) - 1; const key = `${x},${z}`
      let entry = preloads.get(key)
      if (!entry) {
        entry = { x, z, users: 0, owned: !world.getLoadedColumn?.(x, z), settled: false, ready: undefined! }
        const current = entry
        preloads.set(key, current)
        current.ready = Promise.resolve(world.getColumn(x, z)).then(column => { current.column = column; return column })
          .finally(() => { current.settled = true; clean(key, current) })
      }
      entry.users++
      return { key, entry }
    })
    let released = false
    return {
      ready: Promise.all(leases.map(async ({ entry }) => entry.ready)),
      release () {
        if (released) return
        released = true
        // A cancelled caller returns promptly. Its unfinished loads release
        // themselves later, without evicting a subsequent trip's shared lease.
        for (const { key, entry } of leases) { entry.users--; clean(key, entry) }
      }
    }
  }
  const stopMovement = () => {
    playerBot.clearControlStates()
    for (const velocity of [playerBot.entity?.velocity, playerBot.physicsEngineCtx?.state?.vel, player()?.velocity]) velocity?.update?.(new Vec3(0, 0, 0))
  }
  const grant = (name: string, tag: string): Result => {
    const visitor = player()
    if (!visitor?.inventory || !server.PrismarineItem) return { ok: false, reason: 'not-ready' }
    if (visitor.inventory.slots.some((item: any) => hasTag(item, tag))) return { ok: true }
    const slot = visitor.inventory.slots[36] ? visitor.inventory.firstEmptyInventorySlot() : 36
    if (slot === null || slot === undefined || slot < 0) return { ok: false, reason: 'inventory-full' }
    visitor.inventory.updateSlot(slot, taggedSingaporeItem(server, name, tag))
    return { ok: true }
  }
  return {
    async acceptLoan (): Promise<Result> {
      if (bookReturned) return { ok: false, reason: 'already-returned' }
      return grant('book', LOAN)
    },
    async returnLoan (): Promise<Result> {
      if (bookReturned) return { ok: false, reason: 'already-returned' }
      if (!near('return')) return { ok: false, reason: 'too-far' }
      const visitor = player()
      const slot = visitor.inventory.slots.findIndex((item: any) => hasTag(item, LOAN))
      if (slot < 0) return { ok: false, reason: 'book-missing' }
      visitor.inventory.updateSlot(slot, null)
      bookReturned = true
      return { ok: true, receiptId: `NTU-RETURN-${Date.now().toString(36)}` }
    },
    async collectKit (): Promise<Result> {
      if (kitCollected) return { ok: false, reason: 'already-collected' }
      if (!near('plaza')) return { ok: false, reason: 'too-far' }
      const result = grant('bundle', KIT)
      if (!result.ok) return result
      kitCollected = true
      return { ok: true, receiptId: `NTU-KIT-${Date.now().toString(36)}` }
    },
    /** Only called after the visitor explicitly selects a simulated shuttle stop. */
    async shuttle (id: string, signal?: AbortSignal): Promise<Result> {
      if (signal?.aborted) return { ok: false, reason: 'cancelled' }
      const target = station(id)
      const visitor = player()
      if (!target || !visitor || travelling) return { ok: false, reason: 'not-ready' }
      if (observerOrigin) return { ok: false, reason: 'observer-mode' }
      travelling = true
      let destinationLoad: ReturnType<typeof preload> | undefined
      try {
        playerBot.clearControlStates()
        // Load the destination before moving; never place a visitor on missing terrain.
        destinationLoad = preload(target.approach)
        await cancellableTravel(destinationLoad.ready, signal)
        checkTravelActive(signal)
        const foot = point(target.approach).floored()
        const floor = await cancellableTravel(Promise.resolve(server.overworld.getBlock(foot.offset(0, -1, 0))), signal)
        const body = await cancellableTravel(Promise.resolve(server.overworld.getBlock(foot)), signal)
        const head = await cancellableTravel(Promise.resolve(server.overworld.getBlock(foot.offset(0, 1, 0))), signal)
        checkTravelActive(signal)
        if (floor?.boundingBox !== 'block' || body?.boundingBox === 'block' || head?.boundingBox === 'block') return { ok: false, reason: 'unsafe-stop' }
        await teleportAndConfirm(visitor, playerBot, point(target.approach), signal)
        checkTravelActive(signal)
        await cancellableTravel(playerBot.look(target.approach.yaw ?? 0, 0, true), signal)
        checkTravelActive(signal)
        return { ok: true }
      } catch { return { ok: false, reason: signal?.aborted ? 'cancelled' : 'travel-failed' } } finally {
        destinationLoad?.release()
        travelling = false
      }
    },
    /** Local observation uses the real spectator mode; walking resumes at its saved origin. */
    async observer (mode: 'fly' | 'overhead' | 'walk'): Promise<Result> {
      const visitor = player()
      if (!visitor?.setGameMode || !visitor.position || travelling) return { ok: false, reason: 'not-ready', observerMode: observerMode ?? 'walk' }
      if (mode === 'walk' && !observerOrigin) return { ok: true, observerMode: 'walk' }
      if (mode === observerMode) return { ok: true, observerMode }
      travelling = true
      let destinationLoad: ReturnType<typeof preload> | undefined
      try {
        stopMovement()
        observerOrigin ??= {
          position: point(visitor.position), yaw: playerBot.entity?.yaw ?? 0, pitch: playerBot.entity?.pitch ?? 0,
          gameMode: Number.isInteger(visitor.gameMode) ? visitor.gameMode : 2, flying: !!visitor.flying
        }
        const origin = observerOrigin
        if (mode === 'walk') {
          destinationLoad = preload(origin.position)
          await destinationLoad.ready
          // Stay in spectator until the original ground and actual arrival are confirmed.
          await teleportAndConfirm(visitor, playerBot, origin.position)
          await playerBot.look(origin.yaw, origin.pitch, true)
          visitor.flying = origin.flying && [1, 3].includes(origin.gameMode)
          visitor.setGameMode(origin.gameMode)
          if (playerBot.entity) playerBot.entity.flying = visitor.flying
          observerOrigin = undefined
          observerMode = undefined
        } else {
          visitor.flying = true
          observerMode = 'fly'
          visitor.setGameMode(3)
          if (playerBot.entity) playerBot.entity.flying = true
          if (mode === 'overhead') {
            const destination = origin.position.offset(0, 60, 0)
            destinationLoad = preload(destination)
            await destinationLoad.ready
            await teleportAndConfirm(visitor, playerBot, destination)
            await playerBot.look(origin.yaw, -Math.PI / 2, true)
            observerMode = 'overhead'
          }
        }
        return { ok: true, observerMode: observerMode ?? 'walk' }
      } catch { return { ok: false, reason: 'observer-failed', observerMode: observerMode ?? 'walk' } } finally {
        stopMovement()
        destinationLoad?.release()
        travelling = false
      }
    }
  }
}
