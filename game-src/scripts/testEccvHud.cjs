/**
 * Exercise the real ECCV HUD state machine without a renderer or browser.
 * Browser/React boundaries are stubbed; the HUD and visibility helper are loaded
 * from source. This does not replace a browser playthrough or visual review.
 * Run from any directory: node /path/to/client/scripts/testEccvHud.cjs
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const esbuild = require('esbuild')
const { Vec3 } = require('vec3')

const root = path.resolve(__dirname, '..')
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'eccv-hud-test-'))
const bundlePath = path.join(temporaryDirectory, 'hud.cjs')
const original = fs.readFileSync(path.join(root, 'src/alwaysOnHud.tsx'), 'utf8')
const helperStart = original.indexOf('export function isAlwaysOnTargetVisible')
const helperEnd = original.indexOf('\nfunction stopMovement', helperStart)
assert(helperStart >= 0 && helperEnd > helperStart, 'Cannot locate actual visibility helper')
const visibilitySource = original.slice(helperStart, helperEnd)

const stubs = {
  react: 'exports.useEffect=()=>{}; exports.useRef=()=>({current:null});',
  valtio: 'exports.proxy=x=>x; exports.subscribe=()=>()=>{}; exports.useSnapshot=x=>x;',
  './globalState': `
    exports.activeModalStack=globalThis.__modals;
    exports.showModal=x=>{
      if(!exports.activeModalStack.some(m=>m.reactType===x.reactType)) exports.activeModalStack.push(x);
    };
    exports.hideModal=x=>exports.activeModalStack.splice(exports.activeModalStack.indexOf(x),1);
    exports.isGameActive=()=>exports.activeModalStack.length===0;
    exports.miscUiState={currentTouch:false};
  `,
  './react/utilsApp': 'exports.useIsModalActive=()=>false;',
  './utils': 'exports.pointerLock={requestPointerLock:()=>Promise.resolve()};',
  './alwaysOnHud': `import {Vec3} from 'vec3'; ${visibilitySource}`
}

async function run () {
  // Test-only exports expose actions without adding a production debug API.
  const source = fs.readFileSync(path.join(root, 'src/eccvHud.tsx'), 'utf8') +
    '\nexport { reveal, requestInspection, feedback, interact, closePanel, downloadReport };'
  await esbuild.build({
    stdin: { contents: source, resolveDir: path.join(root, 'src'), loader: 'tsx' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: bundlePath,
    logLevel: 'silent',
    plugins: [{
      name: 'browser-boundaries',
      setup (build) {
        build.onResolve({ filter: /.*/ }, args => {
          if (stubs[args.path] || args.path.endsWith('.css')) return { path: args.path, namespace: 'stub' }
        })
        build.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({
          contents: stubs[args.path] || '',
          resolveDir: root,
          loader: args.path === './alwaysOnHud' ? 'ts' : 'js'
        }))
      }
    }]
  })

  global.__modals = []
  let ticks = []
  let now = 100000
  const store = new Map()
  global.setInterval = callback => { ticks.push(callback); return callback }
  global.clearInterval = callback => { ticks = ticks.filter(fn => fn !== callback) }
  Date.now = () => now
  global.localStorage = { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) }
  global.location = { search: '?lang=en' }
  global.window = new EventTarget()
  global.document = new EventTarget()
  document.hidden = false
  document.exitPointerLock = () => {}
  document.closest = () => null

  let downloads = 0
  let lastBlob
  document.body = { appendChild: () => {} }
  document.createElement = () => ({ click: () => downloads++, remove: () => {} })
  URL.createObjectURL = blob => { lastBlob = blob; return 'blob:report' }
  URL.revokeObjectURL = () => {}

  const hud = require(bundlePath)
  const state = hud.eccvHudState
  const bot = new EventEmitter()
  bot.entity = { position: new Vec3(0.5, 5, 5.5), yaw: 0, pitch: 0, velocity: new Vec3(0, 0, 0) }
  bot.controlState = {}
  bot.world = {}
  bot.mouse = { buttons: [] }
  bot.clearControlStates = () => {}
  bot.setControlState = () => {}
  let wall = false
  bot.blockAt = point => wall && point.z === 2
    ? { name: 'stone', boundingBox: 'block' }
    : { name: 'air', boundingBox: 'empty' }
  const options = {
    posters: [{ id: 'gaga', position: { x: 0, y: 6, z: 0 } }, { id: 'omnimap', position: { x: 10, y: 6, z: 0 } }],
    reportPoint: { x: 20, y: 6, z: 0 }
  }
  const tick = (milliseconds = 120) => { now += milliseconds; for (const callback of [...ticks]) callback() }
  const key = code => {
    const event = new Event('keydown', { cancelable: true })
    Object.defineProperty(event, 'code', { value: code })
    document.dispatchEvent(event)
  }

  hud.setupEccvDemo(bot, options)
  assert.equal(state.visit, 1)
  assert.equal(state.journal.length, 1)

  bot.entity.velocity = new Vec3(0.2, 0, 0)
  tick(); tick(2000)
  assert.equal(state.cards.gaga, undefined, 'Walking must not admit a poster')
  bot.entity.velocity = new Vec3(0, 0, 0)
  wall = true
  tick(); tick(2000)
  assert.equal(state.cards.gaga, undefined, 'A wall must reject observation')
  wall = false
  bot.entity.yaw = Math.PI
  tick(); tick(2000)
  assert.equal(state.cards.gaga, undefined, 'Facing away must reject observation')
  bot.entity.yaw = 0
  tick(); tick(1400)
  assert.equal(state.cards.gaga, undefined, 'Dwell shorter than 1.5 seconds must not admit a poster')
  tick(120)
  assert.equal(state.cards.gaga.seenVisit, 1)
  assert.equal(state.cards.gaga.stage, 0)

  key('KeyH')
  assert.equal(state.cards.gaga.stage, 1, 'H initializes the first insight')
  assert.equal(state.journal.at(-1).code, 'opened')
  assert(!state.journal.some(entry => entry.code === 'recommended'), 'Opening an insight must not invent a recommendation')
  hud.reveal()
  assert.equal(state.cards.gaga.stage, 2)
  assert.equal(state.journal.at(-1).code, 'question')
  hud.reveal()
  assert.equal(state.journal.at(-1).code, 'connected')
  hud.reveal()
  assert.equal(state.journal.at(-1).code, 'recommended')
  assert.equal(state.next, 'omnimap')

  hud.requestInspection()
  assert.equal(state.pendingInspect, 'gaga')
  tick(); tick(1500)
  assert.equal(state.cards.gaga.detailVisit, 0, 'An unchanged distant pose cannot confirm a detail')
  bot.entity.position = new Vec3(0.5, 5, 2.5)
  tick(); tick(900)
  assert.equal(state.cards.gaga.detailVisit, 1)
  assert.equal(state.pendingInspect, '')
  hud.feedback('gaga', 'useful')
  assert.equal(state.journal.at(-1).code, 'useful')
  assert.equal(state.cards.gaga.feedback, 'useful')

  bot.entity.position = new Vec3(10.5, 5, 4.5)
  tick(); tick(1600)
  assert.equal(state.cards.omnimap.seenVisit, 1)
  assert(state.journal.some(entry => entry.code === 'focus' && entry.poster === 'omnimap'))
  hud.downloadReport()
  assert.equal(downloads, 0, 'A report cannot download before a station preview')
  bot.entity.position = new Vec3(20.5, 5, 3.5)
  tick()
  assert.equal(state.target, 'report')
  key('KeyE')
  assert.equal(state.reportVisit, 1)
  assert.equal(state.tab, 'report')
  hud.downloadReport()
  assert.equal(downloads, 1)
  const html = await lastBlob.text()
  assert(html.includes('<h2>GaGA</h2>'))
  assert(html.includes('<h2>OmniMapBench</h2>'))
  assert(!html.includes('<h2>LaGen</h2>'), 'An unseen paper must not enter the report')
  const channels = new Set(state.journal.map(entry => entry.channel))
  for (const channel of ['S → M', 'M → S', 'M → A', 'A → S', 'A → M']) assert(channels.has(channel), channel)

  const cleanup = hud.setupEccvDemo(bot, options)
  assert.equal(state.visit, 2)
  assert.equal(state.cards.gaga.seenVisit, 1, 'Old evidence remains historical')
  assert.equal(state.cards.gaga.questionVisit, 1, 'An old question remains marked historical')
  assert.equal(state.cards.gaga.feedback, 'useful')
  assert.equal(state.reportVisit, 0)
  assert.equal(state.journal.at(-1).code, 'recalled')
  cleanup()

  console.log('PASS: stationary/FOV/LOS + 1.5s dwell, H/card stages, actual closer-view detail, five channels, feedback/history, guarded report with observed cards only.')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
}).finally(() => {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true })
})
