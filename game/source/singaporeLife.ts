import { BoxGeometry, CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three'
import type { Object3D } from 'three'
import { Vec3 } from 'vec3'
import { advanceCampusTraffic, campusSignal, prepareLifeRoute, sampleLifeRoute, type LifePoint, type LifeRoute, type LifeRouteData, type TrafficState } from './singaporeLifeMath'

type LifeRenderer = { sceneOrigin?: { addAndTrack: (object: Object3D) => void; removeAndUntrack: (object: Object3D) => void } }
type LifeBot = { entity?: { position: LifePoint }; blockAt?: (point: Vec3) => unknown; once?: (event: string, callback: () => void) => unknown; removeListener?: (event: string, callback: () => void) => unknown }
type LifeScene = { architectureOffset?: Partial<LifePoint> }
type LifeData = { coordinateOffset?: Partial<LifePoint>; routes: LifeRouteData[] }
type Walker = { object: Group; legs: Group[]; route?: LifeRoute; distance: number; speed: number }
type Vehicle = { object: Group; route?: LifeRoute; state: TrafficState; bus: boolean }

/**
 * Original ambient characters and simulated traffic. Source roads are geographic;
 * actors, signal timing and bus movements are illustrative, not live campus data.
 * These non-interactive visual meshes never change the player's world or controls.
 */
export function installSingaporeLife (renderer: LifeRenderer, bot: LifeBot, scene: LifeScene = {}) {
  const origin = renderer?.sceneOrigin
  if (!origin || typeof document === 'undefined') return () => {}
  const objects: Group[] = []
  const geometries = new Set<BoxGeometry | PlaneGeometry>()
  const materials = new Map<string, MeshBasicMaterial>()
  const textures: CanvasTexture[] = []
  const cube = new BoxGeometry(1, 1, 1); geometries.add(cube)
  const controller = new AbortController()
  let disposed = false
  let frame = 0
  let last = 0
  let elapsed = 0
  let selectionAt = -Infinity
  let routes: LifeRoute[] = []
  let routeMap = new Map<string, LifeRoute>()
  let offset = { x: 0, y: 0, z: 0 }
  const walkers: Walker[] = []
  const vehicles: Vehicle[] = []
  const signals = new Map<string, { object: Group; lamps: Mesh[]; route: LifeRoute; worldPosition: LifePoint }>()
  const material = (color: string) => {
    if (!materials.has(color)) materials.set(color, new MeshBasicMaterial({ color, toneMapped: false }))
    return materials.get(color)!
  }
  const box = (parent: Group, size: number[], position: number[], color: string) => {
    const mesh = new Mesh(cube, material(color))
    mesh.scale.set(size[0], size[1], size[2]); mesh.position.set(position[0], position[1], position[2]); parent.add(mesh)
    return mesh
  }
  const track = (object: Group, name: string) => { object.name = name; object.visible = false; objects.push(object); origin.addAndTrack(object); return object }
  const makePerson = (index: number): Walker => {
    const person = track(new Group(), `ntu-ambient-${index % 4 === 0 ? 'teacher' : 'student'}-${index}`)
    const teacher = index % 4 === 0
    const skin = ['#bd8768', '#dfb792', '#996448', '#e8c5a5'][index % 4]
    const shirt = teacher ? '#ded9c7' : ['#7a8f66', '#688fa2', '#b97b63', '#a38eb4'][index % 4]
    box(person, [.42, .59, .26], [0, 1.14, 0], shirt)
    box(person, [.33, .36, .32], [0, 1.65, 0], skin)
    box(person, [.35, .13, .34], [0, 1.85, -.01], index % 3 === 0 ? '#69605a' : '#332d2b')
    box(person, [.07, .035, .025], [-.09, 1.69, .165], '#352d28'); box(person, [.07, .035, .025], [.09, 1.69, .165], '#352d28')
    box(person, [.15, .55, .18], [-.29, 1.09, 0], shirt); box(person, [.15, .55, .18], [.29, 1.09, 0], shirt)
    box(person, [.13, .17, .16], [-.29, .77, 0], skin); box(person, [.13, .17, .16], [.29, .77, 0], skin)
    if (teacher) box(person, [.09, .32, .26], [.37, .89, .08], '#e9ece9')
    else { box(person, [.31, .4, .17], [0, 1.12, -.22], ['#3d5869', '#785841', '#526244'][index % 3]); box(person, [.23, .12, .04], [0, .99, -.325], '#a6a290') }
    const legs = [-.11, .11].map(x => { const pivot = new Group(); pivot.position.set(x, .84, 0); person.add(pivot); box(pivot, [.17, .68, .2], [0, -.34, 0], teacher ? '#58575a' : '#405a6a'); box(pivot, [.19, .11, .3], [0, -.72, .055], '#333b3b'); return pivot })
    return { object: person, legs, distance: 0, speed: teacher ? .85 : 1.12 + index % 3 * .09 }
  }
  let busSign: MeshBasicMaterial | undefined
  const getBusSign = () => {
    if (busSign) return busSign
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96
    const context = canvas.getContext('2d')
    if (!context) return material('#304846')
    context.fillStyle = '#213b3b'; context.fillRect(0, 0, 512, 96)
    context.fillStyle = '#f4e6a2'; context.font = 'bold 29px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText('NTU CAMPUS · SIMULATION', 256, 49)
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; textures.push(texture)
    busSign = new MeshBasicMaterial({ map: texture, toneMapped: false }); materials.set('bus-sign', busSign)
    return busSign
  }
  const makeVehicle = (index: number): Vehicle => {
    const bus = index === 0
    const group = track(new Group(), `ntu-simulated-${bus ? 'campus-bus' : 'car'}-${index}`)
    const color = bus ? '#bad9c9' : ['#799caf', '#d9d9d2', '#a05b52', '#566975'][index % 4]
    const width = bus ? 2.35 : 1.75; const length = bus ? 7.1 : 3.75
    box(group, [width, bus ? 1.8 : .65, length], [0, bus ? 1.62 : .83, 0], color)
    box(group, [width * .92, bus ? .85 : .66, length * (bus ? .96 : .56)], [0, bus ? 2.45 : 1.42, bus ? .04 : -.05], '#40545c')
    box(group, [width * .94, .13, length * (bus ? .98 : .61)], [0, bus ? 2.93 : 1.83, 0], bus ? '#dae6df' : color)
    if (bus) {
      for (const z of [-2.5, -1.3, -.1, 1.1, 2.3]) box(group, [2.37, .98, .07], [0, 2.4, z], '#cee1d5')
      const geometry = new PlaneGeometry(2.15, .4); geometries.add(geometry)
      const sign = new Mesh(geometry, getBusSign()); sign.position.set(0, 2.86, length / 2 + .015); group.add(sign)
    }
    for (const x of [-width / 2, width / 2]) for (const z of [-length * .31, length * .31]) { box(group, [.18, .64, .7], [x, .45, z], '#293032'); box(group, [.2, .24, .29], [x, .45, z], '#a9b4b4') }
    for (const x of [-width * .31, width * .31]) { box(group, [.35, .19, .06], [x, .91, length / 2 + .03], '#fcf0c2'); box(group, [.3, .17, .06], [x, .9, -length / 2 - .03], '#b85447') }
    return { object: group, bus, state: { id: index, routeId: '', distance: 0, speed: 0, cruise: bus ? 4.2 : 5.8, length } }
  }
  const makeSignal = (route: LifeRoute, index: number) => {
    const group = track(new Group(), `ntu-simulated-signal-${route.id}-${index}`)
    const point = sampleLifeRoute(route, route.stopPositions[index] + 7)
    const worldPosition = { x: point.x + point.dz * 1.8 + offset.x, y: point.y + offset.y, z: point.z - point.dx * 1.8 + offset.z }
    group.position.set(worldPosition.x, worldPosition.y, worldPosition.z)
    group.rotation.y = point.yaw + Math.PI
    box(group, [.11, 2.95, .11], [0, 1.48, 0], '#65736b'); box(group, [.38, .95, .23], [0, 2.91, 0], '#293632')
    const lamps = [3.2, 2.91, 2.62].map(y => box(group, [.2, .2, .035], [0, y, .14], '#3e4b42'))
    signals.set(`${route.id}:${index}`, { object: group, lamps, route, worldPosition })
  }
  const nearestProgress = (route: LifeRoute, player: LifePoint) => {
    let distance = Infinity; let progress = 0
    route.points.forEach((point, index) => { const gap = Math.hypot(point[0] + offset.x - player.x, point[2] + offset.z - player.z); if (gap < distance) { distance = gap; progress = route.lengths[index] } })
    return { route, distance, progress }
  }
  const setPosition = (object: Group, point: ReturnType<typeof sampleLifeRoute>, player: LifePoint) => {
    // SceneOrigin accepts world coordinates on writes, but position reads are camera-relative.
    const worldPosition = new Vec3(point.x + offset.x, point.y + offset.y + .035, point.z + offset.z)
    object.position.set(worldPosition.x, worldPosition.y, worldPosition.z)
    object.rotation.y = point.yaw
    object.visible = Math.hypot(worldPosition.x - player.x, worldPosition.z - player.z) <= 150
      && (!bot.blockAt || bot.blockAt(worldPosition) !== null)
  }
  const animate = (time: number) => {
    frame = requestAnimationFrame(animate)
    if (disposed || document.hidden || !bot.entity || !routes.length) { last = time; return }
    const dt = last ? Math.min(.1, (time - last) / 1000) : 0; last = time; elapsed += dt
    const player = bot.entity.position
    if (time - selectionAt > 800) {
      selectionAt = time
      const nearby = routes.map(route => nearestProgress(route, player)).filter(value => value.distance <= 135).sort((a, b) => a.distance - b.distance)
      const roads = nearby.filter(value => value.route.kind === 'road').slice(0, 3)
      const paths = nearby.filter(value => value.route.kind === 'walk').slice(0, 5)
      vehicles.forEach((vehicle, index) => {
        if (vehicle.route && roads.some(value => value.route.id === vehicle.route!.id)) return
        const choices = vehicle.bus && roads.some(value => value.route.closed) ? roads.filter(value => value.route.closed) : roads
        const chosen = choices[index % choices.length]
        vehicle.route = chosen?.route
        if (chosen) vehicle.state = { ...vehicle.state, routeId: chosen.route.id, distance: (chosen.progress + index * 26) % chosen.route.loopLength, speed: 0 }
        else vehicle.object.visible = false
      })
      walkers.forEach((walker, index) => {
        if (walker.route && paths.some(value => value.route.id === walker.route!.id)) return
        const chosen = paths[index % paths.length]
        walker.route = chosen?.route
        if (chosen) walker.distance = (chosen.progress + index * 8) % chosen.route.loopLength
        else walker.object.visible = false
      })
      for (const { object } of signals.values()) object.visible = false
      for (const { route } of roads) {
        route.stopPositions.forEach((_, index) => { if (!signals.has(`${route.id}:${index}`)) makeSignal(route, index) })
        for (let index = 0; index < route.stopPositions.length; index++) { const signal = signals.get(`${route.id}:${index}`)!; signal.object.visible = Math.hypot(signal.worldPosition.x - player.x, signal.worldPosition.z - player.z) <= 150 }
      }
    }
    const advanced = advanceCampusTraffic(vehicles.filter(vehicle => vehicle.route).map(vehicle => vehicle.state), routeMap, elapsed, dt)
    vehicles.forEach(vehicle => { if (!vehicle.route) return; vehicle.state = advanced.find(state => state.id === vehicle.state.id)!; setPosition(vehicle.object, sampleLifeRoute(vehicle.route, vehicle.state.distance), player) })
    walkers.forEach((walker, index) => {
      if (!walker.route) return
      walker.distance = (walker.distance + walker.speed * dt) % walker.route.loopLength
      setPosition(walker.object, sampleLifeRoute(walker.route, walker.distance), player)
      const stride = Math.sin(elapsed * walker.speed * 7 + index) * .33
      walker.legs[0].rotation.x = stride; walker.legs[1].rotation.x = -stride
    })
    for (const signal of signals.values()) {
      if (signal.object.visible && bot.blockAt && bot.blockAt(new Vec3(signal.worldPosition.x, signal.worldPosition.y, signal.worldPosition.z)) === null) signal.object.visible = false
      const color = campusSignal(elapsed, signal.route.signal?.phase ?? 0)
      signal.lamps[0].material = material(color === 'red' ? '#ed6452' : '#493b35')
      signal.lamps[1].material = material(color === 'amber' ? '#f3ce66' : '#494632')
      signal.lamps[2].material = material(color === 'green' ? '#7fc8a0' : '#34463d')
    }
  }
  const cleanup = () => {
    if (disposed) return
    disposed = true; controller.abort(); cancelAnimationFrame(frame)
    bot.removeListener?.('end', cleanup)
    for (const object of objects) { try { origin.removeAndUntrack(object) } catch { object.removeFromParent() } }
    for (const geometry of geometries) geometry.dispose()
    for (const value of materials.values()) value.dispose()
    for (const texture of textures) texture.dispose()
    objects.length = 0; routes = []; walkers.length = 0; vehicles.length = 0; signals.clear()
  }
  void fetch('./maps/ntu-campus-v2/routes.json', { signal: controller.signal }).then(async response => {
    if (!response.ok) throw new Error('Ambient campus routes unavailable')
    return response.json() as Promise<LifeData>
  }).then(data => {
    if (disposed) return
    for (const key of ['x', 'y', 'z'] as const) offset[key] = (scene.architectureOffset?.[key] ?? 0) - (data.coordinateOffset?.[key] ?? 0)
    routes = data.routes.filter(route => route.points.length >= 3 && route.points.every(point => point.length === 3 && point.every(Number.isFinite))).map(prepareLifeRoute).filter(route => route.length > 10)
    routeMap = new Map(routes.map(route => [route.id, route]))
    for (let index = 0; index < 10; index++) walkers.push(makePerson(index))
    for (let index = 0; index < 5; index++) vehicles.push(makeVehicle(index))
    frame = requestAnimationFrame(animate)
  }).catch(error => { if (!disposed && error.name !== 'AbortError') console.warn('NTU ambient life could not load', error.message) })
  bot.once?.('end', cleanup)
  return cleanup
}
