import { LIVE_ROUTE as DEFAULT_LIVE_ROUTE } from './ntuLiveRoute'

/**
 * Small fictional actors. Route and camera positions use absolute source
 * coordinates local to this group; renderers may translate its scene origin.
 * The origin transform must remain translation-only.
 */
export function createCampusActors(
  THREE,
  { scene, getGroundHeight, route: LIVE_ROUTE = DEFAULT_LIVE_ROUTE }
) {
  const group = new THREE.Group()
  group.name = 'S-Lab outdoor demo actors'
  group.visible = false
  scene.add(group)
  const geometries = new Set()
  const materials = new Set()
  const textures = new Set()
  const geometry = value => {
    geometries.add(value)
    return value
  }
  const material = (color, extra = {}) => {
    const value = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.86,
      ...extra
    })
    materials.add(value)
    return value
  }
  const capsule = (radius, length, caps = 2, sides = 6) => geometry(new THREE.CapsuleGeometry(radius, length, caps, sides))
  const shared = {
    torso: capsule(0.17, 0.31),
    upperLeg: capsule(0.072, 0.25),
    lowerLeg: capsule(0.062, 0.25),
    upperArm: capsule(0.057, 0.22),
    lowerArm: capsule(0.046, 0.21),
    neck: capsule(0.045, 0.045, 1),
    head: geometry(new THREE.SphereGeometry(0.125, 8, 6)),
    eye: geometry(new THREE.SphereGeometry(0.009, 6, 3)),
    nose: geometry(new THREE.SphereGeometry(0.017, 6, 3)),
    hair: geometry(
      new THREE.SphereGeometry(0.129, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.57)
    ),
    hand: geometry(new THREE.SphereGeometry(0.045, 6, 3)),
    shoe: geometry(new THREE.SphereGeometry(0.075, 6, 3)),
    shadow: geometry(new THREE.CircleGeometry(0.29, 16))
  }
  const dark = material('#24313a')
  const hair = material('#302b29')
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: '#24312c',
    transparent: true,
    opacity: 0.16,
    depthWrite: false
  })
  materials.add(shadowMaterial)
  let elapsed = 0
  let disposed = false
  let parcelState = 'desk'
  let transfer = null
  const camera = new THREE.Vector3()
  const offset = new THREE.Vector3()
  const carryQuaternion = new THREE.Quaternion()
  const targetPosition = new THREE.Vector3()
  const targetQuaternion = new THREE.Quaternion()
  const handRotation = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    Math.PI / 2
  )
  const floorAt = p => {
    const height = getGroundHeight?.(p)
    return Number.isFinite(height) ? height : p.y
  }
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => {
    const value = new THREE.Mesh(geo, mat)
    value.position.set(x, y, z)
    value.castShadow = true
    value.receiveShadow = true
    parent.add(value)
    return value
  }
  const pivot = (parent, x, y, z = 0) => {
    const value = new THREE.Group()
    value.position.set(x, y, z)
    parent.add(value)
    return value
  }
  function person(id, anchor, shirtColor, skinColor, phase) {
    const root = new THREE.Group()
    root.name = id
    root.userData.actorId = id
    root.position.set(anchor.x, floorAt(anchor), anchor.z)
    group.add(root)
    const clothes = material(shirtColor)
    const skin = material(skinColor)
    const body = pivot(root, 0, 0)
    mesh(shared.torso, clothes, body, 0, 1.17).scale.z = 0.82
    mesh(shared.neck, skin, body, 0, 1.47)
    const head = pivot(body, 0, 1.605)
    mesh(shared.head, skin, head).scale.set(0.94, 1.04, 0.94)
    mesh(shared.hair, hair, head, 0, 0.016, -0.007)
    mesh(shared.eye, dark, head, -0.035, 0.015, 0.113)
    mesh(shared.eye, dark, head, 0.035, 0.015, 0.113)
    mesh(shared.nose, skin, head, 0, -0.015, 0.124).scale.set(0.72, 1, 0.8)
    const legs = []
    const arms = []
    const hands = []
    for (const sign of [-1, 1]) {
      const leg = pivot(body, sign * 0.095, 0.84)
      mesh(shared.upperLeg, dark, leg, 0, -0.19)
      const knee = pivot(leg, 0, -0.38)
      mesh(shared.lowerLeg, dark, knee, 0, -0.19)
      mesh(shared.shoe, dark, knee, 0, -0.39, 0.035).scale.set(0.78, 0.57, 1.4)
      legs.push({ leg, knee })
      const shoulder = pivot(body, sign * 0.218, 1.385)
      mesh(shared.upperArm, clothes, shoulder, 0, -0.17)
      const elbow = pivot(shoulder, 0, -0.33)
      mesh(shared.lowerArm, skin, elbow, 0, -0.155)
      const hand = pivot(elbow, 0, -0.322)
      mesh(shared.hand, skin, hand)
      arms.push({ shoulder, elbow, sign })
      hands.push(hand)
    }
    const shadow = mesh(shared.shadow, shadowMaterial, root, 0, 0.013)
    shadow.rotation.x = -Math.PI / 2
    shadow.castShadow = false
    return {
      id,
      root,
      body,
      head,
      legs,
      arms,
      hands,
      phase,
      anchor: root.position.clone(),
      kind: 'idle',
      gestureTime: 0,
      duration: 0,
      approach: null
    }
  }
  const colleagueState = person(
    'colleague',
    LIVE_ROUTE.colleague,
    '#3d697e',
    '#ba8263',
    0.4
  )
  const stewardState = person(
    'steward',
    LIVE_ROUTE.steward,
    '#ae6951',
    '#d8a47c',
    2.1
  )
  colleagueState.root.rotation.y = 0
  stewardState.root.rotation.y = Math.atan2(
    LIVE_ROUTE.pickup.x - LIVE_ROUTE.steward.x,
    LIVE_ROUTE.pickup.z - LIVE_ROUTE.steward.z
  )
  const actors = { colleague: colleagueState, steward: stewardState }

  function label(text, width, height, background = '#f2eee2', ink = '#24313a') {
    if (typeof document === 'undefined') return null
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 160
    const context = canvas.getContext('2d')
    if (!context) return null
    context.fillStyle = background
    context.fillRect(0, 0, 512, 160)
    context.fillStyle = ink
    context.font = '600 65px system-ui, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(text, 256, 84, 480)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    textures.add(texture)
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide
    })
    materials.add(mat)
    return new THREE.Mesh(geometry(new THREE.PlaneGeometry(width, height)), mat)
  }
  const desk = new THREE.Group()
  desk.name = 'Fictional S-Lab demo desk'
  desk.position.set(
    LIVE_ROUTE.pickup.x,
    floorAt(LIVE_ROUTE.pickup),
    LIVE_ROUTE.pickup.z
  )
  desk.rotation.y = -Math.PI / 2
  group.add(desk)
  const tabletop = material('#bfad88')
  const metal = material('#65736b')
  mesh(
    geometry(new THREE.BoxGeometry(0.95, 0.045, 0.52)),
    tabletop,
    desk,
    0,
    0.79
  )
  const deskLeg = geometry(new THREE.CylinderGeometry(0.018, 0.024, 0.76, 6))
  for (const x of [-0.4, 0.4]) { for (const z of [-0.19, 0.19]) mesh(deskLeg, metal, desk, x, 0.38, z) }
  const sign = label('S-LAB / DEMO', 0.65, 0.2)
  if (sign) {
    sign.position.set(0, 1.025, -0.2)
    desk.add(sign)
  }
  mesh(
    geometry(new THREE.CylinderGeometry(0.009, 0.009, 0.31, 6)),
    metal,
    desk,
    0,
    0.94,
    -0.21
  )

  const parcel = new THREE.Group()
  parcel.name = 'A17 demo parcel'
  const cardboard = material('#c99864')
  mesh(
    geometry(new THREE.BoxGeometry(0.27, 0.15, 0.2)),
    cardboard,
    parcel,
    0,
    0.075
  )
  mesh(
    geometry(new THREE.BoxGeometry(0.038, 0.002, 0.202)),
    material('#e1d3b5'),
    parcel,
    0,
    0.151
  )
  const parcelLabel = label('A17', 0.13, 0.057)
  if (parcelLabel) {
    parcelLabel.position.set(0.047, 0.084, 0.101)
    parcel.add(parcelLabel)
  }
  const topLabel = label('A17', 0.14, 0.055)
  if (topLabel) {
    topLabel.position.set(0.05, 0.153, 0.018)
    topLabel.rotation.x = -Math.PI / 2
    parcel.add(topLabel)
  }

  function attachParcel(state) {
    parcel.rotation.set(0, 0, 0)
    parcel.position.set(0, 0, 0)
    if (state === 'desk') {
      desk.add(parcel)
      parcel.position.set(0.12, 0.814, 0.03)
    } else if (state === 'delivered') {
      colleagueState.hands[0].add(parcel)
      parcel.position.set(0, -0.025, 0.07)
      parcel.rotation.x = Math.PI / 2
    } else { group.add(parcel) }
  }
  function setParcel(state) {
    if (disposed || !['desk', 'carried', 'delivered'].includes(state)) return
    if (state === parcelState && state !== 'desk') return
    parcel.visible = true
    if (state === 'desk' || !group.visible || !parcel.parent) {
      transfer = null
      parcelState = state
      attachParcel(state)
      return
    }
    parcel.updateWorldMatrix(true, false)
    transfer = {
      from: group.worldToLocal(parcel.getWorldPosition(new THREE.Vector3())),
      rotation: parcel.getWorldQuaternion(new THREE.Quaternion()),
      elapsed: 0
    }
    // Preserve the render transform, then interpolate both endpoints in source coordinates.
    group.attach(parcel)
    parcelState = state
  }
  setParcel('desk')

  function gesture(actorId, kind) {
    if (disposed) return
    const actor =
      actors[typeof actorId === 'string' ? actorId : actorId?.userData?.actorId]
    if (
      !actor ||
      !['idle', 'wave', 'talk', 'handoff', 'approach'].includes(kind)
    ) { return }
    actor.kind = kind
    actor.gestureTime = 0
    actor.duration = {
      idle: 0,
      wave: 2.2,
      talk: 4.5,
      handoff: 1.8,
      approach: 1.9
    }[kind]
    actor.approach = null
    if (kind === 'approach') {
      // These one-metre lateral pads were checked against the conservative Anvil
      // occupancy. Recheck continuous floor slope; never wander toward the camera.
      const from = actor.root.position.clone()
      const to = actor.anchor.clone()
      to.x -= 1
      let safe = from.distanceTo(to) > 0.1
      let previous = from.y
      for (let n = 1; n <= 10; n++) {
        const p = from.clone().lerp(to, n / 10)
        const y = floorAt(p)
        if (
          !Number.isFinite(y) ||
          Math.abs(y - previous) > 0.24 ||
          Math.abs(y - from.y) > 0.55
        ) { safe = false }
        previous = y
      }
      if (safe) {
        to.y = previous
        actor.approach = { from, to }
      } else {
        actor.kind = 'wave'
        actor.duration = 2.2
      }
    }
  }
  function update(dt, cameraPosition, cameraQuaternion) {
    if (disposed || !group.visible) return
    dt = Math.max(0, Math.min(0.1, Number.isFinite(dt) ? dt : 0))
    elapsed += dt
    if (cameraPosition) camera.copy(cameraPosition)
    for (const actor of Object.values(actors)) {
      actor.gestureTime += dt
      const t = actor.gestureTime
      const motion = Math.sin(elapsed * 1.8 + actor.phase)
      let walking = false
      if (actor.kind === 'approach' && actor.approach) {
        const { from, to } = actor.approach
        const f = Math.min(1, t / actor.duration)
        const p = from.clone().lerp(to, f * f * (3 - 2 * f))
        if (
          !cameraPosition ||
          Math.hypot(p.x - camera.x, p.z - camera.z) > 0.85
        ) {
          actor.root.position.copy(p)
          actor.root.position.y = floorAt(p)
          walking = f < 1
        }
      }
      const dx = camera.x - actor.root.position.x
      const dz = camera.z - actor.root.position.z
      if (cameraPosition && Math.hypot(dx, dz) < 12) {
        const desired = walking ? -Math.PI / 2 : Math.atan2(dx, dz)
        const delta = Math.atan2(
          Math.sin(desired - actor.root.rotation.y),
          Math.cos(desired - actor.root.rotation.y)
        )
        actor.root.rotation.y += delta * Math.min(1, dt * 5)
      }
      actor.body.position.y = walking
        ? Math.abs(Math.sin(t * 7)) * 0.014
        : motion * 0.004
      actor.head.rotation.set(
        actor.kind === 'talk' ? Math.sin(t * 4.5) * 0.045 : motion * 0.012,
        0,
        0
      )
      for (const [i, { leg, knee }] of actor.legs.entries()) {
        leg.rotation.x = walking ? Math.sin(t * 7 + i * Math.PI) * 0.27 : 0
        knee.rotation.x = walking ? Math.max(0, -leg.rotation.x) * 0.55 : 0.015
      }
      for (const [i, { shoulder, elbow, sign }] of actor.arms.entries()) {
        shoulder.rotation.set(
          walking ? -Math.sin(t * 7 + i * Math.PI) * 0.19 : motion * 0.025,
          0,
          sign * 0.075
        )
        elbow.rotation.set(-0.08, 0, 0)
      }
      const right = actor.arms[1]
      const left = actor.arms[0]
      if (actor.kind === 'wave') {
        right.shoulder.rotation.z = 2.12
        right.shoulder.rotation.x = -0.2
        right.elbow.rotation.z = 0.28 + Math.sin(t * 10) * 0.22
      }
      if (actor.kind === 'talk') {
        right.shoulder.rotation.x = -0.42 + Math.sin(t * 3) * 0.08
        right.elbow.rotation.x = -0.45 + Math.sin(t * 4) * 0.12
      }
      if (actor.kind === 'handoff') {
        const reach = Math.sin(Math.min(1, t / actor.duration) * Math.PI)
        right.shoulder.rotation.x = -0.95 * reach
        right.elbow.rotation.x = -0.45 * reach
      }
      if (parcelState === 'delivered' && actor === colleagueState) {
        left.shoulder.rotation.x = -0.55
        left.elbow.rotation.x = -0.7
      }
      if (actor.duration && t >= actor.duration) {
        actor.kind = 'idle'
        actor.duration = 0
        actor.approach = null
      }
    }
    if (cameraQuaternion) carryQuaternion.copy(cameraQuaternion)
    group.updateMatrixWorld(true)
    if (parcelState === 'carried' && cameraPosition) {
      offset.set(0.24, -0.4, -0.63).applyQuaternion(carryQuaternion)
      targetPosition.copy(camera).add(offset)
      targetPosition.y += Math.sin(elapsed * 4) * 0.008
      targetQuaternion.copy(carryQuaternion)
    } else if (parcelState === 'delivered' && transfer) {
      targetPosition.set(0, -0.025, 0.07)
      colleagueState.hands[0].localToWorld(targetPosition)
      group.worldToLocal(targetPosition)
      colleagueState.hands[0]
        .getWorldQuaternion(targetQuaternion)
        .multiply(handRotation)
    }
    if (transfer) {
      transfer.elapsed += dt
      const t = Math.min(1, transfer.elapsed / 0.8)
      const eased = t * t * (3 - 2 * t)
      offset.copy(transfer.from).lerp(targetPosition, eased)
      offset.y += Math.sin(t * Math.PI) * 0.08
      parcel.position.copy(offset)
      parcel.quaternion.copy(transfer.rotation).slerp(targetQuaternion, eased)
      if (t === 1) {
        transfer = null
        if (parcelState === 'delivered') attachParcel('delivered')
      }
    } else if (parcelState === 'carried' && cameraPosition) {
      parcel.position.copy(targetPosition)
      parcel.quaternion.copy(targetQuaternion)
    }
  }
  return {
    colleague: colleagueState.root,
    steward: stewardState.root,
    parcel,
    show() {
      if (disposed) return
      for (const actor of Object.values(actors)) {
        actor.root.position.copy(actor.anchor)
        actor.root.position.y = floorAt(actor.anchor)
        actor.kind = 'idle'
        actor.gestureTime = 0
        actor.duration = 0
        actor.approach = null
      }
      transfer = null
      parcelState = 'desk'
      attachParcel('desk')
      group.visible = true
    },
    hide() {
      group.visible = false
    },
    update,
    gesture,
    setParcel,
    isTransferring() {
      return transfer !== null
    },
    dispose() {
      if (disposed) return
      disposed = true
      group.removeFromParent()
      for (const value of geometries) value.dispose()
      for (const value of materials) value.dispose()
      for (const value of textures) value.dispose()
    }
  }
}
