const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { EventEmitter } = require('node:events')
const esbuild = require('esbuild')
const { Vec3 } = require('vec3')

// Exercise the actual HUD controller and inventory adapter together. Only the
// surrounding browser UI and server transport are replaced; no story transitions
// are reimplemented here. Internal handlers are exported in this test bundle only.
const root = path.resolve(__dirname, '..')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'ntu-hud-'))
const bundle = path.join(temporary, 'hud.cjs')
const values = new Map()
global.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
global.location = { search: '?lang=en', href: 'http://localhost/?lang=en' }
global.document = Object.assign(new EventTarget(), { hidden: false, exitPointerLock () {} })
global.window = new EventTarget()
global.__sgUi = { activeModalStack: [], miscUiState: { currentTouch: false } }

async function main () {
  await esbuild.build({
    stdin: {
      contents: fs.readFileSync(path.join(root, 'src/singaporeHud.tsx'), 'utf8') + '\nexport { acceptPlans, returnBook, checkIn, readNotice, readPickup, acceptPickup, collectKit, takeShuttle, restoreLoan, nextDescription };\nexport { createSingaporeActions } from "./singaporeActions";',
      resolveDir: path.join(root, 'src'), loader: 'tsx', sourcefile: 'singaporeHud.tsx'
    },
    outfile: bundle, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic',
    plugins: [{
      name: 'browser-ui-boundary',
      setup (build) {
        build.onResolve({ filter: /^\.\/(globalState|utils|react\/utilsApp)$/ }, args => ({ path: args.path, namespace: 'ui-stub' }))
        build.onLoad({ filter: /.*/, namespace: 'ui-stub' }, args => ({ contents: args.path === './globalState'
          ? 'export const { activeModalStack, miscUiState } = globalThis.__sgUi; export const isGameActive = () => !activeModalStack.length; export const showModal = value => activeModalStack.push(value); export const hideModal = value => { const index = activeModalStack.indexOf(value); if (index >= 0) activeModalStack.splice(index, 1); };'
          : args.path === './utils' ? 'export const pointerLock = { requestPointerLock: async () => {} };' : 'export const useIsModalActive = () => false;' }))
        build.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'empty' }))
        // React rendering and Valtio subscriptions are outside this controller
        // test; the production state and transition code are bundled unchanged.
        build.onResolve({ filter: /^valtio$/ }, () => ({ path: 'valtio', namespace: 'state-stub' }))
        build.onLoad({ filter: /.*/, namespace: 'state-stub' }, () => ({ contents: 'export const proxy = value => value; export const subscribe = () => () => {}; export const useSnapshot = value => value;' }))
      }
    }]
  })
  const hud = require(bundle)
  const stations = JSON.parse(fs.readFileSync(path.join(root, 'assets/maps/ntu/scene.json'), 'utf8')).stations
  const Item = require('prismarine-item')('1.21.4')
  const memoryKey = 'always-on-ntu-campus-memory-v1'
  let blocksSight = false
  let cleanup
  let active
  const makeVisit = overrides => {
    cleanup?.()
    const player = Object.assign(new EventEmitter(), {
      username: 'Visitor', world: {}, entity: { position: new Vec3(0, 0, 0), yaw: 0, pitch: 0 },
      controlState: { sneak: false }, mouse: { buttons: [] },
      clearControlStates () {}, setControlState () {},
      blockAt: () => blocksSight ? { name: 'stone', boundingBox: 'block' } : { name: 'air', boundingBox: 'empty' },
      async look (yaw, pitch) { this.entity.yaw = yaw; this.entity.pitch = pitch }
    })
    const slots = Array(46).fill(null)
    const visitor = {
      username: player.username,
      _client: new EventEmitter(), lastTeleportId: 0, pendingTeleport: false, validateNextPosition: false,
      get position () { return player.entity.position },
      inventory: { slots, updateSlot: (slot, item) => { slots[slot] = item }, firstEmptyInventorySlot: () => slots.findIndex(item => !item) },
      teleport (point) {
        const teleportId = ++this.lastTeleportId
        this.pendingTeleport = true
        this.validateNextPosition = true
        // Simulate delivery and acknowledgment on separate turns. The real
        // transport codec and server handshake have their own regression test.
        setImmediate(() => {
          player.entity.position = point
          player.emit('forcedMove')
          setImmediate(() => {
            this.pendingTeleport = false
            this.validateNextPosition = false
            this._client.emit('teleport_confirm', { teleportId })
          })
        })
      }
    }
    const server = { players: [visitor], PrismarineItem: Item, mcData: require('minecraft-data')('1.21.4'), overworld: {
      getColumn: async () => ({}),
      getBlock: async point => ({ boundingBox: stations.some(station => point.equals(new Vec3(station.approach.x, station.approach.y - 1, station.approach.z).floored())) ? 'block' : 'empty' })
    } }
    const adapter = hud.createSingaporeActions(server, player, stations)
    let grants = 0
    const actions = { ...adapter, acceptLoan: async () => { grants++; return adapter.acceptLoan() }, ...overrides }
    active = { player, slots, grants: () => grants }
    cleanup = hud.setupSingaporeDemo(player, { stations, ...actions })
    return active
  }
  const settle = async () => {
    for (let i = 0; i < 30 && hud.singaporeHudState.busy; i++) await new Promise(resolve => setImmediate(resolve))
    assert.equal(hud.singaporeHudState.busy, false, 'HUD transaction must settle')
  }
  const go = id => {
    const station = stations.find(value => value.id === id)
    active.player.entity.position = new Vec3(station.approach.x, station.approach.y, station.approach.z)
    active.player.entity.yaw = station.approach.yaw
    active.player.entity.pitch = 0
    return station
  }
  const state = hud.singaporeHudState
  try {
    makeVisit()
    for (const station of stations) {
      go(station.id)
      assert.equal(hud.isSingaporeTargetVisible(active.player, station.position), true, `${station.id} is visible from the published shuttle approach`)
      active.player.entity.yaw += Math.PI
      assert.equal(hud.isSingaporeTargetVisible(active.player, station.position), false, 'facing away is not an observation')
    }
    go('plaza')
    blocksSight = true
    hud.acceptPlans()
    assert.equal(state.accepted, false, 'plans cannot be accepted through a wall')
    blocksSight = false
    hud.acceptPlans()
    await settle()
    assert.equal(state.accepted, true)
    assert.equal(active.slots.filter(Boolean).length, 1, 'accepting actually grants the tagged book')
    hud.takeShuttle('library')
    await settle()
    assert.equal(state.error, '', 'the controller accepts a confirmed shuttle arrival')
    assert.equal(state.travelDone, true)
    assert.equal(state.noticeObserved, false, 'shuttle travel never reads evidence automatically')
    hud.readNotice()
    hud.readNotice(true)
    go('meetup')
    hud.checkIn()
    assert.ok(state.meetupReceipt)
    hud.readPickup()
    hud.acceptPickup()
    assert.equal(state.pickupAccepted, true)
    const originalArrival = state.meetupReceipt

    makeVisit()
    await settle()
    assert.equal(state.visit, 2)
    assert.equal(state.meetupReceipt, originalArrival, 'the completed commitment survives a new visit')
    assert.equal(state.noticeObserved, false)
    assert.equal(state.pickupObserved, false)
    assert.equal(active.slots.filter(Boolean).length, 1, 'only the unfinished loan is reinstated')
    await hud.restoreLoan()
    assert.equal(active.slots.filter(Boolean).length, 1, 'retrying restoration does not duplicate the loan')
    go('plaza')
    hud.collectKit()
    await settle()
    assert.equal(state.error, 'pickupFirst', 'a remembered pickup must be re-observed')
    assert.equal(state.kitReceipt, '')
    go('return')
    hud.returnBook()
    await settle()
    assert.equal(state.error, 'observeFirst', 'an old destination cannot authorize a new return')
    assert.equal(state.bookReceipt, '')
    go('library')
    hud.readNotice()
    go('return')
    hud.returnBook()
    await settle()
    assert.ok(state.bookReceipt)
    assert.equal(active.slots.filter(Boolean).length, 0, 'confirmed return removes the actual item')
    assert.match(hud.nextDescription(state), /Recheck the card/, 'returning visitors are directed to fresh pickup evidence')
    state.language = 'zh'
    assert.match(hud.nextDescription(state), /重新确认领取卡/)
    state.language = 'en'
    go('meetup')
    hud.readPickup()
    go('plaza')
    hud.collectKit()
    await settle()
    assert.ok(state.kitReceipt)
    assert.equal(active.slots.find(Boolean).name, 'bundle', 'kit completion corresponds to an actual inventory grant')
    hud.collectKit()
    await settle()
    assert.equal(active.slots.filter(Boolean).length, 1, 'completed collection cannot repeat')
    const allReceipts = [state.bookReceipt, state.meetupReceipt, state.kitReceipt]
    makeVisit()
    await settle()
    assert.deepEqual([state.bookReceipt, state.meetupReceipt, state.kitReceipt], allReceipts)
    assert.equal(active.grants(), 0, 'completed loans never reappear on subsequent visits')
    assert.equal(active.slots.filter(Boolean).length, 0)
    assert.match(hud.nextDescription(state), /All three/)
    for (const channel of ['S → M', 'M → A', 'A → S', 'M → S', 'A → M']) assert.ok(state.journal.some(entry => entry.channel === channel), `${channel} has an actual user-triggered event`)

    values.set(memoryKey, JSON.stringify({ accepted: true, visits: 3 }))
    makeVisit({ acceptLoan: async () => ({ ok: false, reason: 'inventory-full' }) })
    await settle()
    assert.equal(state.restoreFailed, true, 'failed inventory restoration remains visibly retryable')
    assert.equal(state.bookReceipt, '')
    console.log('PASS: all four real station approaches, sight obstruction, three inventory-backed loops, stale-evidence guards, bilingual revisit guidance, receipt retention, and restoration failure.')
  } finally { cleanup?.() }
}
main().finally(() => fs.rmSync(temporary, { recursive: true, force: true })).catch(error => { console.error(error); process.exitCode = 1 })
