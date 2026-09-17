export type LifePoint = { x: number; y: number; z: number }
export type LifeRouteData = { id: string; sourceWay: number; name: string; closed?: boolean; kind: 'road' | 'walk'; points: number[][]; signal?: { x: number; z: number; phase: number; simulated: boolean } }
export type LifeRoute = LifeRouteData & { lengths: number[]; length: number; lane: number; loopLength: number; stopPositions: number[] }
export type TrafficState = { id: number; routeId: string; distance: number; speed: number; cruise: number; length: number }
export type SignalColor = 'green' | 'amber' | 'red'
const modulo = (value: number, size: number) => (value % size + size) % size

export function prepareLifeRoute (data: LifeRouteData): LifeRoute {
  const lengths = [0]
  for (let index = 1; index < data.points.length; index++) {
    const a = data.points[index - 1]; const b = data.points[index]
    lengths.push(lengths.at(-1)! + Math.hypot(b[0] - a[0], b[2] - a[2]))
  }
  const length = lengths.at(-1)!
  const lane = data.kind === 'road' ? 1.45 : .23
  const loopLength = data.closed ? length : length * 2 + Math.PI * lane * 2
  let signalDistance = length / 2
  if (data.signal) {
    let closest = Infinity
    data.points.forEach((point, index) => {
      const distance = Math.hypot(point[0] - data.signal!.x, point[2] - data.signal!.z)
      if (distance < closest) { closest = distance; signalDistance = lengths[index] }
    })
  }
  signalDistance = Math.max(15, Math.min(length - 15, signalDistance))
  return { ...data, lengths, length, lane, loopLength, stopPositions: data.kind === 'road' ? data.closed ? [Math.max(0, signalDistance - 7)] : [Math.max(0, signalDistance - 7), length * 2 + Math.PI * lane - signalDistance - 7] : [] }
}

function onCenter (route: LifeRoute, distance: number) {
  let index = route.lengths.findIndex((value, index) => index > 0 && value >= distance)
  if (index < 1) index = route.points.length - 1
  const a = route.points[index - 1]; const b = route.points[index]
  const length = route.lengths[index] - route.lengths[index - 1]
  const fraction = length ? Math.max(0, Math.min(1, (distance - route.lengths[index - 1]) / length)) : 0
  const tangent = (pointIndex: number) => {
    const previous = route.points[pointIndex > 0 ? pointIndex - 1 : route.closed ? route.points.length - 2 : 0]
    const next = route.points[pointIndex < route.points.length - 1 ? pointIndex + 1 : route.closed ? 1 : route.points.length - 1]
    const magnitude = Math.hypot(next[0] - previous[0], next[2] - previous[2]) || 1
    return { dx: (next[0] - previous[0]) / magnitude, dz: (next[2] - previous[2]) / magnitude }
  }
  const from = tangent(index - 1); const to = tangent(index)
  const tx = from.dx + (to.dx - from.dx) * fraction; const tz = from.dz + (to.dz - from.dz) * fraction
  const magnitude = Math.hypot(tx, tz) || 1
  const dx = tx / magnitude; const dz = tz / magnitude
  return { x: a[0] + (b[0] - a[0]) * fraction, y: a[1] + (b[1] - a[1]) * fraction, z: a[2] + (b[2] - a[2]) * fraction, dx, dz }
}

/** Follow the source path out and back, joining left lanes with smooth end turns. */
export function sampleLifeRoute (route: LifeRoute, distance: number) {
  let progress = modulo(distance, route.loopLength)
  const turn = Math.PI * route.lane
  if (progress <= route.length) {
    const point = onCenter(route, progress)
    return { ...point, x: point.x + point.dz * route.lane, z: point.z - point.dx * route.lane, yaw: Math.atan2(point.dx, point.dz) }
  }
  progress -= route.length
  if (progress >= turn && progress <= turn + route.length) {
    const point = onCenter(route, route.length - (progress - turn))
    return { ...point, x: point.x - point.dz * route.lane, z: point.z + point.dx * route.lane, dx: -point.dx, dz: -point.dz, yaw: Math.atan2(-point.dx, -point.dz) }
  }
  const atEnd = progress < turn
  const point = onCenter(route, atEnd ? route.length : 0)
  const direction = atEnd ? 1 : -1
  const dx = point.dx * direction; const dz = point.dz * direction
  const angle = (atEnd ? progress : progress - turn - route.length) / route.lane
  const x = point.x + (dz * Math.cos(angle) + dx * Math.sin(angle)) * route.lane
  const z = point.z + (-dx * Math.cos(angle) + dz * Math.sin(angle)) * route.lane
  const tangentX = -dz * Math.sin(angle) + dx * Math.cos(angle)
  const tangentZ = dx * Math.sin(angle) + dz * Math.cos(angle)
  return { x, y: point.y, z, dx: tangentX, dz: tangentZ, yaw: Math.atan2(tangentX, tangentZ) }
}

/** Demonstration signals: 11 s green, 2 s amber, 1 s clearance for each axis. */
export function campusSignal (seconds: number, axis = 0): SignalColor {
  const time = modulo(seconds - axis * 14, 28)
  return time < 11 ? 'green' : time < 13 ? 'amber' : 'red'
}

export function forwardDistance (from: number, to: number, length: number) { return modulo(to - from, length) }

/** Stop lines and a leader's rear bumper are hard limits, including long frames. */
export function advanceCampusTraffic (states: readonly TrafficState[], routes: ReadonlyMap<string, LifeRoute>, seconds: number, elapsed: number): TrafficState[] {
  const dt = Math.max(0, Math.min(.15, elapsed))
  return states.map(state => {
    const route = routes.get(state.routeId)
    if (!route) return state
    let available = Infinity
    const signal = campusSignal(seconds, route.signal?.phase ?? 0)
    if (route.signal && signal !== 'green') {
      for (const stop of route.stopPositions) {
        const gap = forwardDistance(state.distance, stop, route.loopLength) - state.length / 2
        // Vehicles whose front bumper already crossed finish the crossing.
        if (gap >= -.05) available = Math.min(available, Math.max(0, gap))
      }
    }
    for (const leader of states) {
      if (leader.id === state.id) continue
      if (leader.routeId !== state.routeId) {
        const other = routes.get(leader.routeId)
        if (!other) continue
        const me = sampleLifeRoute(route, state.distance); const ahead = sampleLifeRoute(other, leader.distance)
        const dx = ahead.x - me.x; const dz = ahead.z - me.z
        const forward = dx * me.dx + dz * me.dz
        const lateral = Math.abs(dx * me.dz - dz * me.dx)
        if (forward > 0 && lateral < 1.7 && me.dx * ahead.dx + me.dz * ahead.dz > .6) available = Math.min(available, Math.max(0, forward - (state.length + leader.length) / 2 - 2.5))
        continue
      }
      const gap = forwardDistance(state.distance, leader.distance, route.loopLength) - (state.length + leader.length) / 2 - 2.5
      if (gap >= -state.length) available = Math.min(available, Math.max(0, gap))
    }
    const wanted = Math.min(state.cruise, Math.sqrt(Math.max(0, available) * 5))
    const speed = Math.max(0, Math.min(wanted, state.speed + 2 * dt))
    const movement = Math.min(speed * dt, available)
    return { ...state, speed: movement < speed * dt ? 0 : speed, distance: modulo(state.distance + movement, route.loopLength) }
  })
}
