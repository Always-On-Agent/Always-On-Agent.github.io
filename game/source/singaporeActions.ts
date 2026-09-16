import { Vec3 } from 'vec3'

type Position = { x: number, y: number, z: number }
type Station = { id: string, position: Position, approach: Position & { yaw?: number } }
type Result = { ok: boolean, receiptId?: string, reason?: string }
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
  } else item.nbt = data
  return item
}

function hasTag (item: any, tag: string) {
  const component = item?.components?.find((entry: any) => entry.type === 'custom_data')
  return (component?.data ?? item?.nbt)?.value?.AlwaysOnTask?.value === tag
}

/** Wait for the actual client move and the server's teleport handshake. */
function teleportAndConfirm (visitor: any, bot: any, destination: Vec3) {
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
    const timeout = setTimeout(() => finish(new Error('Shuttle arrival was not confirmed.')), 8000)
    const poll = setInterval(check, 25)
    bot.on('forcedMove', onForcedMove)
    bot.on('end', onEnd)
    // flying-squid wraps client.on callbacks; its original registrar keeps this
    // short-lived listener removable by the same function reference.
    const listen = visitor._client.oldAddListener ?? visitor._client.on.bind(visitor._client)
    listen('teleport_confirm', onConfirm)
    // teleport() resolves after queuing the position packet, before our async
    // local channel delivers it. Its old yaw would overwrite an earlier look().
    void Promise.resolve().then(() => {
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
  const player = () => server.players?.find((entry: any) => entry.username === playerBot.username)
  const station = (id: string) => stations.find(entry => entry.id === id)
  const near = (id: string) => {
    const target = station(id)
    return !!target && !!player()?.position && player().position.distanceTo(point(target.position).offset(0.5, 0.5, 0.5)) <= 5.5
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
    async shuttle (id: string): Promise<Result> {
      const target = station(id)
      const visitor = player()
      if (!target || !visitor || travelling) return { ok: false, reason: 'not-ready' }
      travelling = true
      try {
        playerBot.clearControlStates()
        // Load the destination before moving; never place a visitor on missing terrain.
        const cx = Math.floor(target.approach.x / 16), cz = Math.floor(target.approach.z / 16)
        await Promise.all(Array.from({ length: 9 }, (_, i) => server.overworld.getColumn(cx + i % 3 - 1, cz + Math.floor(i / 3) - 1)))
        const foot = point(target.approach).floored()
        const floor = await server.overworld.getBlock(foot.offset(0, -1, 0))
        const body = await server.overworld.getBlock(foot)
        const head = await server.overworld.getBlock(foot.offset(0, 1, 0))
        if (floor?.boundingBox !== 'block' || body?.boundingBox === 'block' || head?.boundingBox === 'block') return { ok: false, reason: 'unsafe-stop' }
        await teleportAndConfirm(visitor, playerBot, point(target.approach))
        await playerBot.look(target.approach.yaw ?? 0, 0, true)
        return { ok: true }
      } catch { return { ok: false, reason: 'travel-failed' } } finally { travelling = false }
    }
  }
}
